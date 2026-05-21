import { Copy, ExternalLink, FolderKanban, GitBranch } from "lucide-react";
import { availableSlots, getRoutePathParts, isValidSlotId, slotModules } from "./slot-registry";
import type { SlotRoute } from "./slot-types";

function routeFromSegment(segment: string | undefined): SlotRoute {
  if (!segment) return "home";
  if (segment === "launch" || segment === "callback" || segment === "demo" || segment === "logout-complete") return segment;
  return "unknown";
}

export function App() {
  const pathParts = getRoutePathParts(window.location.pathname);
  const [slotId, routeSegment] = pathParts;

  if (!slotId) {
    return <HostHome />;
  }

  if (!isValidSlotId(slotId)) {
    return <HostError title="Unknown app route" detail={`/${slotId} is not a workshop app slot.`} />;
  }

  const slotModule = slotModules[slotId];
  if (!slotModule) {
    return <MissingSlot slotId={slotId} />;
  }

  const SlotApp = slotModule.default;
  const route = routeFromSegment(routeSegment);

  return (
    <SlotApp
      appBasePath={`/${slotId}`}
      fullPath={window.location.pathname}
      query={new URLSearchParams(window.location.search)}
      route={route}
      slotId={slotId}
    />
  );
}

function HostHome() {
  return (
    <main className="host-shell">
      <section className="host-hero">
        <div>
          <p className="eyebrow">Boston Tech Week</p>
          <h1>Embedded App Workshop Host</h1>
          <p>
            One Vercel project and one deployment pipeline for independent workshop app slots.
            Each participant works inside one assigned folder under <code>src/apps</code>.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#slot-template">
              <Copy aria-hidden="true" size={17} />
              Use slot template
            </a>
            <a className="secondary-link" href="#created-slots">
              <GitBranch aria-hidden="true" size={17} />
              View created slots
            </a>
          </div>
        </div>
        <div className="slot-contract" aria-label="Slot URL contract">
          <div>
            <span>Participant slots</span>
            <strong>/app-001 through /app-099</strong>
          </div>
          <div>
            <span>Internal dry runs</span>
            <strong>/app-101 and above</strong>
          </div>
          <div>
            <span>Template source</span>
            <strong>src/app-template</strong>
          </div>
          <div>
            <span>SMART launch</span>
            <strong>/api/apps/app-XXX/smart/launch</strong>
          </div>
          <div>
            <span>SMART callback</span>
            <strong>/api/apps/app-XXX/smart/callback</strong>
          </div>
          <div>
            <span>Logout redirect</span>
            <strong>/app-XXX/logout-complete</strong>
          </div>
        </div>
      </section>

      <section id="slot-template" className="host-section" aria-labelledby="slot-template-heading">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Source of new apps</p>
            <h2 id="slot-template-heading">Slot Template</h2>
          </div>
          <Copy aria-hidden="true" />
        </div>
        <div className="template-panel">
          <p>
            Copy <code>src/app-template</code> into <code>src/apps/app-XXX</code>, then replace the
            template slot metadata with the assigned app number. The template is not routable until
            it is copied into a numeric app slot.
          </p>
          <pre>{`src/apps/app-007/
  index.tsx
  post-message.ts`}</pre>
        </div>
      </section>

      <section id="created-slots" className="host-section" aria-labelledby="available-slots-heading">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Discovered apps</p>
            <h2 id="available-slots-heading">Created App Slots</h2>
          </div>
          <GitBranch aria-hidden="true" />
        </div>
        {availableSlots.length > 0 ? (
          <div className="slot-grid">
            {availableSlots.map((slot) => (
              <article className="slot-card" key={slot.slotId}>
                <FolderKanban aria-hidden="true" />
                <h3>{slot.slotId}</h3>
                <p>{slot.title}</p>
                <span>{slot.description}</span>
                <a href={`/${slot.slotId}/demo`}>
                  Open demo
                  <ExternalLink aria-hidden="true" size={15} />
                </a>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-slot-list">
            <h3>No app slots created yet</h3>
            <p>Copy src/app-template into src/apps/app-XXX to create the first routable slot.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function MissingSlot({ slotId }: { slotId: string }) {
  return (
    <main className="host-shell centered">
      <section className="empty-state">
        <p className="eyebrow">Slot not created yet</p>
        <h1>{slotId}</h1>
        <p>
          This URL is valid for the workshop, but no app folder has been created at{" "}
          <code>src/apps/{slotId}</code> yet.
        </p>
        <a className="primary-link" href="/">
          Back to app host
        </a>
      </section>
    </main>
  );
}

function HostError({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="host-shell centered">
      <section className="empty-state">
        <p className="eyebrow">Route error</p>
        <h1>{title}</h1>
        <p>{detail}</p>
        <a className="primary-link" href="/">
          Back to app host
        </a>
      </section>
    </main>
  );
}
