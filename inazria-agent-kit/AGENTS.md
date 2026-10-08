# AGENTS.md — Inazria Encounter Simulator

You are building a static, browser-only encounter simulator for **Inazria**, Erick's D&D 5e (SRD 5.1) homebrew. Read this file first in every session, then `docs/PROJECT_STATUS.md`. The full plan is `docs/PLAN.md`; topic rules live in `.claude/rules/` (Cursor gets generated copies in `.cursor/rules/`).

## Project in one paragraph

A pnpm monorepo. `packages/data` holds Valibot schemas and hand-encoded rules content (SRD 5.1 + Inazria) with provenance. `packages/engine` is a pure, deterministic TypeScript rules engine. `packages/sim` runs seeded Monte Carlo batches in Web Workers. `packages/render` draws the PixiJS v8 grid used to build, play and review encounters. `apps/web` is a SvelteKit 3 + Svelte 5 app built to static files with adapter-static and hosted on GitHub Pages. The app is **one workspace route (`/`)** with modes Build, Play, Simulate and Review, plus `/legal`; new screens are panels, drawers or dialogs, not routes. Users can play an encounter turn by turn (controlling some or all creatures) or run Monte Carlo batches with every creature AI-controlled. An optional "Show AI reasoning" setting (off by default) shows the options the tactics AI weighed on each turn, with score terms and rule sources, so Erick can tune work-in-progress rules; it must never change a fight's outcome or slow batch runs. No backend exists or may be added.

## Locked stack (change only via an accepted decision record)

Node 24 LTS · pnpm 12 · **TypeScript 6.0.x (pinned — do not install TypeScript 7)** · Svelte 5 (runes only) · SvelteKit 3 + adapter-static 4 · Vite 8 · PixiJS 8 · Comlink · Valibot · Dexie 4 · LayerChart 2 · Vitest 5 + fast-check · Playwright · ESLint 10 flat config + typescript-eslint + eslint-plugin-svelte · Prettier · svelte-check · Lefthook.

Your training data probably predates SvelteKit 3 (released October 2026), Vite 8, Vitest 5 and ESLint 10. **Never write code for these from memory. Look it up first** (see "Documentation lookup").

## Commands

| Command | What it does |
| --- | --- |
| `pnpm install --frozen-lockfile` | Install exactly what the lockfile says |
| `pnpm dev` | SvelteKit dev server for `apps/web` |
| `pnpm check` | Format check, lint, typecheck (`tsc -b` + `svelte-check`), `data:check`, `rules:check`, unit + property tests with coverage |
| `pnpm verify` | `check` + production build + Playwright e2e + bundle-size check |
| `pnpm bench` | `vitest bench` for engine/sim hot paths vs the saved baseline |
| `pnpm data:pull` | Copy Player's Guide markdown at the pinned commit into `packages/data/vendor/inazria/` |
| `pnpm data:check` | Validate all content against schemas and check provenance hashes |
| `pnpm rules:sync` | Regenerate `.cursor/rules/*.mdc` from `.claude/rules/*.md` (`rules:check` verifies they match) |

## The task loop (always follow it)

1. **Orient:** read this file and `docs/PROJECT_STATUS.md`. Take the first unblocked task in the current phase. None unblocked → stop and report.
2. **Restate** the acceptance criteria in the status file; mark the task `in progress`.
3. **Look up** current docs for every library the task touches.
4. **Test first** for engine, data and sim work. Rules tests carry a source tag, e.g. `[inazria:classes/fighter#resolve-points]` or `[srd51:combat#opportunity-attacks]`.
5. **Implement** only the task. Log unrelated findings as new tasks.
6. **Verify:** `pnpm verify`. For `.svelte` files, run the Svelte MCP `svelte-autofixer` until clean. For engine/sim changes, also `pnpm bench`.
7. **Self-review** (checklist below).
8. **Record:** mark `done` with the commands you ran and their results; add a `docs/CHANGELOG.md` line if users would notice.
9. **Commit** on a task branch with Conventional Commits (`feat(engine): …`, `fix(web): …`, `test(sim): …`, `docs: …`, `chore: …`). Open a PR to `main`. Erick merges.

Keep tasks to one concern and roughly ≤300 changed lines excluding data and tests; split bigger tasks in the status file first.

## Self-review checklist

- [ ] Every rule applied cites a source and has a test.
- [ ] `packages/engine` and `packages/data` import nothing from Svelte, PixiJS, Dexie or the DOM, and use no `Math.random`, `Date.now`, `performance.now`, `crypto`, `window` or `document`.
- [ ] No Svelte 4 syntax; no `$app/stores`, `$app/environment`, `$lib`, `svelte.config.js`.
- [ ] No PixiJS v7 API (`beginFill`, `drawRect`, `lineStyle`, `new Application({...})` without `await app.init(...)`, `app.view`).
- [ ] No new dependency without a decision record.
- [ ] No weakened gate: no `eslint-disable`, `@ts-ignore`, `@ts-expect-error` without an explaining comment and record, `.skip`, `.only`, or lowered thresholds.
- [ ] Golden replays unchanged, or the change is intended and explained in the commit.

## Stop and ask Erick when

- A rule is unclear, contradictory or missing → add to `docs/OPEN_QUESTIONS.md` (quote the text, list the readings), mark the record `status: "blocked"`, continue with other tasks.
- A locked decision, dependency, performance budget or quality gate would need to change → write a decision record with status `proposed`.
- Golden replays change for any reason other than the task's intended rule.
- Licensing, the Legal page, or anything from the GM-only repo is involved.
- A phase is complete → write a phase report in `docs/PROJECT_STATUS.md` (built, tests, bench numbers, open questions, risks) and wait for approval.

## Never

- Invent, "fix" or rebalance Inazria rules. The simulator measures balance; Erick sets it.
- Edit anything under `packages/data/vendor/`.
- Add a server, API route that runs at request time, analytics, tracking, or remote calls at runtime.
- Use `SharedArrayBuffer` (GitHub Pages cannot send the required isolation headers).
- Commit secrets or push to `main`.
- Mark a task done with a failing, skipped or unrun check.

## Documentation lookup

| Library | Source of truth |
| --- | --- |
| Svelte 5, SvelteKit 3 | Svelte MCP server: `list-sections` → `get-documentation`; `svelte-autofixer` on every component. Fallback: https://svelte.dev/llms.txt and https://svelte.dev/docs/kit/migrating-to-sveltekit-3 |
| PixiJS 8 | Markdown guides indexed at https://pixijs.com/llms.txt; migration notes at https://pixijs.com/8.x/guides/migrations/v8.md |
| Vite 8, Vitest 5, ESLint 10, typescript-eslint, Dexie 4, Valibot, Comlink, Playwright, LayerChart | Official docs for the installed major version (check `package.json`) |
| SRD 5.1 | The SRD 5.1 text (CC BY 4.0), cited by section |
| Inazria rules | Only `packages/data/vendor/inazria/` at the pinned commit |

If a doc contradicts this file, follow the doc for API details, follow this file for project decisions, and note the conflict in the status file.

## Code style essentials (details in `.claude/rules/`)

- TypeScript strict, no `any`, no `!`, no `enum`, named exports only (framework files excepted), exhaustive `switch` with `assertNever`.
- Packages import each other by package name (`@inazria/engine`), never across folders by relative path.
- Prefer clear code over clever code; comment *why*, not *what*. Every public function in `engine`, `data` and `sim` has a TSDoc comment.
