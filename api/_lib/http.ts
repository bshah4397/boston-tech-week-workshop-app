export type ApiRequest = {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
};

export type ApiResponse = {
  json(value: unknown): ApiResponse | void;
  redirect(codeOrUrl: number | string, maybeUrl?: string): ApiResponse | void;
  send(value: unknown): ApiResponse | void;
  setHeader(name: string, value: string | string[]): ApiResponse | void;
  status(code: number): ApiResponse;
};

export function getRequestUrl(req: ApiRequest): URL {
  const protoHeader = req.headers["x-forwarded-proto"];
  const hostHeader = req.headers["x-forwarded-host"] ?? req.headers.host;
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader || "http";
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader || "localhost:5174";

  return new URL(req.url || "/", `${proto}://${host}`);
}

export function isHttpsRequest(req: ApiRequest): boolean {
  return getRequestUrl(req).protocol === "https:";
}

export function sendJson(res: ApiResponse, status: number, body: unknown): void {
  res.status(status).json(body);
}

export function sendSetupRequired(res: ApiResponse, slotId: string): void {
  res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Setup required</title></head>
  <body>
    <main style="font-family: system-ui, sans-serif; max-width: 720px; margin: 48px auto; line-height: 1.5;">
      <h1>Setup required</h1>
      <p>${slotId} does not have a configured SMART client ID yet.</p>
      <p>Add the slot client ID to api/_lib/workshop-config.ts, then redeploy before launching from Athena.</p>
    </main>
  </body>
</html>`);
}
