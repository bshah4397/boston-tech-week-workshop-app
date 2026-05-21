import { Bell, CheckCircle2, ChevronsRight, Minimize2, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import type { SlotAppProps, SlotConfig } from "../../slot-types";
import { sendEmbeddedAppMessage } from "./post-message";

export const slotConfig: SlotConfig = {
  description: "Workshop participant slot",
  slotId: "app-101",
  title: "Visit Prep Sidecar",
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
    label: "Vitals review due",
    nextSteps: [
      "Open the latest vitals trend.",
      "Confirm whether repeat blood pressure is needed.",
      "Document follow-up plan before closing the encounter.",
    ],
    rationale: "The most recent blood pressure is elevated and should be reviewed before the visit closes.",
    text: "Last BP is elevated. Open details before closing the encounter.",
  },
  {
    activeCareGap: false,
    label: "Medication reconciliation",
    nextSteps: ["Review active medication list.", "Confirm discontinued medications."],
    rationale: "Medication history may need cleanup before the encounter is signed.",
    text: "Confirm adherence and update discontinued medications.",
  },
  {
    activeCareGap: false,
    label: "Referral follow-up",
    nextSteps: ["Check referral status.", "Confirm cardiology appointment timing."],
    rationale: "Referral status should be checked while preparing for the visit.",
    text: "Check whether cardiology referral has been scheduled.",
  },
];

export default function App101({ appBasePath, query, route, slotId }: SlotAppProps) {
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
    return <AppError appBasePath={appBasePath} slotId={slotId} />;
  }

  if (route === "demo") {
    return (
      <VisitPrepSidecar
        appBasePath={appBasePath}
        contextLabel="local demo"
        patient={demoPatient}
        showDeveloperEventLog
        slotId={slotId}
        statusLabel="SMART"
      />
    );
  }

  return <PatientContextScreen appBasePath={appBasePath} slotId={slotId} />;
}

