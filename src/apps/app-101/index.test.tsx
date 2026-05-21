import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App101, { patientContextApiPath } from ".";

const baseProps = {
  appBasePath: "/app-101",
  fullPath: "/app-101/demo",
  query: new URLSearchParams(),
  route: "demo" as const,
  slotId: "app-101",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function patientContextResponse(patientId: string, name: string) {
  const [given, family] = name.split(" ");

  return Response.json({
    patient: {
      birthDate: "1975-04-12",
      gender: "female",
      id: patientId,
      name: [{ family, given: [given] }],
    },
    patientId,
    source: "smart",
  });
}

describe("app-101 Visit Prep sidecar", () => {
  it("preserves local demo mode", () => {
    render(<App101 {...baseProps} />);

    expect(screen.getByText("Local Demo")).toBeInTheDocument();
    expect(screen.getByText("Alex Rivers")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vitals review due" })).toBeInTheDocument();
    expect(screen.getByText("Latest vitals are available for review before the encounter.")).toBeInTheDocument();
    expect(screen.getByText("Medication list is ready for routine reconciliation.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /flag for review/i })).not.toBeInTheDocument();
  });

  it("shows a persistent badge and red dot when vitals review is due", () => {
    const postMessage = vi.fn();
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: { postMessage },
    });

    render(<App101 {...baseProps} />);

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "embeddedAppAPIMessage",
        method: "appShowBadgePersistent",
        methodVersion: "1.0.0",
      },
      "*",
    );
    expect(screen.getByLabelText("Needs review")).toBeInTheDocument();
  });

  it("opens and collapses vitals details with appResize messages", async () => {
    const user = userEvent.setup();
    const postMessage = vi.fn();
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: { postMessage },
    });

    render(<App101 {...baseProps} />);

    await user.click(screen.getByRole("button", { name: "Open details" }));

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "embeddedAppAPIMessage",
        method: "appResize",
        methodVersion: "1.0.0",
        newWidth: "600",
      },
      "*",
    );
    expect(screen.getByRole("heading", { name: "Review details" })).toBeInTheDocument();
    expect(screen.getByText("Rationale")).toBeInTheDocument();
    expect(screen.getByText("Next steps")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Medication reconciliation" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Collapse details" }));

    expect(postMessage).toHaveBeenLastCalledWith(
      {
        type: "embeddedAppAPIMessage",
        method: "appResize",
        methodVersion: "1.0.0",
        newWidth: "400",
      },
      "*",
    );
    expect(screen.queryByRole("heading", { name: "Review details" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Medication reconciliation" })).toBeInTheDocument();
  });

  it("marks vitals reviewed, clears the badge, resizes compact, and shows Reviewed", async () => {
    const user = userEvent.setup();
    const postMessage = vi.fn();
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: { postMessage },
    });

    render(<App101 {...baseProps} />);

    await user.click(screen.getByRole("button", { name: "Open details" }));
    await user.click(screen.getByRole("button", { name: "Mark reviewed" }));

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "embeddedAppAPIMessage",
        method: "appClearBadge",
        methodVersion: "1.0.0",
      },
      "*",
    );
    expect(postMessage).toHaveBeenLastCalledWith(
      {
        type: "embeddedAppAPIMessage",
        method: "appResize",
        methodVersion: "1.0.0",
        newWidth: "400",
      },
      "*",
    );
    expect(screen.queryByRole("heading", { name: "Review details" })).not.toBeInTheDocument();
    expect(screen.getByText("Reviewed")).toBeInTheDocument();
    expect(screen.queryByLabelText("Needs review")).not.toBeInTheDocument();
  });

  it("shows setup required when launch parameters are missing", () => {
    render(<App101 {...baseProps} fullPath="/app-101/launch" route="launch" />);

    expect(screen.getByRole("heading", { name: "Setup Required" })).toBeInTheDocument();
    expect(screen.getByText("Setup required")).toBeInTheDocument();
    expect(screen.getByText("/api/apps/app-101/smart/launch")).toBeInTheDocument();
  });

  it("shows launch in progress with the slot-scoped SMART launch API", () => {
    const query = new URLSearchParams({ iss: "https://fhir.example/r4", launch: "launch-123" });

    render(<App101 {...baseProps} fullPath="/app-101/launch" query={query} route="launch" />);

    const link = screen.getByRole("link", { name: "Continue SMART launch" });
    expect(screen.getByRole("heading", { name: "Launch In Progress" })).toBeInTheDocument();
    expect(screen.getByText("Launch in progress")).toBeInTheDocument();
    expect(link).toHaveAttribute(
      "href",
      "/api/apps/app-101/smart/launch?iss=https%3A%2F%2Ffhir.example%2Fr4&launch=launch-123",
    );
  });

  it("shows callback received without rendering sensitive callback values", () => {
    const query = new URLSearchParams({
      code: "secret-auth-code",
      code_verifier: "pkce-secret",
      state: "state-123",
    });

    render(<App101 {...baseProps} fullPath="/app-101/callback" query={query} route="callback" />);

    expect(screen.getByRole("heading", { name: "Callback Received" })).toBeInTheDocument();
    expect(screen.getByText("Callback received")).toBeInTheDocument();
    expect(screen.getByText("/api/apps/app-101/smart/callback")).toBeInTheDocument();
    expect(screen.queryByText("secret-auth-code")).not.toBeInTheDocument();
    expect(screen.queryByText("pkce-secret")).not.toBeInTheDocument();
    expect(screen.queryByText("state-123")).not.toBeInTheDocument();
  });

  it("loads and renders sanitized patient context from the slot-scoped API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => patientContextResponse("patient-123", "Alex Rivers")),
    );

    render(<App101 {...baseProps} fullPath="/app-101" query={new URLSearchParams({ smart: "1" })} route="home" />);

    expect(screen.getByRole("heading", { name: "Callback Received" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("FHIR ID patient-123")).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith("/api/apps/app-101/patient-context", expect.objectContaining({ method: "GET" }));
    expect(screen.getByText("Alex Rivers")).toBeInTheDocument();
    expect(screen.getByText("DOB 1975-04-12")).toBeInTheDocument();
    expect(screen.getByText("FHIR ID patient-123")).toBeInTheDocument();
    expect(screen.getByText("female")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vitals review due" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Medication reconciliation" })).toBeInTheDocument();
    expect(screen.getByText("Latest vitals are available for review before the encounter.")).toBeInTheDocument();
    expect(screen.getByText("Medication list is ready for routine reconciliation.")).toBeInTheDocument();
    expect(screen.queryByText("Patient loaded")).not.toBeInTheDocument();
    expect(screen.queryByText(/elevated/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/badge/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/resize/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/highlight/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/bearer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/authorization/i)).not.toBeInTheDocument();
  });

  it("logs every window message before filtering", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => patientContextResponse("patient-123", "Alex Rivers")));

    render(<App101 {...baseProps} fullPath="/app-101" route="home" />);
    await waitFor(() => expect(screen.getByText("FHIR ID patient-123")).toBeInTheDocument());

    const unrelatedMessage = { event: "notPatientContextChanged", updatedPatient: "5" };
    window.dispatchEvent(new MessageEvent("message", { data: unrelatedMessage }));

    expect(consoleLog).toHaveBeenCalledWith("[app-101] received window message", unrelatedMessage);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reloads updated patient context from updatedPatient and resets detail review state", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(patientContextResponse("patient-123", "Alex Rivers"))
        .mockResolvedValueOnce(patientContextResponse("a-195900.E-5", "Jamie Chen")),
    );

    render(<App101 {...baseProps} fullPath="/app-101" route="home" />);
    await waitFor(() => expect(screen.getByText("FHIR ID patient-123")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Open details" }));
    await user.click(screen.getByRole("button", { name: "Mark reviewed" }));
    expect(screen.getByText("Reviewed")).toBeInTheDocument();

    window.dispatchEvent(new MessageEvent("message", { data: { event: "patientContextChanged", updatedPatient: "5" } }));

    await waitFor(() => expect(screen.getByText("Jamie Chen")).toBeInTheDocument());
    expect(fetch).toHaveBeenNthCalledWith(1, "/api/apps/app-101/patient-context", expect.objectContaining({ method: "GET" }));
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/apps/app-101/patient-context?updatedPatient=5",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.getByText("FHIR ID a-195900.E-5")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Review details" })).not.toBeInTheDocument();
    expect(screen.queryByText("Reviewed")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Needs review")).toBeInTheDocument();
  });

  it("does not reload plain patient context for patient-change events without an identifier", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => patientContextResponse("patient-123", "Alex Rivers")));

    render(<App101 {...baseProps} fullPath="/app-101" route="home" />);
    await waitFor(() => expect(screen.getByText("FHIR ID patient-123")).toBeInTheDocument());

    window.dispatchEvent(new MessageEvent("message", { data: { event: "patientContextChanged" } }));

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("shows patient load failed when patient context cannot be read", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "No active SMART session." }, { status: 401 })));

    render(<App101 {...baseProps} fullPath="/app-101" route="home" />);

    await waitFor(() => expect(screen.getByText("Patient load failed")).toBeInTheDocument());
    expect(screen.getByText("Open local demo mode")).toHaveAttribute("href", "/app-101/demo");
  });

  it("builds the slot-scoped patient context API path", () => {
    expect(patientContextApiPath("app-101")).toBe("/api/apps/app-101/patient-context");
    expect(patientContextApiPath("app-101", "5")).toBe("/api/apps/app-101/patient-context?updatedPatient=5");
  });
});
