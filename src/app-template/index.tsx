import { Bell, CheckCircle2, ChevronsRight, Minimize2, RotateCcw } from "lucide-react";
import type { SlotAppProps, SlotConfig } from "../slot-types";
import { sendEmbeddedAppMessage } from "./post-message";

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
    tone: "active",
    text: "Last BP is elevated. Open details before closing the encounter.",
  },
  {
    label: "Medication reconciliation",
    tone: "default",
    text: "Confirm adherence and update discontinued medications.",
  },
  {
    label: "Referral follow-up",
    tone: "default",
    text: "Check whether cardiology referral has been scheduled.",
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

  return <VisitPrepDemo appBasePath={appBasePath} slotId={slotId} />;
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

function VisitPrepDemo({ appBasePath, slotId }: { appBasePath: string; slotId: string }) {
  return (
    <main className="sidecar-shell">
      <section className="sidecar-card" aria-labelledby="sidecar-title">
        <header className="sidecar-titlebar">
          <div>
            <p className="slot-kicker">{slotId} / local demo</p>
            <h1 id="sidecar-title">Visit Prep Sidecar</h1>
          </div>
          <span>SMART</span>
        </header>

        <section className="patient-strip" aria-label="Patient identity">
          <strong>{patient.name}</strong>
          <span>DOB {patient.dob}</span>
          <span>FHIR ID {patient.fhirId}</span>
          <span>{patient.gender}</span>
        </section>

        <section className="prep-list" aria-label="Visit prep cards">
          {prepCards.map((card) => (
            <article className={`prep-card ${card.tone}`} key={card.label}>
              <h2>{card.label}</h2>
              <p>{card.text}</p>
            </article>
          ))}
        </section>

        <section className="action-grid" aria-label="PostMessage demo actions">
          <button type="button" onClick={() => sendEmbeddedAppMessage("appShowBadgePersistent")}>
            <Bell aria-hidden="true" size={16} />
            Flag for review
          </button>
          <button type="button" onClick={() => sendEmbeddedAppMessage("appResize", { newWidth: "600" })}>
            <ChevronsRight aria-hidden="true" size={16} />
            Review details
          </button>
          <button type="button" onClick={() => sendEmbeddedAppMessage("appMinimize")}>
            <Minimize2 aria-hidden="true" size={16} />
            Snooze
          </button>
          <button type="button" onClick={() => sendEmbeddedAppMessage("appReopen")}>
            <RotateCcw aria-hidden="true" size={16} />
            Bring prep back
          </button>
          <button type="button" onClick={() => sendEmbeddedAppMessage("appClearBadge")}>
            <CheckCircle2 aria-hidden="true" size={16} />
            Mark reviewed
          </button>
        </section>

        <footer className="slot-footer">
          <a href={`/api/apps/${slotId}/smart/launch`}>SMART launch API</a>
          <a href={`/api/apps/${slotId}/smart/callback`}>SMART callback API</a>
          <a href={`${appBasePath}/logout-complete`}>Logout redirect</a>
        </footer>
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
