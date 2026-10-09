# 0002: `@types/node` for build and tooling files

- Status: accepted (Erick, 2026-10-08, Phase 0 review)
- Date: 2026-10-08
- Proposed by: agent

## Context

TypeScript 6 defaults `types` to `[]`, so Node globals such as `process` are untyped unless a project lists `@types/node`. Tooling files that run in Node need them: `apps/web/vite.config.ts` reads `process.env.BASE_PATH` for the GitHub Pages base path, and later `scripts/*.ts`, `vitest.config.ts` and `playwright.config.ts` will too. `@types/node` is not in the locked stack (0001).

## Options considered

1. **Add `@types/node` 24.x as a dev dependency** wherever a TypeScript project covers Node-run tooling files, and list it in that project's `types` only. Pros: correct types for the Node version in `.nvmrc`; type-only, never bundled. Cons: one more package to keep in step with the Node major.
2. **Leave tooling files out of type checking.** Pros: no new package. Cons: config files that decide the deploy path go unchecked, and type-aware ESLint (P0-04) needs them in a project anyway.

## Decision

Option 1: `@types/node` pinned to `^24`, matching Node 24 LTS. It is never added to the `types` of `packages/engine` or `packages/data`, which must stay free of Node and browser globals.

## Consequences

- `@types/node` moves to the next major only together with `.nvmrc`.
- Type-only package with no runtime code: no bundle-size or license impact (MIT).
