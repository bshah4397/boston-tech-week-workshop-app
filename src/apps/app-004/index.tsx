import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SlotAppProps, SlotConfig } from "../../slot-types";
import { sendEmbeddedAppMessage } from "./post-message";

export const slotConfig: SlotConfig = {
  description: "Workshop participant slot",
  slotId: "app-004",
  title: "Visit Prep Sidecar",
};

type WorkshopFeatures = {
  automaticBadge: boolean;
  patientContextListener: boolean;
  reopenAfterPatientChange: boolean;
  resizeDetails: boolean;
  smartPatientContext: boolean;
  visitPrepCards: boolean;
};

export const WORKSHOP_FEATURES: WorkshopFeatures = {
  // Step 3: enable SMART patient-context loading from the slot-scoped API.
  smartPatientContext: true,
  // Step 4: reveal the neutral Visit Prep card layout.
  visitPrepCards: true,
  // Step 5: reveal detail expansion and collapse behavior.
  resizeDetails: true,
  // Step 6: turn the active gap into an automatic badge-driving state.
  automaticBadge: true,
  // Step 7: listen for Embedded App Framework patient context changes.
  patientContextListener: true,
  // Extension: reopen after the provider manually minimizes and changes patient.
  reopenAfterPatientChange: false,
};

type FhirPatient = {
  birthDate?: unknown;
  gender?: unknown;
  id?: unknown;
  name?: unknown;
  resourceType?: unknown;
};

type PatientContext = {
  error?: unknown;
  fhirUser?: unknown;
  patient?: FhirPatient;
  patientId?: unknown;
  serverUrl?: unknown;
  source?: unknown;
};

type PatientProfile = {
  dob: string;
  fhirId: string;
  gender: string;
  name: string;
};

type PatientContextState =
  | { status: "loading" }
  | { message: string; status: "setup-required" }
  | { context: PatientContext; patient: PatientProfile; status: "loaded" }
  | { message: string; status: "failed" };

const demoPatient: PatientProfile = {
  dob: "04/12/1975",
  fhirId: "12345",
  gender: "female",
  name: "Alex Rivers",
};

const prepCards = [
  {
    activeCareGap: true,
    detailTitle: "Elevated blood pressure needs follow-up",
    label: "Vitals review due",
    nextSteps: ["Open latest vitals trend", "Confirm repeat BP plan", "Document follow-up before closing"],
    rationale: "Confirm whether repeat vitals or follow-up documentation is needed before the encounter is closed.",
    text: "Latest vitals are available for review before the encounter.",
  },
  {
    activeCareGap: false,
    detailTitle: "Medication reconciliation details",
    label: "Medication reconciliation",
    nextSteps: ["Review active medication list.", "Confirm discontinued medications."],
    rationale: "Medication history may need cleanup before the encounter is signed.",
    text: "Medication list is ready for routine reconciliation.",
  },
];

export default function TemplateApp({ appBasePath, query, route, slotId }: SlotAppProps) {
  if (route === "logout-complete") {
    return <LogoutCompleteScreen appBasePath={appBasePath} slotId={slotId} />;
  }

  if (route === "launch") {
    return <LaunchScreen appBasePath={appBasePath} query={query} slotId={slotId} />;
  }

  if (route === "callback") {
    return <CallbackScreen appBasePath={appBasePath} slotId={slotId} />;
  }

  if (route === "unknown") {
    return <AppError appBasePath={appBasePath} />;
  }

  if (route === "demo" || !WORKSHOP_FEATURES.smartPatientContext) {
    return <VisitPrepSidecar features={WORKSHOP_FEATURES} patient={demoPatient} slotId={slotId} statusLabel="Local Demo" />;
  }

  return <PatientContextScreen appBasePath={appBasePath} features={WORKSHOP_FEATURES} slotId={slotId} />;
}

