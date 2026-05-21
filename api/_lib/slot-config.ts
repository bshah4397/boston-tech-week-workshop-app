import type { ApiRequest } from "./http";
import { WORKSHOP_SLOT_CLIENT_IDS } from "./workshop-config";

export const SMART_SCOPES = "launch patient/Patient.r user/Patient.r openid fhirUser";
export const ATHENA_AUTHORIZATION_URL = "https://api.preview.platform.athenahealth.com/oauth2/v1/authorize";
export const ATHENA_TOKEN_URL = "https://api.preview.platform.athenahealth.com/oauth2/v1/token";

const VALID_SLOT_PATTERN = /^app-\d{3,4}$/;

export function isValidSlotId(slotId: string) {
  return VALID_SLOT_PATTERN.test(slotId);
}

export function getSlotId(req: ApiRequest): string | null {
  const querySlot = req.query?.slot;
  const slot = Array.isArray(querySlot) ? querySlot[0] : querySlot;
  if (slot) return slot;

  const match = req.url?.match(/\/api\/apps\/(app-\d{3,4})\//);
  return match?.[1] ?? null;
}

export function getSlotClientId(slotId: string): string | null {
  return WORKSHOP_SLOT_CLIENT_IDS[slotId]?.trim() || null;
}

export function getSlotRegistrationUrls(baseUrl: string, slotId: string) {
  const origin = baseUrl.replace(/\/$/, "");

  return {
    launchUrl: `${origin}/api/apps/${slotId}/smart/launch`,
    redirectUrl: `${origin}/api/apps/${slotId}/smart/callback`,
    logoutRedirectUrl: `${origin}/${slotId}/logout-complete`,
  };
}
