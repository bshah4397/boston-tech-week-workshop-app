export type LaunchTransaction = {
  codeVerifier: string;
  createdAt: number;
  iss: string;
  launch?: string | null;
  redirectUri: string;
  state: string;
  tokenEndpoint: string;
};

export type SmartSession = {
  accessToken: string;
  expiresAt?: number | null;
  fhirUser?: string | null;
  patientId: string | null;
  scope?: string;
  serverUrl: string;
  tokenType: string;
};

export type SanitizedSmartSession = {
  expiresAt?: number | null;
  fhirUser?: string | null;
  patientId?: string | null;
  scope?: string;
  serverUrl?: string;
  source: "smart";
};
