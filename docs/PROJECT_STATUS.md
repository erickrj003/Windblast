# Project status

Task board for the Inazria Encounter Simulator. The agent keeps this file current; the plan is `docs/PLAN.md`. Format rules are in `.claude/rules/docs-and-status.md`.

## Current phase

**Phase 0: Repository and guardrails.** Goal: an empty but fully guarded monorepo where `pnpm verify` passes and CI is green.

Notes:

- The GitHub repo is `erickrj003/Windblast`, not `erickrj003/inazria-simulator` as the plan says. The local checkout root is `blaster`. See Q-003 for the effect on the Pages base path (Phase 9).
- `pnpm-workspace.yaml` must only contain settings pnpm 12 recognizes: with `packageManager` pinned, an unknown key fails every command (`ERR_PNPM_UNRECOGNIZED_WORKSPACE_SETTINGS`).
- 2026-10-08: Erick allowed direct pushes to `main` (AGENTS.md task loop step 9 updated). This supersedes the plan's "never push directly to `main`" and "open a pull request; Erick merges".
- The Svelte MCP server only loads once `.cursor/mcp.json` is at the repo root (P0-07). P0-03 needs it, so P0-07 may be pulled ahead of P0-03.

## In progress

_(none)_

## Next up

- [ ] P0-05 Vitest 5 (workspace projects per package, coverage thresholds from `testing.md`) and fast-check; Playwright configured against `vite preview`.
  - Acceptance: one sample unit test, one property test and one e2e test pass.
- [ ] P0-06 Lefthook pre-commit: Prettier check, ESLint on staged files, fast unit tests.
  - Acceptance: a commit with a lint error is rejected locally.
- [ ] P0-08 `.github/workflows/ci.yml` (frozen install, `pnpm verify`, Playwright report artifact on failure); `docs/PLAN.md`, `docs/OPEN_QUESTIONS.md`, `docs/decisions/0001-locked-stack.md`, `docs/CHANGELOG.md`.
  - Acceptance: CI is green on the default branch.

## Blocked

_(none)_

## Done (this phase)

- [x] P0-01 Create the pnpm workspace: `.nvmrc` (24), `packageManager` (pnpm 12), root scripts `check`, `verify`, `bench`, `data:pull`, `data:check`, `rules:sync`, `rules:check`; `LICENSE` (Q-002: MIT for code, Inazria content all rights reserved).
  - Acceptance: `pnpm install` works on Node 24; scripts exist (they may be placeholders that exit 0 until their phase); `LICENSE` present; LF line endings enforced by `.gitattributes`.
  - Result: `pnpm install` ✅ · `pnpm install --frozen-lockfile` ✅ · all 7 scripts exit 0 (placeholders) · Node 24.21.0, pnpm 12.10.1 · branch `chore/p0-01-pnpm-workspace`
- [x] P0-02 `tsconfig.base.json` with the locked compiler options; project references; empty `packages/data`, `packages/engine`, `packages/sim`, `packages/render`, each with `package.json` `exports` and a `src/index.ts`.
  - Acceptance: `tsc -b` passes; TypeScript resolves to 6.0.x (`pnpm why typescript`); package dependencies follow `data` ← `engine` ← `sim` and `engine` ← `render`; `data` and `engine` get no DOM types.
  - Result: `tsc -b` ✅ · `pnpm why typescript` → 6.0.3 only · probes (removed): `data` importing `@inazria/engine` fails TS2307, `document` in `engine` fails TS2584, `engine` importing `@inazria/data` resolves · branch `chore/p0-02-typescript-packages`
  - Notes: packages export `./src/index.ts` and emit declarations only (`dist/`, ignored); Vite and Vitest consume source. Added `erasableSyntaxOnly` on top of the locked flags (stricter, not looser): it rejects `enum`, namespaces and parameter properties at compile time and matches what Node 24 type stripping can run.
