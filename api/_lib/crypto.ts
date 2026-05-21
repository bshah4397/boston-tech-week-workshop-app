import { createHash, randomBytes } from "node:crypto";

export function randomBase64Url(byteLength = 32): string {
  return base64Url(randomBytes(byteLength));
}

export function pkceChallenge(verifier: string): string {
  return base64Url(createHash("sha256").update(verifier).digest());
}

export function base64Url(value: Buffer): string {
  return value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const [, payload] = token.split(".");
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}
