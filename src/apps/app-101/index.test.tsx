import { render, screen, waitFor } from "@testing-library/react";
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

describe("app-101 Visit Prep sidecar", () => {
  it("preserves local demo mode", () => {
    render(<App101 {...baseProps} />);

    expect(screen.getByText("Local Demo")).toBeInTheDocument();
    expect(screen.getByText("Alex Rivers")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vitals review due" })).toBeInTheDocument();
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
      vi.fn(async () =>
        Response.json({
          patient: {
            birthDate: "1975-04-12",
            gender: "female",
            id: "patient-123",
            name: [{ family: "Rivers", given: ["Alex"] }],
          },
          patientId: "patient-123",
          source: "smart",
        }),
      ),
    );

    render(<App101 {...baseProps} fullPath="/app-101" query={new URLSearchParams({ smart: "1" })} route="home" />);

    expect(screen.getByRole("heading", { name: "Callback Received" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Patient loaded")).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith("/api/apps/app-101/patient-context", expect.objectContaining({ method: "GET" }));
    expect(screen.getByText("Alex Rivers")).toBeInTheDocument();
    expect(screen.getByText("DOB 1975-04-12")).toBeInTheDocument();
    expect(screen.getByText("FHIR ID patient-123")).toBeInTheDocument();
    expect(screen.getByText("female")).toBeInTheDocument();
    expect(screen.queryByText(/bearer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/authorization/i)).not.toBeInTheDocument();
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