- [x] P0-07 Install the agent kit (`AGENTS.md`, `CLAUDE.md`, `.claude/rules/`, `.cursor/`, `.mcp.json`, `scripts/sync-agent-rules.ts`, `docs/`) at the repo root. Pulled ahead of P0-03 so the Svelte MCP server is available for it.
  - Acceptance: `pnpm rules:check` passes; hand-editing a `.cursor/rules/*.mdc` file makes it fail; editing a `.claude/rules/*.md` file without syncing makes it fail; `pnpm rules:sync` repairs both.
  - Result: `rules:check` ✅ in sync · hand-edited `engine.mdc` → exit 1 ("out of date") · unsynced `testing.md` → exit 1 · orphan `.mdc` → exit 1 ("orphaned") · `rules:sync` repaired all, then `rules:check` ✅ · moved with `git mv` (history kept); kit README removed per its own instructions · branch `chore/p0-07-agent-kit`
- [x] P0-03 Create `apps/web` with the official Svelte CLI, after checking its current SvelteKit 3 options via the Svelte MCP server; add adapter-static; root layout `prerender = true`; one placeholder page.
  - Acceptance: `pnpm --filter web build` emits static files; no `svelte.config.js`; `#lib` import alias configured.
  - Result: `sv@1.1.1 create --template minimal --types ts --add sveltekit-adapter=adapter:static` · `pnpm --filter web build` ✅ (`index.html`, `404.html`, `_app/`) · `pnpm typecheck` ✅ (`tsc -b`, `svelte-check --fail-on-warnings` 0/0, `tsc -p tsconfig.node.json`) · `svelte-autofixer` clean on `+page.svelte` and `+layout.svelte` · `BASE_PATH=/Windblast` builds; `BASE_PATH=Windblast` fails with a clear error · branch `feat/p0-03-web-app`
  - Notes: `tsconfig.base.json` now holds only the locked strict flags so the app can extend `["$app/tsconfig", "../../tsconfig.base.json"]`; library build settings moved to `tsconfig.package.json`. `vite.config.ts` is checked in its own `tsconfig.node.json` so Node globals stay out of browser code. Added `@types/node` ^24 under proposed decision record 0002. Removed template leftovers (`.npmrc`, `README.md`, the empty `#lib` barrel). pnpm 12 enforces a one-day `minimumReleaseAge`: asking for a version published today made pnpm write a silent `minimumReleaseAgeExclude` into `pnpm-workspace.yaml`. Reverted it and used `vite ^8.3.3` instead; never commit such an exclusion without a decision record.
- [x] P0-04 ESLint 10 flat config (typescript-eslint strict-type-checked + stylistic-type-checked, eslint-plugin-svelte recommended) with project bans; Prettier + prettier-plugin-svelte.
  - Acceptance: adding `Math.random()` or `import 'pixi.js'` in `packages/engine` fails lint; `any` fails lint everywhere.
  - Result: `pnpm check` ✅ (format, typecheck, lint, data:check placeholder, rules:check) · probes (removed) all failed lint: in `engine` `pixi.js`, `svelte`, `Math.random`, `Date.now`, `new Date`, `document`, `enum`, `any`, default export; `data` importing `@inazria/engine`; in `web` `$app/stores`, `svelte/store`, `any` in `.ts` and `.svelte`, `console.log` · branch `chore/p0-04-lint-format`
  - Notes: per-package `no-restricted-imports` enforce `data` ← `engine` ← `sim` and `engine` ← `render`; engine and data also ban clocks, `Math.random` and host globals. The web app bans `$app/stores`, `$app/environment`, `$service-worker`, `$lib`, `$env/*`, `svelte/store`, `pixi.js` and deep `@inazria/*/src` imports. `@typescript-eslint/array-type` is set to `readonly: 'generic'` so the stylistic preset matches the `ReadonlyArray<T>` convention in `typescript.md`. Config files, `scripts/*.ts` and `apps/web/vite.config.ts` are typed through `tsconfig.tooling.json` (replaces `apps/web/tsconfig.node.json`; `@types/node` moved to the root). Markdown is excluded from Prettier so it does not rewrite the plan, docs and rules. Not added: `globals` and `eslint-config-prettier` (the `sv` defaults); neither is needed with typescript-eslint and current presets. `@eslint/js` is ESLint's own preset package. Fixed two lint findings in `scripts/sync-agent-rules.ts` (useless assignment; formatting).

## Phase reports

_(Phase 0 report goes here: what was built, test and bench results, open questions, risks. Then stop and wait for Erick's approval.)_
