import { ATHENA_AUTHORIZATION_URL, ATHENA_TOKEN_URL } from "./slot-config.js";

export type SmartEndpoints = {
  authorizationEndpoint: string;
  tokenEndpoint: string;
};

export async function discoverSmartEndpoints(iss: string): Promise<SmartEndpoints> {
  try {
    const response = await fetch(`${iss.replace(/\/$/, "")}/.well-known/smart-configuration`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Discovery failed with ${response.status}`);

    const config = (await response.json()) as {
      authorization_endpoint?: string;
      token_endpoint?: string;
    };

    if (!config.authorization_endpoint || !config.token_endpoint) {
      throw new Error("Discovery response missing OAuth endpoints.");
    }

    return {
      authorizationEndpoint: config.authorization_endpoint,
      tokenEndpoint: config.token_endpoint,
    };
  } catch {
    return {
      authorizationEndpoint: ATHENA_AUTHORIZATION_URL,
      tokenEndpoint: ATHENA_TOKEN_URL,
    };
  }
}

export function buildAuthorizeUrl(input: {
  aud: string;
  authorizationEndpoint: string;
  clientId: string;
  codeChallenge: string;
  launch?: string | null;
  redirectUri: string;
  scope: string;
  state: string;
}): URL {
  const url = new URL(input.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", input.scope);
  url.searchParams.set("aud", input.aud);
  if (input.launch) url.searchParams.set("launch", input.launch);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url;
}
