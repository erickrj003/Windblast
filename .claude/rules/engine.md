---
paths:
  - "packages/engine/**"
---

# Rules engine (`@inazria/engine`)

The engine is a **pure, deterministic** rules machine. Same compiled rules + encounter + seed ⇒ same fight, in Node, in a Web Worker and, later, in the RPG.

## Hard constraints (lint-enforced)

- No imports from `svelte`, `pixi.js`, `dexie`, `comlink` or any browser API. The only workspace dependency is `@inazria/data`.
- No `Math.random`, `Date.now`, `performance.now`, `crypto`, `setTimeout`, `window`, `document`, `globalThis` access.
- All randomness comes from the trial's seeded PRNG (`sfc32`). Batch trial *n* uses `deriveSeed(masterSeed, n)`.
- Never iterate over object keys built at runtime when order matters. Iterate arrays sorted by stable integer IDs.

## Design rules

- Public API: `createTrial`, `legalActions`, `applyChoice`, `step`, `runToEnd`, `replay`, `rankChoices`. Everything else is internal; export it only through `src/index.ts` when another package truly needs it.
- Each creature has a controller, `ai` (with a tactics profile) or `human`. `runToEnd` forces every controller to `ai`. The tactics AI chooses only from `legalActions()`, exactly like a person, so the rules are enforced identically for both. A played session is replayable from `{ engineVersion, dataVersion, encounter, seed, choices }`; `applyChoice` rejects any choice not in the current `legalActions()` list.
- Trial state is mutable **only inside engine step functions** on the trial that owns it. Nothing outside the engine mutates trial state.
- Rules arrive as compiled data. Do not hard-code Inazria or SRD numbers in engine code; read them from data. The exception is SRD structural rules (turn order, action economy), which still carry a source comment.
- Feature behavior uses the declarative effect vocabulary (`attack`, `save`, `damage`, `heal`, `applyCondition`, `removeCondition`, `modifyRoll`, `spendResource`, `gainResource`, `move`, `grantAction`). A feature that cannot be expressed that way gets a script module in `src/features/<script-id>.ts` with its own tests.
- Trigger handlers run in the documented order (actor, then target, then others by initiative). Effect chains stop at depth 16 and throw a descriptive error.
- Every event and every applied effect carries the `sourceId` of the rule that produced it.
- Integer math for dice, HP, damage and resources. Floating point only for tactics scoring.

## Tactics scoring and explain mode ("Show AI reasoning")

Erick uses the AI's reasoning to tune work-in-progress Inazria rules, so the AI must be able to show its work without that ever changing a fight.

- A candidate's score is a **sum of named terms**: `hitChance`, `expectedDamage`, `dropChance`, `healValue`, `conditionValue`, `opportunityRisk`, `resourceCost` (extend the union, never use free-form keys). Each term stores raw value, profile weight and weighted value, plus the `sourceId`s of the rules that fed it. One scoring function serves batch, play and explain; there is no separate "explained" copy of the logic that could drift.
- `rankChoices(trial, opts)` is **read-only**: it scores `legalActions()` for the active creature and returns them ranked. It never mutates trial state and never draws from the PRNG (scoring uses expected values only). `step()` must pick exactly `rankChoices(trial)[0]` under the same profile.
- Spend-policy checks and tie-breaks are part of the breakdown: record the threshold compared and, when top totals tie, which stable key broke the tie.
- `TrialOptions.explain = { topN }` (default 5) makes `step()` emit an `AiDecision` event (creature, profile, top N candidates with terms, chosen index, number of options scored) before the chosen action's events. `explain` is rejected unless `events: 'full'`.
- **Batch mode never pays for it:** with `events: 'none'`, no candidate arrays, term records or strings are built; terms accumulate into the trial's scratch buffers. Prove it with `pnpm bench` before and after.
- Action-usage counters for results are fixed-size integer arrays indexed by compiled action ID, allocated once per trial.

## Source citations

Every function that implements a rule starts with a TSDoc tag naming its source:

```ts
/**
 * Applies damage after resistance, vulnerability and immunity.
 * @rule srd51:combat#damage-resistance-and-vulnerability
 */
```

Inazria rules use `@rule inazria:<page>#<section>`, matching the `source` block in the data record.

## Performance

- In batch mode (`events: 'none'`), allocate nothing per attack or per turn: reuse scratch objects owned by the trial.
- Dice expressions are pre-parsed at compile time; never parse strings during a trial.
- Benchmark changes to hot paths with `pnpm bench` and put the before/after numbers in the commit message.
