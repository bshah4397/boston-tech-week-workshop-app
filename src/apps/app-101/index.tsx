import { useEffect, useState } from "react";
import type { SlotAppProps, SlotConfig } from "../../slot-types";
import { sendEmbeddedAppMessage } from "./post-message";

export const slotConfig: SlotConfig = {
  description: "Workshop participant slot",
  slotId: "app-101",
  title: "Visit Prep Sidecar",
};

const patient = {
  dob: "04/12/1975",
  fhirId: "12345",
  gender: "female",
  name: "Alex Rivers",
};

type PatientSummary = {
  dob: string;
  fhirId: string;
  gender: string;
  name: string;
};

type PatientContextResponse = {
  patient?: unknown;
  patientId?: string | null;
};

type SmartState = "callback received" | "patient loaded" | "patient load failed";

const prepCards = [
  {
    label: "Vitals review due",
    tone: "default",
    text: "Latest vitals are available for review before the encounter.",
  },
  {
    label: "Medication reconciliation",
    tone: "default",
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

  if (route === "demo") {
    return <VisitPrepDemo slotId={slotId} stateLabel="Local Demo" />;
  }

  return <SmartVisitPrep appBasePath={appBasePath} query={query} slotId={slotId} />;
}

function LaunchScreen({ appBasePath, query, slotId }: { appBasePath: string; query: URLSearchParams; slotId: string }) {
  const launch = query.get("launch");
  const issuer = query.get("iss");
  const launchHref = smartLaunchApiPath(slotId, query);

  if (!launch || !issuer) {
    return (
      <main className="slot-shell">
        <section className="slot-panel launch-panel">
          <p className="slot-kicker">Setup required</p>
          <h1>Setup Required</h1>
          <p>A SMART launch must include both issuer and launch context before this sidecar can continue.</p>
          <dl>
            <div>
              <dt>Launch URL</dt>
              <dd>{`/api/apps/${slotId}/smart/launch`}</dd>
            </div>
            <div>
              <dt>Post-login redirect</dt>
              <dd>{`/api/apps/${slotId}/smart/callback`}</dd>
            </div>
            <div>
              <dt>Post-logout redirect</dt>
              <dd>{`${appBasePath}/logout-complete`}</dd>
            </div>
          </dl>
          <a className="slot-primary-action" href={`${appBasePath}/demo`}>
            Open local demo mode
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="slot-shell">
      <section className="slot-panel launch-panel">
        <p className="slot-kicker">Launch in progress</p>
        <h1>Launch In Progress</h1>
        <p>Continue through the slot-scoped SMART launch API to complete Athena authorization.</p>
        <dl>
          <div>
            <dt>Issuer</dt>
            <dd>{issuer}</dd>
          </div>
          <div>
            <dt>Launch</dt>
            <dd>{launch}</dd>
          </div>
          <div>
            <dt>Launch API</dt>
            <dd>{`/api/apps/${slotId}/smart/launch`}</dd>
          </div>
        </dl>
        <a className="slot-primary-action" href={launchHref}>
          Continue SMART launch
        </a>
      </section>
    </main>
  );
}

function CallbackScreen({ appBasePath, slotId }: { appBasePath: string; slotId: string }) {
  return (
    <main className="slot-shell">
      <section className="slot-panel launch-panel">
        <p className="slot-kicker">Callback received</p>
        <h1>Callback Received</h1>
        <p>The app host has received the SMART callback route. Sensitive callback values are handled by the server API.</p>
        <dl>
          <div>
            <dt>Post-login redirect</dt>
            <dd>{`/api/apps/${slotId}/smart/callback`}</dd>
          </div>
          <div>
            <dt>Patient context</dt>
            <dd>{patientContextApiPath(slotId)}</dd>
          </div>
        </dl>
        <a className="slot-primary-action" href={`${appBasePath}/demo`}>
          Continue to demo
        </a>
      </section>
    </main>
  );
}

function SmartVisitPrep({ appBasePath, query, slotId }: { appBasePath: string; query: URLSearchParams; slotId: string }) {
  const [state, setState] = useState<SmartState>("callback received");
  const [patientSummary, setPatientSummary] = useState<PatientSummary | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPatientContext() {
      try {
        const response = await fetch(patientContextApiPath(slotId), {
          headers: { Accept: "application/json" },
          method: "GET",
        });

        if (!response.ok) {
          throw new Error("Patient context unavailable");
        }

        const context = (await response.json()) as PatientContextResponse;
        const summary = patientSummaryFromContext(context);
        if (!summary) {
          throw new Error("Patient context missing patient details");
        }

        if (isMounted) {
          setPatientSummary(summary);
          setState("patient loaded");
        }
      } catch {
        if (isMounted) {
          setPatientSummary(null);
          setState("patient load failed");
        }
      }
    }

    loadPatientContext();

    return () => {
      isMounted = false;
    };
  }, [slotId]);

  if (state === "patient loaded" && patientSummary) {
    return <VisitPrepDemo patientSummary={patientSummary} slotId={slotId} />;
  }

  return (
    <main className="slot-shell">
      <section className="slot-panel launch-panel">
        <p className="slot-kicker">{stateLabel(state)}</p>
        <h1>{state === "callback received" ? "Callback Received" : "Patient Context Unavailable"}</h1>
        <p>
          {state === "callback received"
            ? "The callback is complete. Loading patient context from the slot-scoped API."
            : "Patient context could not be loaded for this slot. Local demo mode is still available."}
        </p>
        <dl>
          <div>
            <dt>Patient context API</dt>
            <dd>{patientContextApiPath(slotId)}</dd>
          </div>
          <div>
            <dt>Post-login redirect</dt>
            <dd>{`/api/apps/${slotId}/smart/callback`}</dd>
          </div>
        </dl>
        <a className="slot-primary-action" href={`${appBasePath}/demo`}>
          Open local demo mode
        </a>
      </section>
    </main>
  );
}

