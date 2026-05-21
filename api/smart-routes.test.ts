import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import callbackHandler from "./apps/[slot]/smart/callback";
import launchHandler from "./apps/[slot]/smart/launch";
import patientContextHandler from "./apps/[slot]/patient-context";
import { createSessionCookie } from "./_lib/cookies";
import { buildAuthorizeUrl } from "./_lib/oauth";
import { getSlotClientId, getSlotRegistrationUrls, SMART_SCOPES } from "./_lib/slot-config";
import { WORKSHOP_SLOT_CLIENT_IDS } from "./_lib/workshop-config";
import { createMockResponse, getCookieByName, makeRequest } from "./test-helpers";

function resetWorkshopClientIds() {
  for (const slotId of Object.keys(WORKSHOP_SLOT_CLIENT_IDS)) {
    delete WORKSHOP_SLOT_CLIENT_IDS[slotId];
  }
}

function getRuntimeApiFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return getRuntimeApiFiles(path);
    if (!entry.name.endsWith(".ts")) return [];
    if (entry.name.endsWith(".test.ts") || entry.name === "test-helpers.ts") return [];
    return [path];
  });
}

describe("Vercel API module format", () => {
  it("uses Node ESM-compatible .js specifiers for runtime relative imports", () => {
    const apiDir = join(process.cwd(), "api");
    const extensionlessImports = getRuntimeApiFiles(apiDir).flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8");
      const matches = [...source.matchAll(/^\s*import(?!\s+type\b)[^'"]+from\s+["'](\.{1,2}\/[^"']+)["'];?/gm)];

      return matches
        .map((match) => match[1])
        .filter((specifier) => !specifier.endsWith(".js"))
        .map((specifier) => `${relative(apiDir, filePath)} -> ${specifier}`);
    });

    expect(extensionlessImports).toEqual([]);
  });
});

describe("slot SMART registration URLs", () => {
  it("builds the athenaOne registration URLs for a single slot", () => {
    expect(getSlotRegistrationUrls("https://workshop.example", "app-007")).toEqual({
      launchUrl: "https://workshop.example/api/apps/app-007/smart/launch",
      redirectUrl: "https://workshop.example/api/apps/app-007/smart/callback",
      logoutRedirectUrl: "https://workshop.example/app-007/logout-complete",
    });
  });

  it("reads the client ID from checked-in workshop config", () => {
    WORKSHOP_SLOT_CLIENT_IDS["app-007"] = "client-for-app-007";

    expect(getSlotClientId("app-007")).toBe("client-for-app-007");
  });
});

describe("SMART cookie encryption", () => {
  it("creates cookies in deployed environments without Vercel environment variables", async () => {
    vi.stubEnv("VERCEL", "1");

    await expect(
      createSessionCookie("smart_launch_app-007", { state: "state-123" }, { maxAgeSeconds: 600, secure: true }),
    ).resolves.toContain("smart_launch_app-007=");
  });
});

describe("slot SMART launch and callback", () => {
  beforeEach(() => {
    resetWorkshopClientIds();
    WORKSHOP_SLOT_CLIENT_IDS["app-007"] = "client-for-app-007";
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("redirects a slot launch to athena authorization with a slot callback URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          authorization_endpoint: "https://auth.example/authorize",
          token_endpoint: "https://auth.example/token",
        }),
      ),
    );

    const res = createMockResponse();
    await launchHandler(
      makeRequest("https://workshop.example/api/apps/app-007/smart/launch?iss=https%3A%2F%2Ffhir.example%2Fr4&launch=abc"),
      res,
    );

    const location = new URL(String(res.headers.location));
    expect(res.statusCode).toBe(302);
    expect(location.origin + location.pathname).toBe("https://auth.example/authorize");
    expect(location.searchParams.get("client_id")).toBe("client-for-app-007");
    expect(location.searchParams.get("redirect_uri")).toBe("https://workshop.example/api/apps/app-007/smart/callback");
    expect(location.searchParams.get("scope")).toBe(SMART_SCOPES);
    expect(location.searchParams.get("launch")).toBe("abc");
    expect(getCookieByName(res.headers["set-cookie"], "smart_launch_app-007")).toBeTruthy();
  });

  it("exchanges callback code and redirects back to the launched slot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          access_token: "server-side-token",
          token_type: "Bearer",
          patient: "patient-123",
          scope: SMART_SCOPES,
          fhirUser: "Practitioner/prac-1",
          expires_in: 3600,
        }),
      ),
    );
    const launchCookie = await createSessionCookie(
      "smart_launch_app-007",
      {
        codeVerifier: "verifier-123",
        createdAt: Date.now(),
        iss: "https://fhir.example/r4",
        launch: "launch-abc",
        redirectUri: "https://workshop.example/api/apps/app-007/smart/callback",
        state: "expected-state",
        tokenEndpoint: "https://auth.example/token",
      },
      { maxAgeSeconds: 600, secure: true },
    );

    const res = createMockResponse();
    await callbackHandler(
      makeRequest("https://workshop.example/api/apps/app-007/smart/callback?code=code-123&state=expected-state", {
        cookie: launchCookie,
      }),
      res,
    );

    expect(String(vi.mocked(fetch).mock.calls[0][1]?.body)).toContain("code=code-123");
    expect(String(vi.mocked(fetch).mock.calls[0][1]?.body)).toContain("code_verifier=verifier-123");
    expect(getCookieByName(res.headers["set-cookie"], "smart_session_app-007")).toBeTruthy();
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/app-007?smart=1");
  });
});

