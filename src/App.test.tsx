import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import TemplateApp from "./app-template";

describe("app host", () => {
  it("renders the host dashboard with the slot contract and template guidance", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /embedded app workshop host/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /created app slots/i })).toBeInTheDocument();
    expect(screen.getByText(/copy src\/app-template into src\/apps\/app-xxx/i)).toBeInTheDocument();
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

  it("the template postMessage helper sends Embedded App Launcher messages", async () => {
    const { sendEmbeddedAppMessage } = await import("./app-template/post-message");
    const postMessage = vi.fn();
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: { postMessage },
    });

    const message = sendEmbeddedAppMessage("appResize", { newWidth: "600" });

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "embeddedAppAPIMessage",
        method: "appResize",
        methodVersion: "1.0.0",
        newWidth: "600",
      },
      "*",
    );
    expect(message.method).toBe("appResize");
  });
});
