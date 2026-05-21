import type { SlotAppProps, SlotConfig } from "../slot-types";

export const slotConfig: SlotConfig = {
  description: "Template source for participant workshop slots.",
  slotId: "app-template",
  title: "Visit Prep Sidecar Template",
};

const patient = {
  dob: "04/12/1975",
  fhirId: "12345",
  gender: "female",
  name: "Alex Rivers",
};

const prepCards = [
  {
    label: "Vitals review due",
    tone: "default",
    text: "Last BP is elevated. Open details before closing the encounter.",
  },
  {
    label: "Medication reconciliation",
    tone: "default",
    text: "Confirm adherence and update discontinued medications.",
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
    return <CallbackScreen appBasePath={appBasePath} query={query} />;
  }

  if (route === "unknown") {
    return <AppError appBasePath={appBasePath} />;
  }

  return <VisitPrepDemo slotId={slotId} />;
}

function LaunchScreen({ appBasePath, query, slotId }: { appBasePath: string; query: URLSearchParams; slotId: string }) {
  const launch = query.get("launch");
  const issuer = query.get("iss");

  return (
    <main className="slot-shell">
      <section className="slot-panel launch-panel">
        <p className="slot-kicker">{slotId} / SMART launch</p>
        <h1>Launch Route Ready</h1>
        <p>
          This template route is intentionally thin. The participant prompt upgrades this file with
          the SMART authorization behavior for the assigned app slot.
        </p>
        <dl>
          <div>
            <dt>Issuer</dt>
            <dd>{issuer || "Missing iss query parameter"}</dd>
          </div>
          <div>
            <dt>Launch</dt>
            <dd>{launch || "Missing launch query parameter"}</dd>
          </div>
        </dl>
        <a className="slot-primary-action" href={`${appBasePath}/demo`}>
          Open local demo mode
        </a>
      </section>
    </main>
  );
}

function CallbackScreen({ appBasePath, query }: { appBasePath: string; query: URLSearchParams }) {
  const hasCode = Boolean(query.get("code"));
  const hasState = Boolean(query.get("state"));

  return (
    <main className="slot-shell">
      <section className="slot-panel launch-panel">
        <p className="slot-kicker">SMART callback</p>
        <h1>Callback Route Ready</h1>
        <p>
          Authorization codes and token material are never displayed in this workshop UI. This page
          only confirms whether callback parameters arrived.
        </p>
        <dl>
          <div>
            <dt>Authorization code</dt>
            <dd>{hasCode ? "Present" : "Missing"}</dd>
          </div>
          <div>
            <dt>State</dt>
            <dd>{hasState ? "Present" : "Missing"}</dd>
          </div>
        </dl>
        <a className="slot-primary-action" href={`${appBasePath}/demo`}>
          Continue to demo
        </a>
      </section>
    </main>
  );
}

function VisitPrepDemo({ slotId }: { slotId: string }) {
  return (
    <main className="sidecar-shell">
      <section className="sidecar-card" aria-labelledby="sidecar-title">
        <header className="sidecar-titlebar">
          <div>
            <p className="slot-kicker">{slotId}</p>
            <h1 id="sidecar-title">Visit Prep</h1>
          </div>
          <span>Local Demo</span>
        </header>

        <section className="patient-banner" aria-label="Patient identity">
          <span className="patient-avatar" aria-hidden="true">
            AR
          </span>
          <div>
            <strong>{patient.name}</strong>
            <span>DOB {patient.dob}</span>
            <span>FHIR ID {patient.fhirId}</span>
            <span>{patient.gender}</span>
          </div>
        </section>

        <section className="prep-list" aria-label="Visit prep cards">
          {prepCards.map((card) => (
            <article className={`prep-card ${card.tone}`} key={card.label}>
              <h2>{card.label}</h2>
              <p>{card.text}</p>
            </article>
          ))}
        </section>
      </section>
    </main>
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
