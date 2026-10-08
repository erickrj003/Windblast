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

- [ ] P0-02 `tsconfig.base.json` with the locked compiler options; project references; empty `packages/data`, `packages/engine`, `packages/sim`, `packages/render`, each with `package.json` `exports` and a `src/index.ts`.
  - Acceptance: `tsc -b` passes; TypeScript resolves to 6.0.x (`pnpm why typescript`).
- [ ] P0-03 Create `apps/web` with the official Svelte CLI, after checking its current SvelteKit 3 options via the Svelte MCP server; add adapter-static; root layout `prerender = true`; one placeholder page.
  - Acceptance: `pnpm --filter web build` emits static files; no `svelte.config.js`; `#lib` import alias configured.
- [ ] P0-04 ESLint 10 flat config (typescript-eslint strict-type-checked + stylistic-type-checked, eslint-plugin-svelte recommended) with project bans; Prettier + prettier-plugin-svelte.
  - Acceptance: adding `Math.random()` or `import 'pixi.js'` in `packages/engine` fails lint; `any` fails lint everywhere.
- [ ] P0-05 Vitest 5 (workspace projects per package, coverage thresholds from `testing.md`) and fast-check; Playwright configured against `vite preview`.
  - Acceptance: one sample unit test, one property test and one e2e test pass.
- [ ] P0-06 Lefthook pre-commit: Prettier check, ESLint on staged files, fast unit tests.
  - Acceptance: a commit with a lint error is rejected locally.
- [ ] P0-07 Install the agent kit (this folder's `AGENTS.md`, `CLAUDE.md`, `.claude/rules/`, `.cursor/`, `.mcp.json`, `scripts/sync-agent-rules.ts`).
  - Acceptance: `pnpm rules:check` passes; hand-editing a `.cursor/rules/*.mdc` file makes it fail.
- [ ] P0-08 `.github/workflows/ci.yml` (frozen install, `pnpm verify`, Playwright report artifact on failure); `docs/PLAN.md`, `docs/OPEN_QUESTIONS.md`, `docs/decisions/0001-locked-stack.md`, `docs/CHANGELOG.md`.
  - Acceptance: CI is green on the default branch.

## Blocked

_(none)_

## Done (this phase)

- [x] P0-01 Create the pnpm workspace: `.nvmrc` (24), `packageManager` (pnpm 12), root scripts `check`, `verify`, `bench`, `data:pull`, `data:check`, `rules:sync`, `rules:check`; `LICENSE` (Q-002: MIT for code, Inazria content all rights reserved).
  - Acceptance: `pnpm install` works on Node 24; scripts exist (they may be placeholders that exit 0 until their phase); `LICENSE` present; LF line endings enforced by `.gitattributes`.
  - Result: `pnpm install` ✅ · `pnpm install --frozen-lockfile` ✅ · all 7 scripts exit 0 (placeholders) · Node 24.21.0, pnpm 12.10.1 · branch `chore/p0-01-pnpm-workspace`

## Phase reports

_(Phase 0 report goes here: what was built, test and bench results, open questions, risks. Then stop and wait for Erick's approval.)_
