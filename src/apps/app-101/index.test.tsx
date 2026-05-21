import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App101 from "./index";

function renderSlot(route: "home" | "launch" | "callback" | "demo" | "logout-complete" | "unknown", query = new URLSearchParams()) {
  render(
    <App101
      appBasePath="/app-101"
      fullPath={`/app-101${route === "home" ? "" : `/${route}`}`}
      query={query}
      route={route}
      slotId="app-101"
    />,
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

describe("app-101 Visit Prep Sidecar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the completed local demo sidecar without developer chrome or generic action buttons", () => {
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);

    renderSlot("demo");

    expect(screen.getByText("app-101")).toBeInTheDocument();
    expect(screen.getByText("Local Demo")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Visit Prep" })).toBeInTheDocument();
    expect(screen.getByText("Alex Rivers")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vitals review due" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Medication reconciliation" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Referral follow-up" })).not.toBeInTheDocument();
    expect(screen.queryByText(/developer details/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Clinical actions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "SMART launch API" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /flag for review/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /snooze/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /bring prep back/i })).not.toBeInTheDocument();

    expect(postMessage).toHaveBeenCalledWith(
      {
        method: "appShowBadgePersistent",
        methodVersion: "1.0.0",
        type: "embeddedAppAPIMessage",
      },
      "*",
    );
  });

  it("resizes for details and collapses back to compact width", async () => {
    const user = userEvent.setup();
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);

    renderSlot("demo");
    postMessage.mockClear();

    await user.click(screen.getByRole("button", { name: /open details/i }));

    expect(postMessage).toHaveBeenCalledWith(
      {
        method: "appResize",
        methodVersion: "1.0.0",
        newWidth: "600",
        type: "embeddedAppAPIMessage",
      },
      "*",
    );
    expect(screen.getByRole("region", { name: "Review details" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Elevated blood pressure needs follow-up" })).toBeInTheDocument();

    postMessage.mockClear();
    await user.click(screen.getByRole("button", { name: /collapse details/i }));

    expect(postMessage).toHaveBeenCalledWith(
      {
        method: "appResize",
        methodVersion: "1.0.0",
        newWidth: "400",
        type: "embeddedAppAPIMessage",
      },
      "*",
    );
    expect(screen.queryByRole("region", { name: "Review details" })).not.toBeInTheDocument();
  });

  it("marks the active gap reviewed, clears the badge, and returns to compact state", async () => {
    const user = userEvent.setup();
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);

    renderSlot("demo");
    await user.click(screen.getByRole("button", { name: /open details/i }));
    postMessage.mockClear();

    await user.click(screen.getByRole("button", { name: /mark reviewed/i }));

    expect(postMessage).toHaveBeenCalledWith(
      {
        method: "appClearBadge",
        methodVersion: "1.0.0",
        type: "embeddedAppAPIMessage",
      },
      "*",
    );
    expect(postMessage).toHaveBeenCalledWith(
      {
        method: "appResize",
        methodVersion: "1.0.0",
        newWidth: "400",
        type: "embeddedAppAPIMessage",
      },
      "*",
    );
    expect(screen.queryByRole("region", { name: "Review details" })).not.toBeInTheDocument();
    expect(screen.getByText("Reviewed")).toBeInTheDocument();
  });

  it("reloads updated patient context and reopens after Athena changes patient", async () => {
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        patient: {
          birthDate: "1975-11-12",
          gender: "female",
          id: "a-195900.E-5",
          name: [{ family: "Patel", given: ["Rina"] }],
          resourceType: "Patient",
        },
        patientId: "a-195900.E-5",
        source: "framework-context-change",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderSlot("demo");
    postMessage.mockClear();

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            event: "patientContextChanged",
            updatedPatient: "5",
          },
          origin: "https://preview.athenahealth.com",
        }),
      );
    });

    expect(await screen.findByText("Rina Patel")).toBeInTheDocument();
    expect(screen.getByText("DOB 1975-11-12")).toBeInTheDocument();
    expect(screen.getByText("FHIR ID a-195900.E-5")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/apps/app-101/patient-context?updatedPatient=5",
      expect.objectContaining({
        credentials: "include",
        headers: { Accept: "application/json" },
      }),
    );
    expect(postMessage).toHaveBeenCalledWith(
      {
        method: "appReopen",
        methodVersion: "1.0.0",
        type: "embeddedAppAPIMessage",
      },
      "*",
    );
  });

  it("writes every received window message to the browser console before filtering", () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);

    renderSlot("demo");

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            method: "someUnsupportedMethod",
            type: "embeddedAppAPIMessage",
          },
          origin: "https://preview.athenahealth.com",
        }),
      );
    });

    expect(consoleLog).toHaveBeenCalledWith(
      "[app-101] received window message",
      expect.objectContaining({
        data: {
          method: "someUnsupportedMethod",
          type: "embeddedAppAPIMessage",
        },
        origin: "https://preview.athenahealth.com",
      }),
    );
  });

  it("shows a loader while patient context is loading", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));

    renderSlot("home");

    expect(screen.getByRole("status", { name: /loading patient context/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open local demo/i })).toHaveAttribute("href", "/app-101/demo");
    expect(screen.queryByRole("link", { name: "SMART launch API" })).not.toBeInTheDocument();
  });

  it("shows setup required when no SMART patient context is available", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ accessToken: "server-token", error: "No active SMART session." }, 401));
    vi.stubGlobal("fetch", fetchMock);

    renderSlot("home");

    expect(await screen.findByRole("heading", { name: "Setup Required" })).toBeInTheDocument();
    expect(screen.getByText("Patient context is not available yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start Athena launch" })).toHaveAttribute("href", "/api/apps/app-101/smart/launch");
    expect(document.body).not.toHaveTextContent("server-token");
  });

  it("shows launch and callback states without rendering sensitive callback values", () => {
    renderSlot("launch", new URLSearchParams("iss=https%3A%2F%2Ffhir.example%2Fr4&launch=launch-secret"));

    expect(screen.getByRole("heading", { name: "Launch In Progress" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue SMART launch" })).toHaveAttribute(
      "href",
      "/api/apps/app-101/smart/launch?iss=https%3A%2F%2Ffhir.example%2Fr4&launch=launch-secret",
    );

    renderSlot("callback", new URLSearchParams("code=code-secret&state=state-123"));

    expect(screen.getByRole("heading", { name: "Callback Received" })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("code-secret");
    expect(document.body).not.toHaveTextContent("state-123");
  });

  it("renders loaded patient context without developer details or secrets", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          accessToken: "server-token",
          authorization: "Bearer secret-header",
          codeVerifier: "pkce-secret",
          fhirUser: "Practitioner/prac-1",
          patient: {
            birthDate: "1980-02-03",
            gender: "nonbinary",
            id: "patient-123",
            name: [{ family: "Chen", given: ["Jamie"] }],
            resourceType: "Patient",
          },
          patientId: "patient-123",
          serverUrl: "https://fhir.example/r4",
          source: "smart",
        }),
      ),
    );

    renderSlot("home", new URLSearchParams("smart=1"));

    expect(await screen.findByText("Patient Loaded")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Visit Prep" })).toBeInTheDocument();
    expect(screen.getByText("Jamie Chen")).toBeInTheDocument();
    expect(screen.getByText("DOB 1980-02-03")).toBeInTheDocument();
    expect(screen.getByText("FHIR ID patient-123")).toBeInTheDocument();
    expect(screen.getByText("nonbinary")).toBeInTheDocument();
    expect(screen.queryByText("Developer details")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("server-token");
    expect(document.body).not.toHaveTextContent("Bearer secret-header");
    expect(document.body).not.toHaveTextContent("pkce-secret");
  });
});
