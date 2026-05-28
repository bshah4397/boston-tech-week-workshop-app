import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import TemplateApp from "./app-template";

describe("app host", () => {
  it("renders the host dashboard with the slot contract and template guidance", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /embedded app workshop host/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /created app slots/i })).toBeInTheDocument();
    expect(screen.getAllByText("src/app-template").length).toBeGreaterThan(0);
    expect(screen.getAllByText("src/apps/app-XXX").length).toBeGreaterThan(0);
    expect(screen.queryByText("app-100")).not.toBeInTheDocument();
  });

  it("does not register the template as a routable app slot", () => {
    window.history.pushState({}, "", "/app-template/demo");
    render(<App />);

    expect(screen.getByRole("heading", { name: /unknown app route/i })).toBeInTheDocument();
    expect(screen.getByText(/is not a workshop app slot/i)).toBeInTheDocument();
  });

  it("shows a missing-slot state for valid slots that are not created yet", () => {
    window.history.pushState({}, "", "/app-001/launch");
    render(<App />);

    expect(screen.getByRole("heading", { name: "app-001" })).toBeInTheDocument();
    expect(screen.getByText(/no app folder has been created/i)).toBeInTheDocument();
  });

  it("routes the cloned app-006 slot to its demo app", () => {
    window.history.pushState({}, "", "/app-006/demo");
    render(<App />);

    expect(screen.getByText("app-006")).toBeInTheDocument();
    expect(screen.getByText("Local Demo")).toBeInTheDocument();
    expect(screen.getByText("Alex Rivers")).toBeInTheDocument();
  });

  it("renders the slot logout-complete screen", () => {
    render(
      <TemplateApp
        appBasePath="/app-007"
        fullPath="/app-007/logout-complete"
        query={new URLSearchParams()}
        route="logout-complete"
        slotId="app-007"
      />,
    );

    expect(screen.getByRole("heading", { name: /logout complete/i })).toBeInTheDocument();
  });

  it("renders the template as a staged starting app before cards are enabled", () => {
    render(
      <TemplateApp
        appBasePath="/app-007"
        fullPath="/app-007/demo"
        query={new URLSearchParams()}
        route="demo"
        slotId="app-007"
      />,
    );

    expect(screen.getByText("Local Demo")).toBeInTheDocument();
    expect(screen.getByText("Alex Rivers")).toBeInTheDocument();
    expect(screen.getByText("Visit prep cards are enabled in the next workshop step.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Vitals review due" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Medication reconciliation" })).not.toBeInTheDocument();
    expect(screen.queryByText(/active care gap/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "SMART launch API" })).not.toBeInTheDocument();
  });

  it("the template postMessage helper sends Embedded App Launcher messages", async () => {
    const { sendEmbeddedAppMessage } = await import("./app-template/post-message");
    const postMessage = vi.fn();
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: { postMessage },
    });

    const message = sendEmbeddedAppMessage("appResize", { newWidth: "800" });

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "embeddedAppAPIMessage",
        method: "appResize",
        methodVersion: "1.0.0",
        newWidth: "800",
      },
      "*",
    );
    expect(message.method).toBe("appResize");
  });

  it("the template patient context helper preserves framework patient changes", async () => {
    const { patientContextApiPath } = await import("./app-template");

    expect(patientContextApiPath("app-007")).toBe("/api/apps/app-007/patient-context");
    expect(patientContextApiPath("app-007", "5")).toBe("/api/apps/app-007/patient-context?updatedPatient=5");
  });
});
