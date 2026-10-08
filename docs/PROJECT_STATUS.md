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

_(Phase 0 report, then Phase 1 after Erick approves)_

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
- [x] P0-05 Vitest 5 (workspace projects per package, coverage thresholds from `testing.md`) and fast-check; Playwright configured against `vite preview`.
  - Acceptance: one sample unit test, one property test and one e2e test pass.
  - Result: `pnpm verify` ✅ · Vitest 5.0.3: 3 tests (2 unit, 1 fast-check property) in `packages/data`, 100% coverage · Playwright 1.64.0 (Chromium): 1 e2e test against `vite preview` of the production build · bundle size 31.5 KB gzipped (budget 200 KB) · probes (removed): an uncovered branch in `packages/engine` fails the 90% lines / 85% branches threshold; `it.only` fails the run · branch `chore/p0-05-tests`
  - Notes: the sample code is a real helper, `assertNever` in `@inazria/data`, which the exhaustive-switch rule in `typescript.md` needs anyway. Vitest projects are inline (one per package) because directory-glob projects do not inherit root options such as `allowOnly: false`. Coverage thresholds are per-package globs at the root (engine 90/85, data and sim 85 lines; `testing.md` sets no minimum for render). `pnpm check` now ends with `pnpm test` (Vitest with coverage); `pnpm verify` adds `test:e2e` (builds, then runs Playwright) and `pnpm size`. Added `scripts/check-bundle-size.ts`, since `verify` needs a bundle-size check and no task owned it: it follows `index.html` and static imports, but not dynamic `import()`, so lazy-loaded PixiJS is excluded. Playwright never reuses a running server so the size check always sees a fresh build. E2E files have their own `apps/web/e2e/tsconfig.json`. Locally, run `pnpm --filter web exec playwright install chromium` once.
- [x] P0-06 Lefthook pre-commit: Prettier check, ESLint on staged files, fast unit tests.
  - Acceptance: a commit with a lint error is rejected locally.
  - Result: Lefthook 2.2.0, `lefthook validate` ✅ · probes (reverted, nothing committed): staged `Math.random()` in `packages/engine` → lint job ✗, commit rejected; broken `assertNever` message → unit-tests job ✗ (2 related tests failed); misformatted `vitest.config.ts` → format job ✗ · `pnpm verify` ✅ · branch `chore/p0-06-lefthook`
  - Notes: `lefthook.yml` runs three parallel jobs on staged files: `prettier --check`, `eslint --max-warnings 0`, and `vitest related --run` for staged `packages/**/*.ts` files (only tests that import the staged files, without coverage; the full suite runs in `pnpm check` and CI). Uses `glob_matcher: doublestar` because Lefthook's default `**` needs at least one directory. pnpm 12 fails installs on unapproved dependency build scripts, so Lefthook's `postinstall` is denied (`allowBuilds: { lefthook: false }` in `pnpm-workspace.yaml`, written by `pnpm approve-builds '!lefthook'`), and the root `prepare` script runs `lefthook install` instead. Lefthook 2.2.1 was published today, inside pnpm's one-day `minimumReleaseAge`, so 2.2.0 was used.
- [x] P0-08 `.github/workflows/ci.yml` (frozen install, `pnpm verify`, Playwright report artifact on failure); `docs/PLAN.md`, `docs/OPEN_QUESTIONS.md`, `docs/decisions/0001-locked-stack.md`, `docs/CHANGELOG.md`.
  - Acceptance: CI is green on the default branch.
  - Result: [CI run 37861477407](https://github.com/erickrj003/Windblast/actions/runs/37861477407) ✅ on `main` in 50 s (frozen install with supply-chain policy check, Lefthook installed through `prepare`, 3 unit/property tests, 1 e2e test, 31.5 KB first-page JS) · plan moved to `docs/PLAN.md` with `git mv` · branch `ci/p0-08-workflow`
  - Notes: Actions pinned to commit SHAs: `actions/checkout` v7.0.1, `pnpm/action-setup` v6.1.0 (pnpm version from `packageManager`), `actions/setup-node` v7.0.0 (Node from `.nvmrc`, pnpm store cache), `actions/upload-artifact` v7.0.2. `setup-node` v7.1.0 was published today, so v7.0.0 is used under the same one-day rule as npm packages. Permissions are `contents: read`; checkout does not keep credentials. Runs on pushes to `main` and on pull requests; a newer push cancels an older run on the same ref. `OPEN_QUESTIONS.md`, decision record 0001 and `CHANGELOG.md` came with the agent kit (P0-07); the changelog now has its first entry.

## Phase reports

### Phase 0 report (2026-10-08): awaiting Erick's approval

**Built.** A pnpm 12 monorepo on Node 24 with four empty library packages (`data` ← `engine` ← `sim`, `engine` ← `render`) and a SvelteKit 3 static app showing one placeholder page. The guardrails:
- TypeScript 6.0.3 in strict mode with project references. `data` and `engine` get no DOM types.
- ESLint 10 bans, enforced per package: imports that break the dependency direction, clocks and `Math.random` in `data` and `engine`, host globals, `enum`, default exports, `any`, and the deprecated SvelteKit modules.
- Prettier, Vitest 5 with coverage minimums, fast-check, Playwright against the production build, and a first-page bundle budget.
- A Lefthook pre-commit hook and GitHub Actions CI running `pnpm verify`.
- Agent rules synced to Cursor with a drift check.

**Tests.** `pnpm verify` ✅ locally and in CI. Three unit and property tests (100% coverage of the one helper) and one end-to-end test. The first page loads 31.5 KB of gzipped JavaScript against a 200 KB budget. Each guard was checked with a probe that had to fail; the probes are listed under each task above. No benchmarks yet (P5-04).

**Open questions.**
- Q-001: which repo holds the Player's Guide source. Blocks P1-02 (`data:pull`), the second task of Phase 1.
- Q-003: the GitHub Pages base path for the Windblast repo. Blocks P9-01 only.
- Decision record 0002 (`@types/node` for tooling files only) is proposed and needs your acceptance.

**Risks.**
- The stack is newer than most documentation and training data: pnpm 12 (a Rust rewrite), SvelteKit 3, Vitest 5 and TypeScript 6. Each task looks up current docs first. Two behaviors have already caused surprises: pnpm 12 writes a silent `minimumReleaseAgeExclude` when you ask for a version less than a day old, and it fails installs on unapproved build scripts.
- GitHub moves `ubuntu-latest` to Ubuntu 26 on 2026-10-19. CI may change underneath us; pinning `ubuntu-24.04` would avoid that if you prefer.
- Each local machine needs `pnpm --filter web exec playwright install chromium` once.
