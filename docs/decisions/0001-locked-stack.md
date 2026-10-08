# 0001: Locked stack for v1

- Status: accepted
- Date: 2026-10-08
- Proposed by: Erick (plan)

## Context

The simulator must be fast, static (no backend), testable by AI agents, and reusable for a later browser RPG. Erick wants high performance without debugging a compiled language.

## Options considered

1. **TypeScript + SvelteKit 3 + Svelte 5 + PixiJS 8** (chosen).
2. TypeScript + React 19 + Vite: more reliable AI output, heavier bundle.
3. Rust or C++ compiled to WebAssembly: fastest hot loops, but adds a compiled toolchain Erick wants to avoid.
4. Forking BattleCast (all rights reserved) or BattleSim (CC BY-NC-SA, no grid): rejected on license and fit.

## Decision

Node 24 LTS · pnpm 12 · TypeScript 6.0.x (pinned) · Svelte 5 (runes) · SvelteKit 3 + adapter-static 4 · Vite 8 · PixiJS 8 · Comlink · Valibot · Dexie 4 · LayerChart 2 · Vitest 5 + fast-check · Playwright · ESLint 10 + typescript-eslint + eslint-plugin-svelte · Prettier · svelte-check · Lefthook · GitHub Pages.

## Consequences

- TypeScript 7 is not used until SvelteKit, svelte-check and typescript-eslint support it.
- `@vite-pwa/sveltekit` is not used (no SvelteKit 3 support); the service worker is hand-written.
- No `SharedArrayBuffer` (GitHub Pages cannot send isolation headers).
- WebAssembly needs its own decision record backed by profiling data.
- Agents must look up SvelteKit 3, Vite 8, Vitest 5 and ESLint 10 APIs rather than rely on training data.
