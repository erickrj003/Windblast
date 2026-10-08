---
paths:
  - "**/*.ts"
  - "**/*.svelte"
---

# TypeScript

- **Version is pinned to 6.0.x.** TypeScript 7 exists, but SvelteKit 3, svelte-check and typescript-eslint do not support it yet. Never bump it; propose a decision record when all three list `^7`.
- Compiler options (in `tsconfig.base.json`, never loosened per package): `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `isolatedModules`.

## Rules

- No `any`. Use `unknown` at boundaries and narrow it with a Valibot schema or a type guard.
- No non-null assertions (`x!`). Handle the missing case or restructure.
- No `enum`. Use `as const` objects with a derived union type:
  ```ts
  export const DamageType = { Slashing: 'slashing', Fire: 'fire' } as const;
  export type DamageType = (typeof DamageType)[keyof typeof DamageType];
  ```
- Model variants as discriminated unions with a `kind` field. Every `switch` over one is exhaustive and ends with `default: return assertNever(x);`.
- Named exports only. Default exports are allowed only where a framework requires them (config files).
- `import type { … }` for type-only imports (`verbatimModuleSyntax` enforces it).
- Prefer `readonly` properties and `ReadonlyArray<T>` for data that does not change after construction (all compiled rules data).
- Branded types for identifiers that must not be mixed up: `type CreatureId = number & { readonly __brand: 'CreatureId' }`.
- Errors: throw only for programmer errors (impossible states). Expected failures (invalid user input, quota exceeded) return a `Result` type: `{ ok: true, value } | { ok: false, error }`.
- No `@ts-ignore`. `@ts-expect-error` only with a comment explaining why, and only in tests.
- Every exported function in `packages/*` has a TSDoc comment that states what it does and any rule source it implements.
- File names are `kebab-case.ts`; types and classes are `PascalCase`; functions and variables are `camelCase`; constants that are true compile-time constants are `UPPER_SNAKE_CASE`.