function PatientContextScreen({
  appBasePath,
  features,
  slotId,
}: {
  appBasePath: string;
  features: WorkshopFeatures;
  slotId: string;
}) {
  const [contextState, setContextState] = useState<PatientContextState>({ status: "loading" });

  useEffect(() => {
    let isCurrent = true;

    async function loadPatientContext() {
      try {
        const response = await fetch(patientContextApiPath(slotId), {
          credentials: "include",
          headers: { Accept: "application/json" },
          method: "GET",
        });
        const body = (await readJson(response)) as PatientContext;

        if (!isCurrent) return;

        if (!response.ok) {
          if (response.status === 401) {
            setContextState({
              message: "Patient context is not available yet.",
              status: "setup-required",
            });
            return;
          }

          setContextState({
            message: errorMessage(body),
            status: "failed",
          });
          return;
        }

        setContextState({
          context: body,
          patient: patientProfile(body),
          status: "loaded",
        });
      } catch {
        if (!isCurrent) return;
        setContextState({
          message: "Unable to load patient context.",
          status: "failed",
        });
      }
    }

    void loadPatientContext();

    return () => {
      isCurrent = false;
    };
  }, [slotId]);

  if (contextState.status === "loading") {
    return (
      <main className="slot-shell">
        <section className="slot-panel launch-panel">
          <p className="slot-kicker">{slotId}</p>
          <h1>Patient Context Loading</h1>
          <div aria-label="Loading patient context" className="loading-row" role="status">
            <span className="loading-spinner" aria-hidden="true" />
            <span>Loading patient context</span>
          </div>
          <a className="slot-primary-action" href={`${appBasePath}/demo`}>
            Open local demo mode
          </a>
        </section>
      </main>
    );
  }

  if (contextState.status === "setup-required") {
    return <SetupRequiredScreen appBasePath={appBasePath} message={contextState.message} slotId={slotId} />;
  }

  if (contextState.status === "failed") {
    return (
      <StatusPanel
        detail={contextState.message}
        kicker={`${slotId} / patient context`}
        primaryHref={appBasePath}
        primaryLabel="Retry patient load"
        secondaryHref={`${appBasePath}/demo`}
        secondaryLabel="Open local demo mode"
        title="Patient Load Failed"
      />
    );
  }

  return <VisitPrepSidecar features={features} patient={contextState.patient} slotId={slotId} statusLabel="Patient Loaded" />;
}

function LaunchScreen({ appBasePath, query, slotId }: { appBasePath: string; query: URLSearchParams; slotId: string }) {
  if (!query.get("iss")) {
    return <SetupRequiredScreen appBasePath={appBasePath} message="Athena launch parameters are missing." slotId={slotId} />;
  }

  return (
    <StatusPanel
      detail="Athena launch context received."
      kicker={`${slotId} / SMART launch`}
      primaryHref={slotApiPath(slotId, "smart/launch", query)}
      primaryLabel="Continue SMART launch"
      secondaryHref={`${appBasePath}/demo`}
      secondaryLabel="Open local demo mode"
      title="Launch In Progress"
    />
  );
}

function CallbackScreen({ appBasePath, slotId }: { appBasePath: string; slotId: string }) {
  return (
    <StatusPanel
      detail="The server-side callback endpoint handles code exchange, then the app loads patient context from the slot page."
      extra={
        <>
          <div aria-label="Callback loading patient context" className="loading-row" role="status">
            <span className="loading-spinner" aria-hidden="true" />
            <span>Ready to load patient context</span>
          </div>
          <dl>
            <div>
              <dt>Callback endpoint</dt>
              <dd>{slotApiPath(slotId, "smart/callback")}</dd>
            </div>
            <div>
              <dt>Authorization code</dt>
              <dd>Received by server route</dd>
            </div>
          </dl>
        </>
      }
      kicker={`${slotId} / SMART callback`}
      primaryHref={`${appBasePath}?smart=1`}
      primaryLabel="Load patient context"
      secondaryHref={`${appBasePath}/demo`}
      secondaryLabel="Open local demo mode"
      title="Callback Received"
    />
  );
}

