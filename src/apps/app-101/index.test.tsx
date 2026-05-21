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

describe("app-101 SMART patient states", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("preserves local demo mode and slot registration URLs", () => {
    renderSlot("demo");

    expect(screen.getByText("app-101 / local demo")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Visit Prep Sidecar" })).toBeInTheDocument();
    expect(screen.getByText("Alex Rivers")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vitals review due" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Medication reconciliation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Referral follow-up" })).toBeInTheDocument();
    expect(screen.getAllByText("Active care gap")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "SMART launch API" })).toHaveAttribute("href", "/api/apps/app-101/smart/launch");
    expect(screen.getByRole("link", { name: "SMART callback API" })).toHaveAttribute("href", "/api/apps/app-101/smart/callback");
    expect(screen.getByRole("link", { name: "Logout redirect" })).toHaveAttribute("href", "/app-101/logout-complete");
  });

  it("sends a persistent review badge message from the active care gap clinical action", async () => {
    const user = userEvent.setup();
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);

    renderSlot("demo");

    expect(screen.getAllByText("Active care gap")).toHaveLength(1);

    const clinicalActions = screen.getByRole("region", { name: "Clinical actions" });
    expect(clinicalActions).not.toHaveTextContent("appShowBadgePersistent");

    await user.click(within(clinicalActions).getByRole("button", { name: "Flag for review" }));

    expect(postMessage).toHaveBeenCalledWith(
      {
        method: "appShowBadgePersistent",
        methodVersion: "1.0.0",
        type: "embeddedAppAPIMessage",
      },
      "*",
    );
  });

  it("resizes the launcher and shows active gap details when reviewing details", async () => {
    const user = userEvent.setup();
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);

    renderSlot("demo");

    await user.click(screen.getByRole("button", { name: "Review details" }));

    expect(postMessage).toHaveBeenCalledWith(
      {
        method: "appResize",
        methodVersion: "1.0.0",
        newWidth: "600",
        type: "embeddedAppAPIMessage",
      },
      "*",
    );
    expect(screen.getByText("Alex Rivers")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Active gap details" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vitals review due" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rationale" })).toBeInTheDocument();
    expect(screen.getByText("The most recent blood pressure is elevated and should be reviewed before the visit closes.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Next steps" })).toBeInTheDocument();
    expect(screen.getByText("Open the latest vitals trend.")).toBeInTheDocument();
    expect(screen.getByText("Confirm whether repeat blood pressure is needed.")).toBeInTheDocument();
    expect(screen.getByText("Document follow-up plan before closing the encounter.")).toBeInTheDocument();
  });

  it("snoozes the active detail view while the user updates Athena", async () => {
    const user = userEvent.setup();
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);

    renderSlot("demo");

    await user.click(screen.getByRole("button", { name: "Review details" }));
    postMessage.mockClear();

    const activeGapDetails = screen.getByRole("region", { name: "Active gap details" });
    await user.click(within(activeGapDetails).getByRole("button", { name: "Snooze while I update Athena" }));

    expect(postMessage).toHaveBeenCalledWith(
      {
        method: "appMinimize",
        methodVersion: "1.0.0",
        type: "embeddedAppAPIMessage",
      },
      "*",
    );
    expect(screen.getByText("Reminder saved while Athena is updated.")).toBeInTheDocument();
    expect(screen.getByText("Vitals review due remains ready for follow-up.")).toBeInTheDocument();
  });

  it("reopens the saved reminder and returns to active gap details", async () => {
    const user = userEvent.setup();
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);

    renderSlot("demo");

    await user.click(screen.getByRole("button", { name: "Review details" }));
    await user.click(screen.getByRole("button", { name: "Snooze while I update Athena" }));

    expect(screen.getByRole("region", { name: "Reminder state" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Active gap details" })).not.toBeInTheDocument();

    postMessage.mockClear();
    await user.click(screen.getByRole("button", { name: "Bring prep back" }));

    expect(postMessage).toHaveBeenCalledWith(
      {
        method: "appReopen",
        methodVersion: "1.0.0",
        type: "embeddedAppAPIMessage",
      },
      "*",
    );
    expect(screen.getByRole("region", { name: "Active gap details" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vitals review due" })).toBeInTheDocument();
  });

  it("clears the badge and returns to compact Visit Prep mode when marked reviewed", async () => {
    const user = userEvent.setup();
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);

    renderSlot("demo");

    await user.click(screen.getByRole("button", { name: "Review details" }));
    expect(screen.getByRole("region", { name: "Active gap details" })).toBeInTheDocument();

    postMessage.mockClear();
    await user.click(screen.getByRole("button", { name: "Mark reviewed" }));

    expect(postMessage).toHaveBeenCalledWith(
      {
        method: "appClearBadge",
        methodVersion: "1.0.0",
        type: "embeddedAppAPIMessage",
      },
      "*",
    );
    expect(screen.queryByRole("region", { name: "Active gap details" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Visit prep cards" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vitals review due" })).toBeInTheDocument();
  });

  it("logs inbound context-change events and reloads patient identity in local demo mode", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        patient: {
          birthDate: "1972-07-08",
          gender: "male",
          id: "patient-789",
          name: [{ family: "Lane", given: ["Morgan"] }],
          resourceType: "Patient",
        },
        patientId: "patient-789",
        source: "framework-context-change",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderSlot("demo");

    await user.click(screen.getByRole("button", { name: "Review details" }));
    expect(screen.getByRole("region", { name: "Active gap details" })).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            context: { patientId: "patient-789" },
            eventName: "patientContextChanged",
            type: "embeddedAppFrameworkEvent",
          },
        }),
      );
    });

    expect(await screen.findByText("Morgan Lane")).toBeInTheDocument();
    expect(screen.getByText("DOB 1972-07-08")).toBeInTheDocument();
    expect(screen.getByText("FHIR ID patient-789")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Active gap details" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Visit prep cards" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Developer event log" })).toHaveTextContent("patientContextChanged");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/apps/app-101/patient-context?updatedPatient=patient-789",
      expect.objectContaining({
        credentials: "include",
        headers: { Accept: "application/json" },
      }),
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

  it("reloads patient identity when the framework sends updatedPatient", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        patient: {
          birthDate: "1975-11-12",
          gender: "female",
          id: "5",
          name: [{ family: "Patel", given: ["Rina"] }],
          resourceType: "Patient",
        },
        patientId: "5",
        source: "framework-context-change",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderSlot("demo");

    await user.click(screen.getByRole("button", { name: "Review details" }));
    await user.click(screen.getByRole("button", { name: "Snooze while I update Athena" }));
    expect(screen.getByRole("region", { name: "Reminder state" })).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            event: "patientContextChanged",
            type: "embeddedAppFrameworkEvent",
            updatedPatient: "5",
          },
        }),
      );
    });

    expect(await screen.findByText("Rina Patel")).toBeInTheDocument();
    expect(screen.getByText("DOB 1975-11-12")).toBeInTheDocument();
    expect(screen.getByText("FHIR ID 5")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Reminder state" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Active gap details" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Visit prep cards" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Developer event log" })).toHaveTextContent("patientContextChanged");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/apps/app-101/patient-context?updatedPatient=5",
      expect.objectContaining({
        credentials: "include",
        headers: { Accept: "application/json" },
      }),
    );
  });

  it("shows setup required when no SMART patient context is available", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ accessToken: "server-token", error: "No active SMART session." }, 401));
    vi.stubGlobal("fetch", fetchMock);

    renderSlot("home");

    expect(await screen.findByRole("heading", { name: "Setup Required" })).toBeInTheDocument();
    expect(screen.getByText("Patient context is not available yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start Athena launch" })).toHaveAttribute("href", "/api/apps/app-101/smart/launch");
    expect(document.body).not.toHaveTextContent("server-token");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/apps/app-101/patient-context",
      expect.objectContaining({
        credentials: "include",
        headers: { Accept: "application/json" },
      }),
    );
  });

  it("shows launch in progress with the slot launch API handoff", () => {
    renderSlot("launch", new URLSearchParams("iss=https%3A%2F%2Ffhir.example%2Fr4&launch=launch-secret"));

    expect(screen.getByRole("heading", { name: "Launch In Progress" })).toBeInTheDocument();
    expect(screen.getByText("Athena launch context received.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue SMART launch" })).toHaveAttribute(
      "href",
      "/api/apps/app-101/smart/launch?iss=https%3A%2F%2Ffhir.example%2Fr4&launch=launch-secret",
    );
    expect(document.body).not.toHaveTextContent("launch-secret");
  });

  it("shows callback received without rendering authorization codes", () => {
    renderSlot("callback", new URLSearchParams("code=code-secret&state=state-123"));

    expect(screen.getByRole("heading", { name: "Callback Received" })).toBeInTheDocument();
    expect(screen.getByText("The server-side callback endpoint handles code exchange.")).toBeInTheDocument();
    expect(screen.getByText("/api/apps/app-101/smart/callback")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Load patient context" })).toHaveAttribute("href", "/app-101?smart=1");
    expect(document.body).not.toHaveTextContent("code-secret");
    expect(document.body).not.toHaveTextContent("state-123");
  });

  it("renders loaded patient context with collapsed sanitized developer details", async () => {
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
    expect(screen.getByRole("heading", { name: "Visit Prep Sidecar" })).toBeInTheDocument();
    expect(screen.getByText("Jamie Chen")).toBeInTheDocument();
    expect(screen.getByText("DOB 1980-02-03")).toBeInTheDocument();
    expect(screen.getByText("FHIR ID patient-123")).toBeInTheDocument();
    expect(screen.getByText("nonbinary")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vitals review due" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Medication reconciliation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Referral follow-up" })).toBeInTheDocument();
    expect(screen.getAllByText("Active care gap")).toHaveLength(1);

    const details = screen.getByText("Developer details").closest("details");
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");
    expect(screen.getByText("https://fhir.example/r4")).toBeInTheDocument();
    expect(screen.getByText("Practitioner/prac-1")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("server-token");
    expect(document.body).not.toHaveTextContent("Bearer secret-header");
    expect(document.body).not.toHaveTextContent("pkce-secret");
  });

  it("shows patient load failed without rendering raw bearer headers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            error: "FHIR Patient read failed.",
            fhirDebug: { request: { headers: { Authorization: "Bearer secret-header" } } },
          },
          502,
        ),
      ),
    );

    renderSlot("home", new URLSearchParams("smart=1"));

    expect(await screen.findByRole("heading", { name: "Patient Load Failed" })).toBeInTheDocument();
    expect(screen.getByText("FHIR Patient read failed.")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Bearer secret-header");
  });
});