function VisitPrepDemo({
  patientSummary = patient,
  slotId,
  stateLabel,
}: {
  patientSummary?: PatientSummary;
  slotId: string;
  stateLabel?: string;
}) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  function openDetails() {
    sendEmbeddedAppMessage("appResize", { newWidth: "600" });
    setIsDetailOpen(true);
  }

  function collapseDetails() {
    sendEmbeddedAppMessage("appResize", { newWidth: "400" });
    setIsDetailOpen(false);
  }

  return (
    <main className="sidecar-shell">
      <section className="sidecar-card" aria-labelledby="sidecar-title">
        <header className="sidecar-titlebar">
          <div>
            <p className="slot-kicker">{slotId}</p>
            <h1 id="sidecar-title">Visit Prep</h1>
          </div>
          {stateLabel ? <span>{stateLabel}</span> : null}
        </header>

        <PatientBanner patientSummary={patientSummary} />

        {isDetailOpen ? <VitalsDetailPanel onCollapse={collapseDetails} /> : <PrepCardList onOpenDetails={openDetails} />}
      </section>
    </main>
  );
}

function PrepCardList({ onOpenDetails }: { onOpenDetails: () => void }) {
  return (
    <section className="prep-list" aria-label="Visit prep cards">
      {prepCards.map((card) => (
        <article className={`prep-card ${card.tone}`} key={card.label}>
          <h2>{card.label}</h2>
          <p>{card.text}</p>
          {card.label === "Vitals review due" ? (
            <button className="slot-primary-action" onClick={onOpenDetails} type="button">
              Open details
            </button>
          ) : null}
        </article>
      ))}
    </section>
  );
}

function VitalsDetailPanel({ onCollapse }: { onCollapse: () => void }) {
  return (
    <section className="prep-list" aria-label="Review details panel">
      <article className="prep-card default">
        <h2>Review details</h2>
        <h3>Rationale</h3>
        <p>Vitals are ready to compare with the current visit context before the encounter continues.</p>
        <h3>Next steps</h3>
        <p>Review the latest values, confirm whether follow-up is needed, then return to the compact prep list.</p>
        <button className="slot-primary-action" onClick={onCollapse} type="button">
          Collapse details
        </button>
      </article>
    </section>
  );
}

function PatientBanner({ patientSummary }: { patientSummary: PatientSummary }) {
  return (
    <section className="patient-banner" aria-label="Patient identity">
      <span className="patient-avatar" aria-hidden="true">
        {patientInitials(patientSummary.name)}
      </span>
      <div>
        <strong>{patientSummary.name}</strong>
        <span>DOB {patientSummary.dob}</span>
        <span>FHIR ID {patientSummary.fhirId}</span>
        <span>{patientSummary.gender}</span>
      </div>
    </section>
  );
}

function LogoutCompleteScreen({ appBasePath, slotId }: { appBasePath: string; slotId: string }) {
  return (
    <main className="slot-shell">
      <section className="slot-panel launch-panel">
        <p className="slot-kicker">{slotId} / post-logout redirect</p>
        <h1>Logout Complete</h1>
        <p>The Athena logout flow has returned to this workshop app slot.</p>
        <a className="slot-primary-action" href={`${appBasePath}/demo`}>
          Open local demo mode
        </a>
      </section>
    </main>
  );
}

function AppError({ appBasePath }: { appBasePath: string }) {
  return (
    <main className="slot-shell">
      <section className="slot-panel launch-panel">
        <p className="slot-kicker">Unknown app route</p>
        <h1>Route Not Found</h1>
        <p>This workshop slot supports home, demo, launch, callback, and logout-complete routes.</p>
        <a className="slot-primary-action" href={`${appBasePath}/demo`}>
          Open demo
        </a>
      </section>
    </main>
  );
}

export function patientContextApiPath(slotId: string, updatedPatient?: string) {
  if (!updatedPatient) return `/api/apps/${slotId}/patient-context`;

  const query = new URLSearchParams({ updatedPatient });
  return `/api/apps/${slotId}/patient-context?${query}`;
}

function smartLaunchApiPath(slotId: string, query: URLSearchParams) {
  const launchQuery = new URLSearchParams();
  const issuer = query.get("iss");
  const launch = query.get("launch");
  if (issuer) launchQuery.set("iss", issuer);
  if (launch) launchQuery.set("launch", launch);

  const queryString = launchQuery.toString();
  return `/api/apps/${slotId}/smart/launch${queryString ? `?${queryString}` : ""}`;
}

function stateLabel(state: SmartState) {
  if (state === "patient loaded") return "Patient loaded";
  if (state === "patient load failed") return "Patient load failed";
  return "Callback received";
}

function patientSummaryFromContext(context: PatientContextResponse): PatientSummary | null {
  if (!isRecord(context.patient)) return null;

  return {
    dob: stringValue(context.patient.birthDate) || "Unknown",
    fhirId: stringValue(context.patient.id) || stringValue(context.patientId) || "Unknown",
    gender: stringValue(context.patient.gender) || "Unknown",
    name: patientName(context.patient) || "Unknown patient",
  };
}

function patientName(patientResource: Record<string, unknown>) {
  if (typeof patientResource.name === "string") return patientResource.name;
  if (!Array.isArray(patientResource.name)) return null;

  const primaryName = patientResource.name.find(isRecord);
  if (!primaryName) return null;

  const given = Array.isArray(primaryName.given) ? primaryName.given.filter((value): value is string => typeof value === "string") : [];
  const family = stringValue(primaryName.family);
  return [...given, family].filter(Boolean).join(" ") || null;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}