function SetupRequiredScreen({ appBasePath, message, slotId }: { appBasePath: string; message: string; slotId: string }) {
  return (
    <StatusPanel
      detail={message}
      extra={
        <dl>
          <div>
            <dt>Launch URL</dt>
            <dd>{slotApiPath(slotId, "smart/launch")}</dd>
          </div>
          <div>
            <dt>Post-login redirect</dt>
            <dd>{slotApiPath(slotId, "smart/callback")}</dd>
          </div>
          <div>
            <dt>Post-logout redirect</dt>
            <dd>{`${appBasePath}/logout-complete`}</dd>
          </div>
        </dl>
      }
      kicker={`${slotId} / setup`}
      primaryHref={slotApiPath(slotId, "smart/launch")}
      primaryLabel="Start Athena launch"
      secondaryHref={`${appBasePath}/demo`}
      secondaryLabel="Open local demo mode"
      title="Setup Required"
    />
  );
}

function VisitPrepSidecar({
  features,
  patient,
  slotId,
  statusLabel,
}: {
  features: WorkshopFeatures;
  patient: PatientProfile;
  slotId: string;
  statusLabel: string;
}) {
  const activePrepGap = prepCards.find((card) => card.activeCareGap);
  const [currentPatient, setCurrentPatient] = useState(patient);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isReviewed, setIsReviewed] = useState(false);
  const lastBadgePatientKey = useRef<string | null>(null);

  useEffect(() => {
    setCurrentPatient(patient);
    setDetailsOpen(false);
    setIsReviewed(false);
    lastBadgePatientKey.current = null;
  }, [patient]);

  useEffect(() => {
    if (!features.automaticBadge || !activePrepGap || isReviewed) return;

    const patientKey = `${currentPatient.fhirId}:${currentPatient.name}`;
    if (lastBadgePatientKey.current === patientKey) return;

    sendEmbeddedAppMessage("appShowBadgePersistent");
    lastBadgePatientKey.current = patientKey;
  }, [activePrepGap, currentPatient.fhirId, currentPatient.name, features.automaticBadge, isReviewed]);

  useEffect(() => {
    if (!features.patientContextListener) return undefined;

    let isCurrent = true;

    async function reloadPatientIdentity(updatedPatient: string) {
      try {
        const response = await fetch(patientContextApiPath(slotId, updatedPatient), {
          credentials: "include",
          headers: { Accept: "application/json" },
          method: "GET",
        });
        const body = (await readJson(response)) as PatientContext;

        if (isCurrent && response.ok) {
          setCurrentPatient(patientProfile(body));
          setDetailsOpen(false);
          setIsReviewed(false);
          lastBadgePatientKey.current = null;

          if (features.reopenAfterPatientChange && activePrepGap) {
            sendEmbeddedAppMessage("appReopen");
          }
        }
      } catch {
        // Keep the current identity if the launcher context changes before SMART context is reachable.
      }
    }

    function handleFrameworkMessage(event: MessageEvent) {
      console.log(`[${slotId}] received window message`, {
        data: event.data,
        origin: event.origin,
      });

      const eventName = frameworkEventName(event.data);
      if (!eventName || !isPatientContextChangeEvent(eventName, event.data)) return;

      setDetailsOpen(false);
      setIsReviewed(false);

      const updatedPatient = patientIdentifierFromMessage(event.data);
      if (updatedPatient) {
        void reloadPatientIdentity(updatedPatient);
      }
    }

    window.addEventListener("message", handleFrameworkMessage);

    return () => {
      isCurrent = false;
      window.removeEventListener("message", handleFrameworkMessage);
    };
  }, [activePrepGap, features.patientContextListener, features.reopenAfterPatientChange, slotId]);

  function openDetails() {
    if (!features.resizeDetails || !activePrepGap) return;

    sendEmbeddedAppMessage("appResize", { newWidth: "800" });
    setDetailsOpen(true);
  }

  function collapseDetails() {
    sendEmbeddedAppMessage("appResize", { newWidth: "400" });
    setDetailsOpen(false);
  }

  function markReviewed() {
    sendEmbeddedAppMessage("appClearBadge");
    sendEmbeddedAppMessage("appResize", { newWidth: "400" });
    setIsReviewed(true);
    setDetailsOpen(false);
  }

  return (
    <main className={`sidecar-shell ${detailsOpen ? "sidecar-shell-expanded" : ""}`}>
      <section className="sidecar-card" aria-labelledby="sidecar-title">
        <header className="sidecar-titlebar">
          <div>
            <p className="slot-kicker">{slotId}</p>
            <h1 id="sidecar-title">Visit Prep</h1>
          </div>
          <span>{statusLabel}</span>
        </header>

        <PatientBanner patient={currentPatient} />

        {features.visitPrepCards ? (
          <div className={`sidecar-content ${detailsOpen ? "with-detail" : ""}`}>
            <section className="prep-list" aria-label="Visit prep cards">
              {prepCards.map((card) => {
                const cardNeedsAttention = features.automaticBadge && card.activeCareGap && !isReviewed;
                const canOpenDetails = features.resizeDetails && card.activeCareGap && !isReviewed && !detailsOpen;

                return (
                  <article className={`prep-card ${cardNeedsAttention ? "active" : "default"}`} key={card.label}>
                    {cardNeedsAttention ? (
                      <div className="care-gap-head">
                        <span className="slot-kicker">Active care gap</span>
                        <span className="attention-dot" aria-label="Needs review" />
                      </div>
                    ) : null}
                    <h2>{card.label}</h2>
                    <p>{card.text}</p>
                    {card.activeCareGap && isReviewed ? <strong className="reviewed-state">Reviewed</strong> : null}
                    {canOpenDetails ? (
                      <div className="card-actions">
                        <button className="slot-primary-action compact-action" type="button" onClick={openDetails}>
                          <ArrowLeft aria-hidden="true" size={16} />
                          Open details
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </section>
            {detailsOpen && activePrepGap ? (
              <section className="review-detail" aria-label="Review details">
                <span className="slot-kicker">Review details</span>
                <h2>{activePrepGap.detailTitle}</h2>
                <p>{activePrepGap.rationale}</p>
                <div className="detail-checklist">
                  {activePrepGap.nextSteps.map((step) => (
                    <div key={step}>{step}</div>
                  ))}
                </div>
                <div className="detail-actions">
                  <button className="secondary-detail-action" type="button" onClick={collapseDetails}>
                    <ArrowRight aria-hidden="true" size={16} />
                    Collapse details
                  </button>
                  {features.automaticBadge ? (
                    <button className="slot-primary-action compact-action" type="button" onClick={markReviewed}>
                      <Check aria-hidden="true" size={16} />
                      Mark reviewed
                    </button>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <p className="sidecar-placeholder">Visit prep cards are enabled in the next workshop step.</p>
        )}
      </section>
    </main>
  );
}

function PatientBanner({ patient }: { patient: PatientProfile }) {
  return (
    <section className="patient-banner" aria-label="Patient identity">
      <span className="patient-avatar" aria-hidden="true">
        {patientInitials(patient.name)}
      </span>
      <div>
        <strong>{patient.name}</strong>
        <span>DOB {patient.dob}</span>
        <span>FHIR ID {patient.fhirId}</span>
        <span>{patient.gender}</span>
      </div>
    </section>
  );
}

function StatusPanel({
  detail,
  extra,
  kicker,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  title,
}: {
  detail: string;
  extra?: React.ReactNode;
  kicker: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  title: string;
}) {
  return (
    <main className="slot-shell">
      <section className="slot-panel launch-panel">
        <p className="slot-kicker">{kicker}</p>
        <h1>{title}</h1>
        <p>{detail}</p>
        {extra}
        <a className="slot-primary-action" href={primaryHref}>
          {primaryLabel}
        </a>
        {secondaryHref && secondaryLabel ? (
          <a className="slot-primary-action" href={secondaryHref}>
            {secondaryLabel}
          </a>
        ) : null}
      </section>
    </main>
  );
}

function LogoutCompleteScreen({ appBasePath, slotId }: { appBasePath: string; slotId: string }) {
  return (
    <StatusPanel
      detail="The Athena logout flow has returned to this workshop app slot."
      kicker={`${slotId} / post-logout redirect`}
      primaryHref={`${appBasePath}/demo`}
      primaryLabel="Open local demo mode"
      title="Logout Complete"
    />
  );
}

function AppError({ appBasePath }: { appBasePath: string }) {
  return (
    <StatusPanel
      detail="This workshop slot supports home, demo, launch, callback, and logout-complete routes."
      kicker="Unknown app route"
      primaryHref={`${appBasePath}/demo`}
      primaryLabel="Open demo"
      title="Route Not Found"
    />
  );
}

function slotApiPath(slotId: string, path: "patient-context" | "smart/callback" | "smart/launch", query?: URLSearchParams) {
  const search = query?.toString();
  return `/api/apps/${slotId}/${path}${search ? `?${search}` : ""}`;
}

export function patientContextApiPath(slotId: string, updatedPatient?: string) {
  if (!updatedPatient) return slotApiPath(slotId, "patient-context");

  const query = new URLSearchParams({ updatedPatient });
  return slotApiPath(slotId, "patient-context", query);
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function patientProfile(context: PatientContext): PatientProfile {
  const patient = context.patient ?? {};

  return {
    dob: textValue(patient.birthDate),
    fhirId: textValue(patient.id, textValue(context.patientId)),
    gender: textValue(patient.gender),
    name: patientName(patient.name),
  };
}

function patientName(value: unknown) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const record = recordValue(entry);
      if (!record) continue;

      const text = stringValue(record.text);
      if (text) return text;

      const given = Array.isArray(record.given) ? record.given.filter((item): item is string => typeof item === "string") : [];
      const family = stringValue(record.family);
      const assembled = [...given, family].filter(Boolean).join(" ");
      if (assembled) return assembled;
    }
  }

  if (typeof value === "string" && value.length > 0) return value;
  return "Unknown patient";
}

function patientInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "PT";
}

function errorMessage(context: PatientContext) {
  return stringValue(context.error) ?? "Patient context could not be loaded.";
}

function textValue(value: unknown, fallback = "Unavailable") {
  return stringValue(value) ?? fallback;
}

function stringValue(value: unknown) {
  if (typeof value === "number") return String(value);
  return typeof value === "string" && value.length > 0 ? value : null;
}

function frameworkEventName(value: unknown): string | null {
  const record = recordValue(value);
  if (!record) return null;

  const explicitName =
    stringValue(record.eventName) ??
    stringValue(record.name) ??
    stringValue(record.event) ??
    stringValue(record.contextEvent) ??
    nestedFrameworkEventName(record);

  if (explicitName) return explicitName;

  const type = stringValue(record.type);
  if (type === "embeddedAppAPIMessage") return null;
  return type;
}

function nestedFrameworkEventName(record: Record<string, unknown>) {
  for (const key of ["context", "data", "detail", "payload"]) {
    const eventName = frameworkEventName(record[key]);
    if (eventName) return eventName;
  }

  return null;
}

function isPatientContextChangeEvent(eventName: string, value: unknown) {
  const normalizedEventName = eventName.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (
    normalizedEventName === "patientcontextchanged" ||
    normalizedEventName === "patientcontextchange" ||
    normalizedEventName === "patientchanged" ||
    normalizedEventName === "patientchange"
  ) {
    return true;
  }

  return (
    (normalizedEventName === "contextchanged" || normalizedEventName === "contextchange") &&
    patientIdentifierFromMessage(value) !== null
  );
}

function patientIdentifierFromMessage(value: unknown, depth = 0): string | null {
  if (depth > 4) return null;

  const record = recordValue(value);
  if (!record) return null;

  const directIdentifier =
    stringValue(record.patientId) ??
    stringValue(record.patientID) ??
    stringValue(record.patientIdentifier) ??
    stringValue(record.fhirPatientId) ??
    stringValue(record.updatedPatient) ??
    patientIdentifierFromPatientRecord(record.updatedPatient) ??
    patientIdentifierFromPatientRecord(record.patient);

  if (directIdentifier) return directIdentifier;

  for (const key of ["context", "data", "detail", "payload"]) {
    const nestedIdentifier = patientIdentifierFromMessage(record[key], depth + 1);
    if (nestedIdentifier) return nestedIdentifier;
  }

  return null;
}

function patientIdentifierFromPatientRecord(value: unknown) {
  const patient = recordValue(value);
  if (!patient) return null;

  return stringValue(patient.id) ?? stringValue(patient.patientId) ?? stringValue(patient.patientIdentifier);
}

function recordValue(value: unknown) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
