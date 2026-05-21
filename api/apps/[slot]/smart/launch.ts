import { launchCookieName, createSessionCookie } from "../../../_lib/cookies";
import { pkceChallenge, randomBase64Url } from "../../../_lib/crypto";
import { getRequestUrl, isHttpsRequest, sendJson, sendSetupRequired, type ApiRequest, type ApiResponse } from "../../../_lib/http";
import { buildAuthorizeUrl, discoverSmartEndpoints } from "../../../_lib/oauth";
import { getSlotClientId, getSlotId, isValidSlotId, SMART_SCOPES } from "../../../_lib/slot-config";
import type { LaunchTransaction } from "../../../_lib/types";

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
  const iss = requestUrl.searchParams.get("iss");
  if (!iss) {
    sendJson(res, 400, { error: "Missing iss on launch." });
    return;
  }

  const launch = requestUrl.searchParams.get("launch");
  const redirectUri = `${requestUrl.origin}/api/apps/${slotId}/smart/callback`;
  const endpoints = await discoverSmartEndpoints(iss);
  const codeVerifier = randomBase64Url(64);
  const codeChallenge = pkceChallenge(codeVerifier);
  const state = randomBase64Url(32);
  const transaction: LaunchTransaction = {
    codeVerifier,
    createdAt: Date.now(),
    iss,
    launch,
    redirectUri,
    state,
    tokenEndpoint: endpoints.tokenEndpoint,
  };

  const secure = isHttpsRequest(req);
  const launchCookie = await createSessionCookie(launchCookieName(slotId), transaction, {
    maxAgeSeconds: 600,
    secure,
  });
  res.setHeader("Set-Cookie", launchCookie);

  const authorizeUrl = buildAuthorizeUrl({
    aud: iss,
    authorizationEndpoint: endpoints.authorizationEndpoint,
    clientId,
    codeChallenge,
    launch,
    redirectUri,
    scope: SMART_SCOPES,
    state,
  });

  res.redirect(302, authorizeUrl.toString());
}
