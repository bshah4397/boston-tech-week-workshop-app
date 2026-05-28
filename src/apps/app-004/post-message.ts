const embeddedAppMessageVersion = "1.0.0" as const;

type EmbeddedAppMethod = "appClearBadge" | "appMinimize" | "appReopen" | "appResize" | "appShowBadgePersistent";

type EmbeddedAppMessage = {
  method: EmbeddedAppMethod;
  methodVersion: typeof embeddedAppMessageVersion;
  newWidth?: string;
  type: "embeddedAppAPIMessage";
};

type EmbeddedAppPayload = Omit<EmbeddedAppMessage, "method" | "methodVersion" | "type">;

export function sendEmbeddedAppMessage(method: EmbeddedAppMethod, payload: EmbeddedAppPayload = {}) {
  const message: EmbeddedAppMessage = {
    type: "embeddedAppAPIMessage",
    method,
    methodVersion: embeddedAppMessageVersion,
    ...payload,
  };

  window.parent.postMessage(message, "*");
  return message;
}
