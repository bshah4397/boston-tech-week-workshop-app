import type { ApiRequest, ApiResponse } from "./_lib/http";

type MockResponse = ApiResponse & {
  body: string;
  headers: Record<string, string[] | string>;
  statusCode: number;
};

export function makeRequest(url: string, headers: Record<string, string> = {}): ApiRequest {
  const parsed = new URL(url);
  const slot = parsed.pathname.match(/\/api\/apps\/(app-\d{3,4})\//)?.[1];

  return {
    method: "GET",
    url: `${parsed.pathname}${parsed.search}`,
    headers: {
      host: parsed.host,
      "x-forwarded-proto": parsed.protocol.replace(":", ""),
      ...headers,
    },
    query: {
      ...Object.fromEntries(parsed.searchParams.entries()),
      ...(slot ? { slot } : {}),
    },
  };
}

export function createMockResponse(): MockResponse {
  const res = {
    body: "",
    headers: {} as Record<string, string[] | string>,
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string | string[]) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    redirect(codeOrUrl: number | string, maybeUrl?: string) {
      if (typeof codeOrUrl === "number") {
        this.statusCode = codeOrUrl;
        this.headers.location = maybeUrl ?? "/";
      } else {
        this.statusCode = 302;
        this.headers.location = codeOrUrl;
      }
      return this;
    },
    json(value: unknown) {
      this.headers["content-type"] = "application/json";
      this.body = JSON.stringify(value);
      return this;
    },
    send(value: unknown) {
      this.body = typeof value === "string" ? value : JSON.stringify(value);
      return this;
    },
  };

  return res as unknown as MockResponse;
}

export function getCookieByName(setCookies: string[] | string | undefined, name: string): string | null {
  const cookies = Array.isArray(setCookies) ? setCookies : setCookies ? [setCookies] : [];
  return cookies.find((cookie) => cookie.startsWith(`${name}=`)) ?? null;
}
