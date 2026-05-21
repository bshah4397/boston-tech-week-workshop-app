import { decryptCookieValue, readCookie, sessionCookieName } from "../../_lib/cookies.js";
import { sendJson, type ApiRequest, type ApiResponse } from "../../_lib/http.js";
import { getSlotId, isValidSlotId } from "../../_lib/slot-config.js";
import type { SanitizedSmartSession, SmartSession } from "../../_lib/types";

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  const slotId = getSlotId(req);
  if (!slotId || !isValidSlotId(slotId)) {
    sendJson(res, 400, { error: "Missing or invalid app slot." });
    return;
  }

  const sessionCookie = readCookie(req.headers.cookie, sessionCookieName(slotId));
  if (!sessionCookie) {
    sendJson(res, 401, { error: "No active SMART session." });
    return;
  }

  const session = await decryptCookieValue<SmartSession>(sessionCookie);
  if (!session) {
    sendJson(res, 401, { error: "No active SMART session." });
    return;
  }

  if (!session.patientId) {
    sendJson(res, 400, {
      error: "Token response missing patient context.",
      smartSession: sanitizeSession(session),
    });
    return;
  }

  const patientUrl = `${session.serverUrl.replace(/\/$/, "")}/Patient/${encodeURIComponent(session.patientId)}`;
  const fhirResponse = await fetch(patientUrl, {
    headers: {
      Accept: "application/fhir+json, application/json",
      Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
    },
    method: "GET",
  });

  const body = await readResponseBody(fhirResponse);
  if (!fhirResponse.ok) {
    sendJson(res, 502, {
      error: "FHIR Patient read failed.",
      fhirDebug: {
        request: {
          method: "GET",
          url: patientUrl,
        },
        response: {
          body,
          status: fhirResponse.status,
          statusText: fhirResponse.statusText,
        },
      },
      smartSession: sanitizeSession(session),
    });
    return;
  }

  sendJson(res, 200, {
    fhirUser: session.fhirUser ?? null,
    patient: body,
    patientId: session.patientId,
    scope: session.scope,
    serverUrl: session.serverUrl,
    source: "smart",
  });
}

function sanitizeSession(session: SmartSession): SanitizedSmartSession {
  return {
    expiresAt: session.expiresAt ?? null,
    fhirUser: session.fhirUser ?? null,
    patientId: session.patientId,
    scope: session.scope,
    serverUrl: session.serverUrl,
    source: "smart",
  };
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
