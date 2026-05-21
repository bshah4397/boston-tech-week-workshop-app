import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const WORKSHOP_COOKIE_KEY = "boston-tech-week-workshop-shared-cookie-key-demo-host-only";
const KEY = createHash("sha256").update(WORKSHOP_COOKIE_KEY).digest();

type CookieOptions = {
  maxAgeSeconds: number;
  secure: boolean;
};

export function launchCookieName(slotId: string) {
  return `smart_launch_${slotId}`;
}

export function sessionCookieName(slotId: string) {
  return `smart_session_${slotId}`;
}

export async function encryptCookieValue(value: unknown): Promise<string> {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export async function decryptCookieValue<T>(cookieValue: string): Promise<T | null> {
  try {
    const [ivText, tagText, encryptedText] = cookieValue.split(".");
    if (!ivText || !tagText || !encryptedText) return null;

    const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedText, "base64url")),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString("utf8")) as T;
  } catch {
    return null;
  }
}

export async function createSessionCookie(name: string, value: unknown, options: CookieOptions): Promise<string> {
  const encrypted = await encryptCookieValue(value);
  return serializeCookie(name, encrypted, options);
}

export function clearCookie(name: string, secure: boolean): string {
  return serializeCookie(name, "", { maxAgeSeconds: 0, secure });
}

export function readCookie(cookieHeader: string | string[] | undefined, name: string): string | null {
  const header = Array.isArray(cookieHeader) ? cookieHeader.join(";") : cookieHeader;
  if (!header) return null;

  const cookies = header.split(";").map((part) => part.trim());
  const cookie = cookies.find((part) => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${options.maxAgeSeconds}`,
  ];

  if (options.secure) {
    parts.push("Secure", "SameSite=None", "Partitioned");
  } else {
    parts.push("SameSite=Lax");
  }

  return parts.join("; ");
}
