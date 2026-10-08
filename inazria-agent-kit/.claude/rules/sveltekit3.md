---
paths:
  - "apps/web/**"
---

# SvelteKit 3 (static build)

SvelteKit 3.0 shipped in October 2026, after most model training data. Assume your memory of SvelteKit is for version 2 and **check every API against the current docs** via the Svelte MCP server or https://svelte.dev/docs/kit/migrating-to-sveltekit-3.

## SvelteKit 2 habits that are wrong here

| Wrong (SvelteKit 2) | Right (SvelteKit 3) |
| --- | --- |
| `svelte.config.js` | Options go in the `sveltekit({ … })` plugin in `vite.config.ts`; former `config.kit.*` options are top-level plugin options |
| `$lib/...` imports | `#lib/...` declared in `package.json` `imports`, **with file extensions** (`#lib/state/party.svelte.ts`) |
| `$app/stores` | `$app/state` (no `$` prefix; `page.url` is read-only) |
| `$app/environment` | `$app/env` |
| `$service-worker` | Exports moved to `$app/env`, `$app/manifest` and `$app/paths`; the service worker has its own TypeScript project extending `$app/tsconfig/service-worker` |
| `$env/static/public` and friends | `$app/env/public` / `$app/env/private` (avoid private env entirely: this is a static site) |
| `base` from `$app/paths` | Removed; use the current path helpers from the docs |
| Extending `.svelte-kit/tsconfig.json` | Extend `$app/tsconfig` and set `include` / `exclude` |
| `goto(url, { invalidateAll, replaceState, noScroll, keepFocus })` | `goto(url, { refreshAll, replace, reset: false })` |
| `src/params/*.ts` matchers | One `src/params.ts` using `defineParams` (we should not need params; see below) |

## Static-site rules

- Adapter: `@sveltejs/adapter-static` 4 with `pages: 'build'`, `assets: 'build'`, `fallback: '404.html'`, `strict: true`.
- Root layout exports `prerender = true`. Never set `ssr = false` globally (prerendering would emit empty shells).
- **No request-time server code.** No `+server.ts` endpoints, no form actions, no remote functions, no `hooks.server.ts`. Build-time `load` functions that read bundled data are fine.
- GitHub Pages serves the site under a sub-path. Configure the base path from the `BASE_PATH` environment variable set in the deploy workflow, following the current adapter-static docs, and use SvelteKit's path helpers for every internal link and asset URL. Never hard-code `/`-rooted URLs.

## One workspace route

The app lives on **one route, `/`**, plus `/legal` for the SRD attribution. Do not add routes; a new screen is a mode, panel, drawer or dialog in the workspace. Adding a route needs a decision record.

- Modes: `build`, `play`, `simulate`, `review`. The grid component is mounted once and never unmounts when the mode changes.
- **URL state lives in the query string**, read and written only through `#lib/workspace/workspace-url.ts`:
  - `/?mode=build&enc=<id>`, `/?mode=review&run=<id>&trial=<n>`.
  - Parse with a Valibot schema; invalid or missing values fall back to `mode=build`.
  - Read via `page.url.searchParams` from `$app/state` (read-only in SvelteKit 3).
  - Write with `goto(…)` from `$app/navigation`. A mode change adds a history entry; opening a panel or dialog does not touch the URL. SvelteKit 3 deprecated `pushState`/`replaceState` and changed `goto` options (`replace`, `reset`, `shallow`), so check the current docs for the exact options before writing this module.
- Heavy features load on first use with dynamic `import()`: the `@inazria/sim` worker pool (first Simulate), LayerChart (first results), the homebrew editor (first open), the AI reasoning view (first opened with "Show AI reasoning" on). PixiJS loads with the workspace because the grid is visible immediately.

## Structure

```text
apps/web/src/
├── routes/
│   ├── +layout.svelte, +layout.ts   (prerender = true)
│   ├── +page.svelte                 the workspace
│   └── legal/+page.svelte
├── lib/
│   ├── workspace/     workspace-url.ts, mode state, layout regions (top bar, panels, drawer)
│   ├── components/    panels, dialogs, grid wrapper, charts
│   ├── state/         *.svelte.ts state classes
│   ├── storage/       db.ts (Dexie) — the only module that touches IndexedDB
│   └── sim/           thin wrapper that lazily creates the @inazria/sim worker pool
├── service-worker.ts
└── app.html
```
