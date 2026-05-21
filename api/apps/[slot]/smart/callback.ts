import { clearCookie, createSessionCookie, decryptCookieValue, launchCookieName, readCookie, sessionCookieName } from "../../../_lib/cookies";
import { decodeJwtPayload } from "../../../_lib/crypto";
import { getRequestUrl, isHttpsRequest, sendJson, sendSetupRequired, type ApiRequest, type ApiResponse } from "../../../_lib/http";
import { getSlotClientId, getSlotId, isValidSlotId } from "../../../_lib/slot-config";
import type { LaunchTransaction, SmartSession } from "../../../_lib/types";

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  const slotId = getSlotId(req);
  if (!slotId || !isValidSlotId(slotId)) {
    sendJson(res, 400, { error: "Missing or invalid app slot." });
    return;
  }

  const clientId = getSlotClientId(slotId);
  if (!clientId) {
    sendSetupRequired(res, slotId);
    return;
  }

  const requestUrl = getRequestUrl(req);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  if (!code) {
    sendJson(res, 400, { error: "Missing code on callback." });
    return;
  }

  const launchCookie = readCookie(req.headers.cookie, launchCookieName(slotId));
  if (!launchCookie) {
    sendJson(res, 400, { error: "Missing launch transaction cookie." });
    return;
  }

  const transaction = await decryptCookieValue<LaunchTransaction>(launchCookie);
  if (!transaction) {
    sendJson(res, 400, { error: "Unable to read launch transaction cookie." });
    return;
  }

  if (!state || state !== transaction.state) {
    sendJson(res, 400, { error: "State mismatch." });
    return;
  }

  const tokenResponse = await fetch(transaction.tokenEndpoint, {
    body: new URLSearchParams({
      client_id: clientId,
      code,
      code_verifier: transaction.codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: transaction.redirectUri,
    }).toString(),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  const tokenPayload = await readResponseBody(tokenResponse);
  if (!tokenResponse.ok) {
    sendJson(res, 502, {
      body: tokenPayload,
      error: "Token exchange failure.",
      status: tokenResponse.status,
      statusText: tokenResponse.statusText,
      tokenEndpoint: transaction.tokenEndpoint,
    });
    return;
  }

  const tokens = tokenPayload as Record<string, unknown>;
  const accessToken = stringValue(tokens.access_token);
  if (!accessToken) {
    sendJson(res, 502, { error: "Token response missing access token." });
    return;
  }

  const idTokenPayload = typeof tokens.id_token === "string" ? decodeJwtPayload(tokens.id_token) : null;
  const patientId = stringValue(tokens.patient) ?? stringValue(idTokenPayload?.patient);
  if (!patientId) {
    sendJson(res, 502, { error: "Token response missing patient context." });
    return;
  }

  const expiresIn = typeof tokens.expires_in === "number" ? tokens.expires_in : null;
  const session: SmartSession = {
    accessToken,
    expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : null,
    fhirUser: stringValue(tokens.fhirUser) ?? stringValue(idTokenPayload?.fhirUser),
    patientId,
    scope: stringValue(tokens.scope) ?? undefined,
    serverUrl: stringValue(tokens.iss) ?? transaction.iss,
    tokenType: stringValue(tokens.token_type) ?? "Bearer",
  };

  const secure = isHttpsRequest(req);
  const sessionCookie = await createSessionCookie(sessionCookieName(slotId), session, {
    maxAgeSeconds: 3600,
    secure,
  });
  res.setHeader("Set-Cookie", [sessionCookie, clearCookie(launchCookieName(slotId), secure)]);
  res.redirect(302, `/${slotId}?smart=1`);
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