describe("slot patient context API", () => {
  it("reads Patient/{id} using the slot-specific SMART session cookie", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          gender: "female",
          id: "patient-123",
          resourceType: "Patient",
        }),
      ),
    );
    const sessionCookie = await createSessionCookie(
      "smart_session_app-007",
      {
        accessToken: "server-side-token",
        expiresAt: Date.now() + 3600000,
        fhirUser: "Practitioner/prac-1",
        patientId: "patient-123",
        scope: SMART_SCOPES,
        serverUrl: "https://fhir.example/r4",
        tokenType: "Bearer",
      },
      { maxAgeSeconds: 3600, secure: true },
    );

    const res = createMockResponse();
    await patientContextHandler(makeRequest("https://workshop.example/api/apps/app-007/patient-context", { cookie: sessionCookie }), res);

    expect(fetch).toHaveBeenCalledWith(
      "https://fhir.example/r4/Patient/patient-123",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer server-side-token",
        }),
      }),
    );
    expect(JSON.parse(res.body)).toMatchObject({
      patient: { id: "patient-123" },
      patientId: "patient-123",
      source: "smart",
    });
  });

  it("reads the updated patient from a framework context-change event", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          gender: "female",
          id: "a-195900.E-5",
          resourceType: "Patient",
        }),
      ),
    );
    const sessionCookie = await createSessionCookie(
      "smart_session_app-007",
      {
        accessToken: "server-side-token",
        expiresAt: Date.now() + 3600000,
        fhirUser: "Practitioner/prac-1",
        patientId: "a-195900.E-12",
        scope: SMART_SCOPES,
        serverUrl: "https://api.preview.platform.athenahealth.com/fhir/r4",
        tokenType: "Bearer",
      },
      { maxAgeSeconds: 3600, secure: true },
    );

    const res = createMockResponse();
    await patientContextHandler(
      makeRequest("https://workshop.example/api/apps/app-007/patient-context?updatedPatient=5", { cookie: sessionCookie }),
      res,
    );

    expect(fetch).toHaveBeenCalledWith(
      "https://api.preview.platform.athenahealth.com/fhir/r4/Patient/a-195900.E-5",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer server-side-token",
        }),
      }),
    );
    expect(JSON.parse(res.body)).toMatchObject({
      patient: { id: "a-195900.E-5" },
      patientId: "a-195900.E-5",
      requestedPatient: "5",
      source: "smart",
    });
  });
});

describe("shared authorize URL helper", () => {
  it("keeps SMART launch, audience, redirect URI, and PKCE parameters", () => {
    const url = buildAuthorizeUrl({
      aud: "https://fhir.example/r4",
      authorizationEndpoint: "https://auth.example/authorize",
      clientId: "client-for-app-007",
      codeChallenge: "challenge-123",
      launch: "launch-123",
      redirectUri: "https://workshop.example/api/apps/app-007/smart/callback",
      scope: SMART_SCOPES,
      state: "state-123",
    });

    expect(url.searchParams.get("aud")).toBe("https://fhir.example/r4");
    expect(url.searchParams.get("client_id")).toBe("client-for-app-007");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-123");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("launch")).toBe("launch-123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://workshop.example/api/apps/app-007/smart/callback");
  });
});
