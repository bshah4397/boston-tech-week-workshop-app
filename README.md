# Boston Tech Week App Host

Draft shared app-host repo for the Embedded Apps workshop.

This repo is intentionally separate from `workshop-guide`. The guide explains the workshop. This repo hosts the participant app slots.

## Slot Contract

The URL contract is:

- `/app-001` through `/app-099` for participant slots
- `/app-101` and above for internal dry runs
- `/app-XXX/demo` for local demo mode
- `/api/apps/app-XXX/smart/launch` for the Athena SMART launch URL
- `/api/apps/app-XXX/smart/callback` for the Athena post-login redirect URL
- `/app-XXX/logout-complete` for the Athena post-logout redirect URL
- `/api/apps/app-XXX/patient-context` for server-side Patient read after SMART callback

The shared source app is:

- `src/app-template`

The template is intentionally outside `src/apps`, so it is not a routable or registered workshop slot until it is copied into a numeric app folder.

## Adding A Slot

Copy the template into the assigned slot folder:

```txt
src/apps/app-007/
  index.tsx
  post-message.ts
```

Then update `src/apps/app-007/index.tsx`:

- Set `slotConfig.slotId` to `"app-007"`.
- Set `slotConfig.description` to the participant or test-slot label.
- Keep all edits inside the assigned slot folder.

The root host discovers `src/apps/app-*/index.tsx` automatically. Participants should only edit their assigned folder.

## Athena Registration URLs

For a deployed host like `https://boston-tech-week-app-host.vercel.app`, register each slot with URLs like:

```txt
Preview launch URL
https://boston-tech-week-app-host.vercel.app/api/apps/app-007/smart/launch

Post-login redirect URL
https://boston-tech-week-app-host.vercel.app/api/apps/app-007/smart/callback

Post-logout redirect URL
https://boston-tech-week-app-host.vercel.app/app-007/logout-complete
```

Each registered Athena app needs its own client ID. Configure public slot client IDs in `api/_lib/workshop-config.ts`:

```ts
export const WORKSHOP_SLOT_CLIENT_IDS: Record<string, string> = {
  "app-007": "<client id for app-007>",
  "app-101": "<client id for app-101>",
};
```

The app is designed to deploy to Vercel without project-level environment variables. Client IDs are public identifiers, not client secrets, so keeping the workshop mapping in repo config keeps the deployment workflow simple.

Each slot module must export:

```ts
export const slotConfig = {
  slotId: "app-007",
  title: "My Workshop App",
  description: "Participant slot",
};

export default function App007(props) {
  return <main>...</main>;
}
```

## Boundaries

The root app owns only:

- slot discovery
- URL routing
- Vercel SPA rewrites
- missing-slot fallback screens

Each slot owns its own:

- SMART launch UI behavior
- callback UI behavior
- postMessage helper
- UI components
- clinical/demo content

The shared API layer owns:

- SMART authorization redirect
- callback code exchange
- slot-specific encrypted launch/session cookies
- server-side FHIR Patient read

## Commands

```bash
npm install
npm run dev -- --port 5174
npm test
npm run build
```

## Notes

This is a draft workshop host. The shared API routes perform the SMART redirect/callback/session shape needed for Athena registration, while the template UI still starts as a lightweight demo shell that workshop prompts can customize.