function PatientContextScreen({ appBasePath, slotId }: { appBasePath: string; slotId: string }) {
  const [contextState, setContextState] = useState<PatientContextState>({ status: "loading" });

  useEffect(() => {
    let isCurrent = true;

    async function loadPatientContext() {
      try {
        const response = await fetch(`/api/apps/${slotId}/patient-context`, {
          credentials: "include",
          headers: { Accept: "application/json" },
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
      <StatusPanel
        appBasePath={appBasePath}
        detail="Waiting for the slot-scoped patient context endpoint."
        kicker={`${slotId} / patient context`}
        primaryHref={`${appBasePath}/demo`}
        primaryLabel="Open local demo mode"
        slotId={slotId}
        title="Patient Context Loading"
      />
    );
  }

  if (contextState.status === "setup-required") {
    return <SetupRequiredScreen appBasePath={appBasePath} message={contextState.message} slotId={slotId} />;
  }

  if (contextState.status === "failed") {
    return (
      <StatusPanel
        appBasePath={appBasePath}
        detail={contextState.message}
        kicker={`${slotId} / patient context`}
        primaryHref={appBasePath}
        primaryLabel="Retry patient load"
        secondaryHref={`${appBasePath}/demo`}
        secondaryLabel="Open local demo mode"
        slotId={slotId}
        title="Patient Load Failed"
      />
    );
  }

  return (
    <VisitPrepSidecar
      appBasePath={appBasePath}
      contextLabel="patient context"
      developerDetails={<DeveloperDetails context={contextState.context} />}
      patient={contextState.patient}
      slotId={slotId}
      statusLabel="Patient Loaded"
    />
  );
}

function LaunchScreen({ appBasePath, query, slotId }: { appBasePath: string; query: URLSearchParams; slotId: string }) {
  if (!query.get("iss")) {
    return <SetupRequiredScreen appBasePath={appBasePath} message="Athena launch parameters are missing." slotId={slotId} />;
  }

  return (
    <StatusPanel
      appBasePath={appBasePath}
      detail="Athena launch context received."
      kicker={`${slotId} / SMART launch`}
      primaryHref={slotApiPath(slotId, "smart/launch", query)}
      primaryLabel="Continue SMART launch"
      secondaryHref={`${appBasePath}/demo`}
      secondaryLabel="Open local demo mode"
      slotId={slotId}
      title="Launch In Progress"
    />
  );
}

function CallbackScreen({ appBasePath, slotId }: { appBasePath: string; slotId: string }) {
  return (
    <StatusPanel
      appBasePath={appBasePath}
      detail="The server-side callback endpoint handles code exchange."
      extra={
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
      }
      kicker={`${slotId} / SMART callback`}
      primaryHref={`${appBasePath}?smart=1`}
      primaryLabel="Load patient context"
      secondaryHref={`${appBasePath}/demo`}
      secondaryLabel="Open local demo mode"
      slotId={slotId}
      title="Callback Received"
    />
  );
}

function SetupRequiredScreen({ appBasePath, message, slotId }: { appBasePath: string; message: string; slotId: string }) {
  return (
    <StatusPanel
      appBasePath={appBasePath}
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
      slotId={slotId}
      title="Setup Required"
    />
  );
}

function VisitPrepSidecar({
  appBasePath,
  contextLabel,
  developerDetails,
  patient,
  showDeveloperEventLog = false,
  slotId,
  statusLabel,
}: {
  appBasePath: string;
  contextLabel: string;
  developerDetails?: React.ReactNode;
  patient: PatientProfile;
  showDeveloperEventLog?: boolean;
  slotId: string;
  statusLabel: string;
}) {
  const activePrepGap = prepCards.find((card) => card.activeCareGap);
  const [currentPatient, setCurrentPatient] = useState(patient);
  const [developerEventLog, setDeveloperEventLog] = useState<string[]>([]);
  const [selectedPrepGap, setSelectedPrepGap] = useState<(typeof prepCards)[number] | null>(null);
  const [reminderState, setReminderState] = useState<{ gap: (typeof prepCards)[number]; status: "snoozed-athena-update" } | null>(null);

  useEffect(() => {
    setCurrentPatient(patient);
  }, [patient]);

  useEffect(() => {
    let isCurrent = true;

    async function reloadPatientIdentity() {
      try {
        const response = await fetch(`/api/apps/${slotId}/patient-context`, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        const body = (await readJson(response)) as PatientContext;

        if (isCurrent && response.ok) {
          setCurrentPatient(patientProfile(body));
        }
      } catch {
        // Keep the current identity if the launcher context changes before SMART context is reachable.
      }
    }

    function handleFrameworkMessage(event: MessageEvent) {
      console.log("[app-101] received window message", {
        data: event.data,
        origin: event.origin,
      });

      const eventName = frameworkEventName(event.data);
      if (!eventName) return;

      if (showDeveloperEventLog) {
        setDeveloperEventLog((events) => [eventName, ...events].slice(0, 5));
      }

      if (!isPatientContextChangeEvent(eventName, event.data)) return;

      setSelectedPrepGap(null);
      setReminderState(null);

      if (patientIdentifierFromMessage(event.data)) {
        void reloadPatientIdentity();
      }
    }

    window.addEventListener("message", handleFrameworkMessage);

    return () => {
      isCurrent = false;
      window.removeEventListener("message", handleFrameworkMessage);
    };
  }, [showDeveloperEventLog, slotId]);

  function reviewActivePrepGap() {
    if (!activePrepGap) return;

    sendEmbeddedAppMessage("appResize", { newWidth: "600" });
    setSelectedPrepGap(activePrepGap);
  }

  function snoozeForAthenaUpdate() {
    if (!selectedPrepGap) return;

    setReminderState({ gap: selectedPrepGap, status: "snoozed-athena-update" });
    setSelectedPrepGap(null);
    sendEmbeddedAppMessage("appMinimize");
  }

  function bringPrepBack() {
    sendEmbeddedAppMessage("appReopen");

    if (reminderState) {
      setSelectedPrepGap(reminderState.gap);
      setReminderState(null);
    }
  }

  function markReviewed() {
    sendEmbeddedAppMessage("appClearBadge");
    setReminderState(null);
    setSelectedPrepGap(null);
  }

  return (
    <main className="sidecar-shell">
      <section className="sidecar-card" aria-labelledby="sidecar-title">
        <header className="sidecar-titlebar">
          <div>
            <p className="slot-kicker">
              {slotId} / {contextLabel}
            </p>
            <h1 id="sidecar-title">Visit Prep Sidecar</h1>
          </div>
          <span>{statusLabel}</span>
        </header>

        <section className="patient-strip" aria-label="Patient identity">
          <strong>{currentPatient.name}</strong>
          <span>DOB {currentPatient.dob}</span>
          <span>FHIR ID {currentPatient.fhirId}</span>
          <span>{currentPatient.gender}</span>
        </section>

        {developerDetails}
        {showDeveloperEventLog ? <DeveloperEventLog events={developerEventLog} /> : null}

        {selectedPrepGap ? (
          <section className="prep-card active" aria-label="Active gap details">
            <span className="slot-kicker">Active care gap</span>
            <h2>{selectedPrepGap.label}</h2>
            <h3>Rationale</h3>
            <p>{selectedPrepGap.rationale}</p>
            <h3>Next steps</h3>
            <ul>
              {selectedPrepGap.nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
            <div className="action-grid">
              <button type="button" onClick={snoozeForAthenaUpdate}>
                <Minimize2 aria-hidden="true" size={16} />
                Snooze while I update Athena
              </button>
            </div>
          </section>
        ) : reminderState ? (
          <section className="prep-card active" aria-label="Reminder state">
            <span className="slot-kicker">Reminder pending</span>
            <h2>{reminderState.gap.label}</h2>
            <div aria-live="polite">
              <p>Reminder saved while Athena is updated.</p>
              <p>{reminderState.gap.label} remains ready for follow-up.</p>
            </div>
          </section>
        ) : (
          <section className="prep-list" aria-label="Visit prep cards">
            {prepCards.map((card) => (
              <article className={`prep-card ${card.activeCareGap ? "active" : "default"}`} key={card.label}>
                {card.activeCareGap ? <span className="slot-kicker">Active care gap</span> : null}
                <h2>{card.label}</h2>
                <p>{card.text}</p>
              </article>
            ))}
          </section>
        )}

        <section className="action-grid" aria-label="Clinical actions">
          {activePrepGap ? (
            <button type="button" onClick={() => sendEmbeddedAppMessage("appShowBadgePersistent")}>
              <Bell aria-hidden="true" size={16} />
              Flag for review
            </button>
          ) : null}
          <button type="button" onClick={reviewActivePrepGap}>
            <ChevronsRight aria-hidden="true" size={16} />
            Review details
          </button>
          <button type="button" onClick={() => sendEmbeddedAppMessage("appMinimize")}>
            <Minimize2 aria-hidden="true" size={16} />
            Snooze
          </button>
          <button type="button" onClick={bringPrepBack}>
            <RotateCcw aria-hidden="true" size={16} />
            Bring prep back
          </button>
          <button type="button" onClick={markReviewed}>
            <CheckCircle2 aria-hidden="true" size={16} />
            Mark reviewed
          </button>
        </section>

        <footer className="slot-footer">
          <a href={slotApiPath(slotId, "smart/launch")}>SMART launch API</a>
          <a href={slotApiPath(slotId, "smart/callback")}>SMART callback API</a>
          <a href={`${appBasePath}/logout-complete`}>Logout redirect</a>
        </footer>
      </section>
    </main>
  );
}

function DeveloperDetails({ context }: { context: PatientContext }) {
  const patient = context.patient ?? {};

  return (
    <details>
      <summary>Developer details</summary>
      <dl>
        <div>
          <dt>Source</dt>
          <dd>{textValue(context.source)}</dd>
        </div>
        <div>
          <dt>FHIR server</dt>
          <dd>{textValue(context.serverUrl)}</dd>
        </div>
        <div>
          <dt>FHIR user</dt>
          <dd>{textValue(context.fhirUser)}</dd>
        </div>
        <div>
          <dt>Patient resource</dt>
          <dd>{textValue(patient.resourceType)}</dd>
        </div>
      </dl>
    </details>
  );
}

function DeveloperEventLog({ events }: { events: string[] }) {
  return (
    <section className="prep-card default" aria-label="Developer event log">
      <span className="slot-kicker">Developer event log</span>
      {events.length > 0 ? (
        <ol>
          {events.map((eventName, index) => (
            <li key={`${eventName}-${index}`}>{eventName}</li>
          ))}
        </ol>
      ) : (
        <p>No framework events received.</p>
      )}
    </section>
  );
}

function StatusPanel({
  appBasePath,
  detail,
  extra,
  kicker,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  slotId,
  title,
}: {
  appBasePath: string;
  detail: string;
  extra?: React.ReactNode;
  kicker: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  slotId: string;
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
        <footer className="slot-footer">
          <a href={slotApiPath(slotId, "smart/launch")}>SMART launch API</a>
          <a href={slotApiPath(slotId, "smart/callback")}>SMART callback API</a>
          <a href={`${appBasePath}/logout-complete`}>Logout redirect</a>
        </footer>
      </section>
    </main>
  );
}

function LogoutCompleteScreen({ appBasePath, slotId }: { appBasePath: string; slotId: string }) {
  return (
    <StatusPanel
      appBasePath={appBasePath}
      detail="The Athena logout flow has returned to this workshop app slot."
      kicker={`${slotId} / post-logout redirect`}
      primaryHref={`${appBasePath}/demo`}
      primaryLabel="Open local demo mode"
      slotId={slotId}
      title="Logout Complete"
    />
  );
}

function AppError({ appBasePath, slotId }: { appBasePath: string; slotId: string }) {
  return (
    <StatusPanel
      appBasePath={appBasePath}
      detail="This workshop slot supports home, demo, launch, callback, and logout-complete routes."
      kicker="Unknown app route"
      primaryHref={`${appBasePath}/demo`}
      primaryLabel="Open demo"
      slotId={slotId}
      title="Route Not Found"
    />
  );
}

function slotApiPath(slotId: string, path: "patient-context" | "smart/callback" | "smart/launch", query?: URLSearchParams) {
  const search = query?.toString();
  return `/api/apps/${slotId}/${path}${search ? `?${search}` : ""}`;
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
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      const text = stringValue(record.text);
      if (text) return text;
      const given = Array.isArray(record.given) ? record.given.filter((item): item is string => typeof item === "string") : [];
      const family = stringValue(record.family);
      const assembled = [...given, family].filter(Boolean).join(" ");
      if (assembled) return assembled;
    }
  }

  return "Unknown patient";
}

function errorMessage(context: PatientContext) {
  return stringValue(context.error) ?? "Patient context could not be loaded.";
}

function textValue(value: unknown, fallback = "Unavailable") {
  return stringValue(value) ?? fallback;
}

function stringValue(value: unknown) {
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
  const isChangeEvent = normalizedEventName.includes("change");

  if (!isChangeEvent) return false;
  if (normalizedEventName.includes("patient")) return true;

  return normalizedEventName.includes("context") && patientIdentifierFromMessage(value) !== null;
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
