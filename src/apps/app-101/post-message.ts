type EmbeddedAppMessage = {
  method: string;
  methodVersion: "1.0.0";
  newWidth?: string;
  type: "embeddedAppAPIMessage";
};

type EmbeddedAppPayload = Omit<EmbeddedAppMessage, "method" | "methodVersion" | "type">;

export function sendEmbeddedAppMessage(method: string, payload: EmbeddedAppPayload = {}) {
  const message: EmbeddedAppMessage = {
    type: "embeddedAppAPIMessage",
    method,
    methodVersion: "1.0.0",
    ...payload,
  };

  window.parent.postMessage(message, "*");
  return message;
}
