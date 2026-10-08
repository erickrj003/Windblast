---
paths:
  - "apps/web/src/lib/storage/**"
  - "apps/web/src/service-worker.ts"
  - "apps/web/src/service-worker/**"
  - "apps/web/static/manifest.webmanifest"
---

# Local storage and offline support

All user data lives in the browser. Browsers can clear it, so every feature here assumes data loss is possible and gives the user a way out (export).

## IndexedDB via Dexie 4

- `apps/web/src/lib/storage/db.ts` is the **only** module that imports Dexie. Components and state classes call its typed functions.
- Tables: `parties`, `encounters`, `creatures`, `runs`, `settings`, `flags` (rules-review notes saved from the AI reasoning view, each pointing at a run, trial and event index). Every record has `schemaVersion` and `dataVersion`.
- Schema changes add a new `db.version(n).stores(…).upgrade(…)`. Never edit an existing version block.
- Every upgrade ships with a test that loads a fixture from the previous version and checks the migrated record.
- Wrap writes to catch `QuotaExceededError` (and Dexie's equivalent) and return a `Result`; the UI offers export when it happens.
- Keep at most 200 run summaries; delete the oldest first and tell the user.

## Persistence and export

- Call `navigator.storage.persist()` the first time the user saves anything; show the result and `navigator.storage.estimate()` in Settings.
- Export: one JSON file `{ app: 'inazria-simulator', schemaVersion, dataVersion, exportedAt, records }`.
- Import: validate with Valibot, migrate older schema versions, show a preview (added / changed / skipped), then merge or replace on confirmation.

## Service worker

- Hand-written using SvelteKit 3's built-in service worker support. Look up the current module names first: SvelteKit 3 removed `$service-worker`; its exports moved to `$app/env`, `$app/manifest` and `$app/paths`, and the worker needs its own TypeScript project extending `$app/tsconfig/service-worker`.
- Do not add `@vite-pwa/sveltekit`; it does not support SvelteKit 3.
- Strategy: precache the build output and compiled rules data on install; network-first for HTML; cache-first for hashed assets; delete old caches on activate.
- When a new version is waiting, show an "Update available" prompt. Never reload while a simulation is running.
- Ship a web app manifest so the app is installable (installed apps are exempt from Safari's seven-day storage cleanup).
- Large optional files (exported trial rows, replays) go to the Origin Private File System, never to IndexedDB blobs.
