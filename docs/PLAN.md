# Inazria Encounter Simulator: Agent Build Plan

Oct 8, 2026 · @Erick Johnson

## Goals

The agent builds a static, browser-only encounter simulator for Inazria. The application should allow a user to set up encounters on a grid, and play through the encounter as if it were a tabletop scenario. A user should include a "Monte Carlo" function that can simulate the provided encounter many times and provide useful feedback data. Its rules engine is written so the future browser RPG can reuse it unchanged. Data for the rules should come from the Inazria's Player Guide (<https://erickrj.tech/inazria-players-guide/>). This document is the agent's single source of truth: it is copied into the repo as `docs/PLAN.md`, and the agent works through it phase by phase.

**In scope for v1**

- Building parties from Inazria races, classes and contexts, starting at levels 1–5.
- Building encounters from SRD 5.1 monsters plus homebrew creatures.
- Monte Carlo batches of up to 10,000 trials, run in Web Workers.
- Results: win rate, survival rate, rounds to victory, damage dealt and taken, and which creatures fall first.
- An interactive grid viewer for creating and simulating trials automatically or manually.
- Local-only storage with export and import; works offline after the first visit.

**Not in v1**

- Accounts, servers, multiplayer or any backend.
- The RPG itself: story, art pipeline, audio, exploration. These are listed under later phases only.
- Rules Erick has not yet written. The agent logs gaps; it never invents rules.

**v1 is done when**

1. A 4-versus-4 level 5 encounter runs 10,000 trials in roughly 10 seconds or faster on a mid-range laptop. This is a target to confirm in Phase 5, not a measured figure.
2. The same seed and inputs give identical results whatever the number of workers.
3. Every rule the engine applies cites its source: an Inazria guide page or an SRD 5.1 section.
4. Every quality gate passes in CI, with no gate weakened to get there.
5. The site is live on erickrj.tech and works offline after one visit.

## Locked decisions

The stack is TypeScript end to end, on SvelteKit 3 with Svelte 5, compiled to static files. Versions are the npm `latest` tags on October 8, 2026. Each row is locked: the agent changes one only through a written decision record (section "Agent operating model") that Erick approves.

| Area | Choice | Version | Why |
| --- | --- | --- | --- |
| Runtime for tooling | Node.js LTS | 24.x, pinned in `.nvmrc` | Meets SvelteKit 3 (≥22.17) and Vitest 5 (≥22.12) minimums |
| Package manager | pnpm workspaces | 12.x, pinned via `packageManager` | Fast, strict dependency isolation for the monorepo |
| Language | TypeScript, strict | **6.0.x, pinned** | TypeScript 7.0.2 is out, but SvelteKit 3 peers on `^6.0.0`, svelte-check on `^5 \|\| ^6`, and typescript-eslint on `<6.1`. Upgrade only once all three list 7 |
| UI framework | Svelte 5, runes only | 5.57.x | S tier on the frontend list; tiny runtime |
| App framework | SvelteKit 3 + adapter-static | 3.0.x / 4.0.x | Routing, prerendering and service-worker support with no server |
| Build | Vite | 8.x | Required by SvelteKit 3 |
| Rendering | PixiJS v8 (WebGPU with WebGL fallback) | 8.22.x | Fast 2D, actively maintained; swappable for Phaser 4 later |
| Workers | Web Workers + Comlink | 4.4.x | Typed calls into workers without hand-written message plumbing |
| Schemas | Valibot | 1.5.x | Small bundle; implements Standard Schema, which SvelteKit 3 also accepts |
| Local database | Dexie (IndexedDB) | 4.4.x | Versioned schemas and migrations with a small API |
| Charts | LayerChart | 2.6.x | Svelte 5-native charts |
| Unit and property tests | Vitest + fast-check | 5.0.x / 4.10.x | Vite-native; property tests catch rules edge cases |
| End-to-end tests | Playwright | 1.64.x | Real-browser checks of the static build |
| Lint and format | ESLint 10 (flat config) + typescript-eslint + eslint-plugin-svelte; Prettier + prettier-plugin-svelte | 10.x / 8.71.x / 3.23.x; 3.9.x / 4.1.x | Type-aware linting and one formatting style |
| Type checking | svelte-check | 4.7.x | Checks `.svelte` files that `tsc` cannot |
| Git hooks | Lefthook | 2.x | Runs format, lint and fast tests before each commit |
| Agent docs lookup | Svelte MCP server (`@sveltejs/mcp`) | 0.1.x | Current Svelte and SvelteKit docs plus an autofixer for generated code |
| Hosting | GitHub Pages via GitHub Actions | — | Free; fine while assets are small (see "Hosting and deployment") |

Two tools are deliberately left out. `@vite-pwa/sveltekit` only supports SvelteKit 1 and 2, so the service worker is hand-written with SvelteKit's built-in support. WebAssembly is also out: if profiling ever shows a hot loop that TypeScript cannot speed up enough, moving it to WebAssembly needs its own decision record.

## Architecture

Rules flow one way, from Erick's guide into validated data and then into a pure engine. The web app never runs rules itself: it hands batches to worker-hosted engines and hands replays to the renderer.

&#91;embedded content: System architecture · build time and browser\]

Only `apps/web` touches the browser's storage and the service worker. The engine sits at the bottom with no dependencies on anything above it, which is what lets the RPG reuse it later.

## Repository layout

The code lives in a new public repo, `erickrj003/inazria-simulator`, as a pnpm monorepo. It holds four libraries and one app, and the libraries depend in one direction only: `data` ← `engine` ← `sim`, and `engine` ← `render`. Keeping the engine free of the DOM, Svelte and PixiJS is what lets the RPG reuse it later.

```text
inazria-simulator/
├── AGENTS.md                  core agent instructions (read by Cursor and Claude Code)
├── CLAUDE.md                  imports AGENTS.md; Claude Code specifics
├── .claude/rules/*.md         topic rules, the single source ("paths" frontmatter)
├── .cursor/rules/*.mdc        generated from .claude/rules by scripts/sync-agent-rules.ts
├── .mcp.json                  Svelte MCP server for Claude Code
├── .cursor/mcp.json           Svelte MCP server for Cursor
├── .nvmrc  package.json  pnpm-workspace.yaml  tsconfig.base.json
├── eslint.config.js  .prettierrc  lefthook.yml
├── .github/workflows/         ci.yml, deploy.yml
├── docs/
│   ├── PLAN.md                this document
│   ├── PROJECT_STATUS.md      task board the agent keeps current
│   ├── OPEN_QUESTIONS.md      rules gaps and decisions waiting on Erick
│   ├── decisions/NNNN-*.md    decision records
│   └── CHANGELOG.md
├── scripts/
│   ├── sync-agent-rules.ts    writes .cursor/rules from .claude/rules; --check mode for CI
│   ├── pull-inazria.ts        copies guide pages from a pinned commit into packages/data/vendor
│   └── check-provenance.ts    flags encoded rules whose source page changed
├── packages/
│   ├── data/                  @inazria/data: Valibot schemas, SRD and Inazria content, validation
│   │   ├── src/schemas/
│   │   ├── content/srd/       conditions, damage types, monsters (JSON)
│   │   ├── content/inazria/   races, classes, contexts, features, resources (JSON)
│   │   └── vendor/inazria/    pulled guide markdown, committed with its commit hash
│   ├── engine/                @inazria/engine: pure rules engine, no DOM
│   │   └── src/               dice, rng, state, turn loop, actions, conditions, grid, tactics, events
│   ├── sim/                   @inazria/sim: worker pool, batch runner, aggregation
│   └── render/                @inazria/render: PixiJS v8 grid for build, play and review
└── apps/
    └── web/                   SvelteKit 3 app: routes, components, Dexie storage, service worker
```

Three mechanisms enforce the dependency direction: TypeScript project references, an ESLint `no-restricted-imports` rule per package, and an engine rule banning `window`, `document`, `Math.random` and `Date.now`. Packages import each other by name (`@inazria/engine`) through each package's `exports` field, never by relative path across package folders.

## Rules data pipeline

Game rules enter the engine only as validated data with a recorded source. The agent reads Erick's guide pages, encodes each mechanic by hand into JSON, and records the exact page and commit it came from. A CI check flags any encoded rule whose source text later changes, and nothing is guessed: unclear rules go to `docs/OPEN_QUESTIONS.md`.

### Sources

- **Inazria Player's Guide.** The public Quartz repo behind [erickrj.tech/inazria-players-guide](https://erickrj.tech/inazria-players-guide/). `pnpm data:pull` sparse-checks out the content folder at a pinned commit into `packages/data/vendor/inazria/` and writes the commit SHA to `SOURCE.json`. The GM-only repo is never read.
- **SRD 5.1, CC BY 4.0.** Core mechanics, conditions, equipment and monsters, for anything Inazria does not override, matching the guide's own rule that unaddressed topics defer to SRD 5.1.
- **Not used:** OGL-licensed datasets such as the archived [5e-bits/5e-database](https://github.com/5e-bits/5e-database). Encoding from the CC BY SRD keeps every piece of content under one license.

### Flow

1. **Pull.** Copy guide markdown at a pinned commit; never edit vendored files.
2. **Encode.** The agent writes JSON records in `packages/data/content/`, one file per entity (one race, class, context, feature or monster).
3. **Validate.** Valibot schemas check every record on `pnpm data:check`, in CI, and at app build time.
4. **Trace.** Every record carries a `source` block (below). `check-provenance` re-hashes the cited section in the vendored copy and fails CI with a "re-verify" list if the text changed.
5. **Compile.** A build step emits typed, frozen lookup tables plus a `dataVersion` hash. Saves and simulation runs record `dataVersion` so old results stay explainable after rules change.

```json
"source": {
  "kind": "inazria",
  "page": "classes/civil/fighter",
  "section": "Core Class Features > Exertion (1st Level)",
  "commit": "<40-char SHA>",
  "contentHash": "<sha256 of the section text>"
}
```

### Schemas

- **Core:** ability scores, skills, damage types, conditions, dice expressions (`2d6+3` parsed into a typed form at build time, never at runtime).
- **Creatures:** monster stat blocks; character templates built from race, class, context and level.
- **Inazria character options:** races; classes with per-level tables; one context per character. The guide publishes eight classes, four civil and four primal, each with four contexts. v1 encodes the three civil classes below; the other five wait until after v1.
  - **Fighter** (civil): Champion, Paladin, Varnic Knight, Tarvanin. Resource: **Exertion** (short or long rest). Paladins also have **Devotion** (half on a short rest, all on a long rest). Techniques have ranks Untrained, Familiar, Practiced and Mastered.
  - **Vagabond** (civil): Slayer, Cusgarn, Silakar, Purple Mage. Resource: **Guile** (short or long rest). Tricks use the same ranks. Purple Mage casts spells from 1st level; v1 records that and does not simulate spells.
  - **Savant** (civil): Koboda, Hari-Yudha, Loremaster, Ranger. Resource: **Focus Points**, plus a **Focus die** (both on the Savant table; points return on a short or long rest).
  - **After v1:** Magi (Wizard, Alchemist, Nafazi, Bek'Tan); Berserker (Damiir, Bashani, Asurani, Orashkans); Druid (Channeler (Magi of Old), Spiritcaller, Beastmaster, Astralist); Invoker (Rekupuledo, Duendekoko, Xolturasus, Sammaelon); Ascetic (Acolytes of Tammuzia, Nityamar, Nehushtani, Khalseth).
- **Resources:** a generic pool type (`max`, `current`, `recharge`: turn, round, short rest or long rest) used for Exertion, Devotion, Guile, Focus Points, spell slots and limited uses.
- **Features and actions:** described with a small declarative effect vocabulary: `attack`, `save`, `damage`, `heal`, `applyCondition`, `removeCondition`, `modifyRoll`, `spendResource`, `gainResource`, `move`, `grantAction`. Each has a trigger (`onTurnStart`, `onAttackRoll`, `onHit`, `onDamaged` and similar) and a condition.
- **Escape hatch:** a feature too unusual for the vocabulary names a `scriptId`, implemented as a tested TypeScript module in `packages/engine/src/features/`. The validator fails if a `scriptId` has no matching module.

### Rules status and ambiguity

Every record has `status`: `final`, `draft` or `blocked`. The simulator uses only `final` records unless the user ticks "include draft rules". When the guide is unclear, contradictory or silent, the agent marks the record `blocked`, adds an `OPEN_QUESTIONS.md` entry quoting the text, lists the possible readings, and moves on. Erick's answer updates both files.

### Starter content

- **SRD:** all conditions and damage types; the weapons and armor characters can start with; 20 monsters from CR 1/8 to 5 (Kobold, Goblin, Bandit, Wolf, Skeleton, Zombie, Orc, Gnoll, Hobgoblin, Ghoul, Bugbear, Dire Wolf, Brown Bear, Giant Spider, Bandit Captain, Ogre, Owlbear, Veteran, Wight, Troll).
- **Inazria:** every published player race (Human, Elf, Dwarf, Halfling, Orc, Dalvas, Kelanari, Hyzalian, with the lineages on those pages [Te-Hyzalians are not a player option]); Fighter, Savant and Vagabond at levels 1–5 with all four contexts each. The spell compendium and the multiclassing rules are already in the guide. v1 still does not simulate spells or multiclassing. Purple Mage spellcasting is recorded as not simulated until spells are in scope.

### Licensing

The app shows the SRD 5.1 CC BY 4.0 attribution on a Legal page, mirroring the guide's own. The repo license is MIT for code, with Inazria content all rights reserved (Q-002).

## Rules engine design

The engine is a deterministic state machine: given compiled rules data, an encounter and a seed, it produces exactly the same fight every time. It has no DOM, no clock and no global randomness, so it runs identically in Node tests, Web Workers and, later, the RPG.

### Public API

```ts
createTrial(rules: CompiledRules, encounter: EncounterSpec, seed: Seed, opts?: TrialOptions): Trial
legalActions(trial: Trial): ReadonlyArray<ActionChoice>  // options for the creature whose turn it is
applyChoice(trial: Trial, choice: ActionChoice): StepResult  // resolves one choice, made by a person or the AI
rankChoices(trial: Trial, opts?: RankOptions): ReadonlyArray<RankedChoice>  // read-only: the AI's scored options, for "Show AI reasoning"
step(trial: Trial): StepResult            // lets the active creature's AI controller choose and apply
runToEnd(trial: Trial): TrialSummary      // fast path for batch simulation (every controller is AI)
replay(spec: ReplaySpec): Iterable<EngineEvent>  // re-runs a seed (plus any recorded choices) as an event stream
```

Each creature has a controller: `ai` (with a tactics profile) or `human`. Batch simulation forces every controller to `ai`. In Play mode the app calls `legalActions` and `applyChoice` for creatures the user controls, and `step` for the rest. The tactics AI is built on `legalActions` too, so people and the AI choose from exactly the same options and the engine enforces the rules the same way for both. A played session stores its list of choices, so `{ engineVersion, dataVersion, encounter, seed, choices }` replays it exactly.

`TrialOptions` sets the event detail level: `none` for batch runs (counters only), `summary`, or `full` for play and replays. With full detail, explain: { topN } also records the AI's ranked options for each AI turn (see Tactics AI).

### State model

- **Trial state** holds round, turn order, the active creature, the grid, every creature's state, the RNG state and counters. It is owned by one trial and mutated only inside engine step functions. Nothing outside the engine mutates it.
- **Creature state** holds a reference to its compiled template plus current HP, temporary HP, position, conditions with durations and sources, resource pools, per-turn budgets (action, bonus action, reaction, movement), concentration and death-save tallies.
- **Identifiers** are small integers assigned at trial creation, so hot loops index arrays instead of looking up maps.

### Turn loop

1. Roll initiative, with ties broken by Dexterity score and then by the RNG, both recorded.
2. For each turn: start-of-turn triggers, then condition and resource upkeep, then the tactics AI picks actions until the creature's budget is spent or it passes, then end-of-turn triggers and saving throws against ongoing effects.
3. Reactions (opportunity attacks, and Inazria reaction features) fire through the same trigger system and spend the reactor's reaction.
4. The trial ends when one side has no conscious creatures, or at a round cap (default 50, recorded as a draw).

### Rules coverage, in build order

1. Dice, advantage and disadvantage, critical hits and misses, ability checks and saving throws.
2. Attack rolls against AC, damage with resistance, immunity and vulnerability, and temporary HP.
3. Dropping to 0 HP, death saving throws, stabilizing, and instant death from massive damage.
4. SRD conditions with durations and the save that ends each one.
5. Grid movement, reach, opportunity attacks, difficult terrain and simple obstacles.
6. Area templates (sphere, cube, cone, line) on a 5-foot grid, using the SRD 5.1 rule for which squares are affected.
7. Concentration.
8. Inazria resources and features: Exertion, Devotion, Guile, Focus Points and context features, each cited to its guide page.

### Effects and triggers

Features, actions and conditions compile into handlers registered on named triggers (`onTurnStart`, `onAttackRoll`, `onHit`, `onDamaged`, `onSave`, `onMove`, `onReaction` and others). Handlers run in a fixed, documented order: the attacker's effects, then the target's, then other creatures in initiative order. Each handler is a pure function of (trial state, event context) that may queue further effects; a depth limit of 16 catches accidental infinite loops.

### Tactics AI

Each creature has a tactics profile chosen per side in the encounter builder.

- **Scoring:** for each legal option (action, target, position), estimate expected value: expected damage, the chance to drop a target, healing on allies below half HP, condition value and resource cost. Each score is a sum of named terms (profile weight × raw value), computed by one function in every mode, so the breakdown below costs nothing to keep honest. Pick the highest; break ties by a stable order, never by object iteration order.
- **Profiles:** `focus-fire` (lowest-HP target in reach), `nearest`, `threat` (highest damage dealer), `support` (heal and buff first) and `cautious` (avoids opportunity attacks and keeps resources).
- **Spend policy:** a per-profile threshold for when to spend Exertion, Devotion, Guile, Focus Points or slots, so balance tests can compare "spend freely" against "hoard".
- **Budget:** decisions consider one turn ahead only. Deeper search is a post-v1 decision record.

**Decision breakdown ("Show AI reasoning", off by default).** Inazria's rules are still changing, so Erick needs to see why the AI picked what it picked, not just the result. When the setting is on, every AI turn can be opened to show what it chose between:

- `rankChoices(trial, opts)` is a read-only engine function that scores the active creature's `legalActions()` and returns them ranked, each with its total score and its terms: hit chance, expected damage, chance to drop the target, healing value, condition value, opportunity-attack risk and resource cost, each shown as raw value, profile weight and weighted result. Every term lists the rule `sourceId`s that fed it (the attack's feature, the target's AC source, a resistance, a resource rule), so a strange number leads straight to the rule that caused it.
- Each candidate also shows the spend-policy check ("Exertion 1 of 2, cautious threshold 2: not spent") and, when the top scores tie, which stable tie-break decided it.
- With `TrialOptions.explain = { topN }` (default 5), `step()` emits an `AiDecision` event before the chosen action's events: the creature, its profile, the top N candidates, the chosen one and how many options were scored. Explain mode is only allowed with `events: 'full'`; batch runs (`events: 'none'`) never build a decision record.
- Scoring uses expected values and never draws from the PRNG, so explain mode cannot change a fight: the same seed gives the same choices, rolls and outcome with explain on or off. A test enforces this on every golden replay.
- Batch-simulated trials can still be explained, because Review rebuilds any trial with `replay()`; turning the setting on just replays it with explain mode.

### Determinism

- One seeded PRNG (sfc32, 128-bit state) lives in trial state. `Math.random`, `Date.now`, `performance.now` and `crypto` are banned in the engine by lint.
- Trial *n* of a batch uses `deriveSeed(masterSeed, n)`, so any trial can be replayed alone, and results never depend on worker count or order.
- Iteration over creatures, conditions and handlers always uses arrays sorted by stable IDs, never `Object.keys` order on objects built at runtime.
- A simulated trial is fully described by `{ engineVersion, dataVersion, encounter, seed }`.

### Event log

Events are a discriminated union (`TurnStarted`, `Moved`, `AttackRolled`, `DamageDealt`, `ConditionApplied`, `ResourceSpent`, `CreatureDowned`, `TrialEnded` and others). Each event carries the rule source ID that produced it, so the grid's event log can show "why" next to every roll. In batch mode events are not allocated; the engine only increments counters. AiDecision events, which list the options an AI weighed, exist only in explain mode.

### Performance rules inside the engine

- No object or array allocation inside the per-attack and per-turn paths in batch mode; reuse scratch buffers owned by the trial.
- Dice expressions are pre-parsed at data-compile time.
- Use typed arrays for hot per-creature numbers (HP, position, budgets) when profiling shows a win; keep the readable object model until it does.
- `vitest bench` covers the hot paths, and CI flags a regression of more than 10%.

## Simulation and performance

Batch speed comes from parallelism and allocation discipline, not from a faster language. A pool of Web Workers runs independent seeded trials, each worker aggregates its own results, and the main thread only merges small summaries, so the UI never stutters.

### Worker pool

- Pool size is `navigator.hardwareConcurrency - 1` (minimum 1, maximum 8), leaving one core for the UI.
- Workers are created with Vite's module-worker syntax, `new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' })`, and wrapped with Comlink for typed calls.
- Rules data is sent to each worker once per session, not once per batch.
- Work goes out in chunks of trial indices (default 250). Each worker returns a partial aggregate per chunk, which drives the progress bar.
- Cancelling sets a flag that every worker checks between trials; a batch stops within one chunk.
- **No SharedArrayBuffer.** It needs cross-origin isolation headers that GitHub Pages cannot send. Results come back as small objects or transferable typed arrays.

### What each trial reports

The winner or a draw, rounds taken, each creature's damage dealt and taken, healing done, resources spent, the round each creature dropped, and whether it died or stabilized. Workers fold these into running aggregates: counts, sums, sums of squares (for means and standard deviations) and fixed-bin histograms. Raw per-trial rows are never kept unless the user asks to export them.

### Results shown

- Win rate per side, with a 95% confidence interval.
- Rounds to victory as a histogram.
- Overall encounter stats, such as survival rate per creature, which creature often dies first, which creature/spell/abilities are the most impactful, etc.
- Damage dealt and taken per creature (mean and spread).
- Resource use: full recap of various resources used between each creature.
- Action usage (shown with Show AI reasoning on): how often the AI chose each action, feature and resource per creature.
- Any listed trial opens on the grid in Review mode.

### Performance budgets

These are targets to confirm in Phase 5. If one proves unrealistic, the agent writes a decision record with measurements rather than quietly changing it.

| Measure | Budget |
| --- | --- |
| 10,000 trials, 4v4, level 5, on an 8-thread laptop | under 10 seconds |
| Main-thread long tasks during a batch | none over 50 ms |
| Allocations per attack in batch mode | zero (checked with heap snapshots in a bench) |
| JavaScript for the first page, gzipped | under 200 KB, excluding PixiJS |
| PixiJS grid, 20 creatures | 60 frames per second |
| Engine hot-path regression in CI | fail above 10% |

### Profiling routine

1. Reproduce with a fixed seed and encounter saved under `packages/sim/bench/fixtures/`.
2. Measure with `vitest bench`, and in Chrome DevTools against a production build, never the dev server.
3. Change one thing, measure again, and record before and after numbers in the commit message.

### Determinism tests

The same `{ masterSeed, encounter, dataVersion }` must produce byte-identical aggregates with 1, 2 and 8 workers, and in Node versus the browser. To make that possible, partial aggregates are merged in chunk-index order, never in arrival order, and the engine uses integer math for dice and HP. This test runs in CI on every pull request.

## Storage and offline

Everything a user makes stays in their browser, and the app works offline after one visit. Each kind of data has one home, every stored record carries a schema version, and the user can always export their data to a file, because browsers may clear site data.

| Data | Where | Notes |
| --- | --- | --- |
| App code, rules data, icons | Cache Storage, via a service worker | Precached at install; versioned by build hash |
| Parties, encounters, homebrew creatures, settings | IndexedDB via Dexie | Small JSON records |
| Simulation run summaries | IndexedDB via Dexie | Aggregates only; capped at the 200 most recent runs |
| Exported raw trial rows, large replays | Origin Private File System | Only on request; never needed for normal use |
| Art packs (RPG phase) | Cache Storage, loaded per region or scene | Not in v1 |

### Dexie schema

- Tables: `parties`, `encounters`, `creatures` (homebrew), `runs`, `settings`, flags (rules-review notes from the AI reasoning view).
- Every record has `schemaVersion` and `dataVersion`.
- Schema changes use Dexie's versioned `upgrade()` functions. Each upgrade ships with a test that loads a fixture saved under the previous version and checks the migrated result.
- All database access goes through one module, `apps/web/src/lib/storage/db.ts`. Components never touch Dexie directly.

### Keeping data safe

- On first save, call `navigator.storage.persist()`. Show the result in Settings, alongside `navigator.storage.estimate()` usage.
- Wrap every write to catch `QuotaExceededError`, and offer export when it fires.
- **Export:** one JSON file with a header (`app`, `schemaVersion`, `dataVersion`, `exportedAt`) and all user records. **Import:** validate with Valibot, migrate older versions, preview the changes, then merge or replace.
- Settings explains, in one line, that Safari erases site data after seven days without a visit unless the app is installed to the home screen, and suggests exporting.

### Service worker

- Hand-written with SvelteKit 3's built-in service worker support (`src/service-worker.ts`, in its own TypeScript project per the SvelteKit 3 migration guide). The agent checks the current SvelteKit docs through the Svelte MCP server before writing it, because SvelteKit 3 moved the old `$service-worker` exports.
- Strategy: precache the build output and rules data; network-first for `index.html`; cache-first for hashed assets.
- When a new version is waiting, show an "Update available" toast; never reload mid-simulation.
- A web app manifest makes the simulator installable, which also exempts it from Safari's seven-day cleanup.

## UI and rendering

The app is one workspace at `/`, built around a single PixiJS grid that is used to build, play, simulate and review encounters. Panels and drawers change around the grid, but the grid itself never unmounts. SvelteKit stays for its static build, service worker and an easy path to more routes or a server later; for now the only other route is `/legal`, which holds the SRD attribution.

### Workspace layout

| Region | Contents |
| --- | --- |
| Top bar | Encounter name; mode switcher (Build · Play · Simulate · Review); Library and Settings buttons |
| Left panel | Party builder (race, class, context, level, equipment) and creature pickers (SRD monsters, homebrew) |
| Center | The grid, mounted once and shared by every mode |
| Right panel | Depends on mode: the selected creature's stats and tactics profile (Build), the current turn's legal actions and dice (Play), or the event log with rule sources (Review). With Show AI reasoning on, AI turns in Play and Review gain a "Why?" breakdown |
| Bottom drawer | Simulation settings and progress; results charts, tables and the trial list |
| Dialogs | Library, Settings (storage, export and import, theme, reduced motion, Show AI reasoning), homebrew creature editor |

### Modes

- **Build:** place both sides and terrain on the grid; choose each creature's controller (you or the tactics AI) and tactics profile.
- **Play:** run the encounter turn by turn like a tabletop session. On a creature you control, the right panel lists its legal actions, you pick targets on the grid, and the engine resolves the roll with the seeded RNG. AI-controlled creatures take their turns automatically. "Let AI finish" hands every remaining turn to the AI, and a played session can be saved and replayed like any trial. With Show AI reasoning on, each AI turn shows what it chose between, and your own creatures get an "Ask the AI" button.
- **Simulate:** run the Monte Carlo batch in workers. The grid shows the starting setup while the drawer shows progress and a Cancel button.
- **Review:** results fill the drawer. Choosing any trial, simulated or played, loads its events onto the grid with playback controls and the synchronized log. With Show AI reasoning on, every AI turn in the log opens to its ranked options.

### Show AI reasoning (optional)

A tuning aid for Inazria's work-in-progress rules, off by default and switched on in Settings (stored in the settings table, so it stays on until turned off). When it is off, none of this appears and nothing extra is computed.

- **Why? panel:** in Play and Review, each AI turn in the right-panel log gets a "Why?" disclosure. It opens a table of the top five options (action, target, position, total score) with the chosen one marked and its score terms beside it. Picking any row shows "why not this?": the term-by-term difference from the chosen option, for example "+2.1 expected damage, −3.0 opportunity-attack risk".
- **Rule links:** each term lists the rule sources behind it; selecting one opens that rule's text from the bundled data, the same way the event log does.
- **Grid highlights:** focusing or hovering a row highlights that option's target and destination on the grid (a `candidate` highlight kind), so positional choices are easy to read.
- **Ask the AI:** in Play, on a creature you control, this button runs `rankChoices` for the current turn and shows the same table without taking the turn, so you can compare your choice with the AI's.
- **Flag for rules review:** a button on any decision saves a short note with the run, trial, round and event index to the `flags` table. The Library lists flags, opens each one at that moment of its replay, and exports them all as Markdown to paste into the guide repo's notes or `OPEN_QUESTIONS.md`.
- **Action usage:** the results drawer adds a per-creature table of how often the AI chose each action, feature and resource across the batch, so a feature the AI never uses (and so the simulation never tests) stands out.
- The breakdown loads with dynamic `import()` the first time it is opened, like the other optional panels.

### URL state

There is one route, but the URL still records where the user is, so the back button, bookmarks and shared links work: `/?mode=build&enc=<id>` or `/?mode=review&run=<id>&trial=<n>`. A typed module, `workspace-url.ts`, parses and writes these parameters with Valibot validation; invalid values fall back to Build. Changing mode adds a history entry; opening a panel or dialog does not. Only `/` and `/legal` are prerendered, and the `404.html` fallback catches mistyped URLs.

### Loading

The first load brings the workspace shell, the compiled rules data and the PixiJS grid. Everything else loads on first use with dynamic `import()`: the simulation worker pool when Simulate first opens, LayerChart when results first appear, and the homebrew editor when its dialog first opens.

### Svelte 5 conventions

- Shared state lives in classes with `$state` fields inside `.svelte.ts` modules (for example `party.svelte.ts`). The agent does not create Svelte stores.
- Components take callback props (`onsave`) and snippets (`{#snippet row(item)}`), never event dispatchers or slots.
- Route data comes from `$app/state`, never `$app/stores` (removed in SvelteKit 3).
- App code imports from `#lib/...` with file extensions, per SvelteKit 3.
- Forms validate with the same Valibot schemas the data package uses, so the UI can never save a record the engine would reject.

### The grid (PixiJS v8)

- `@inazria/render` exports `createGridRenderer(host: HTMLElement, opts)`, which returns `{ setMode(mode), loadSetup(encounter), highlight(cells, kind), onCellAction(handler), load(events), seek(index), play(), pause(), setSpeed(x), destroy() }`. Svelte only drives this controller; it never touches Pixi objects.
- The `Grid.svelte` component is mounted once in the workspace. It creates the renderer inside an effect, awaits PixiJS's asynchronous `app.init()`, and calls `destroy()` in the effect's cleanup.
- Grid and terrain are drawn with the v8 Graphics API (`rect(...).fill(...)`) and cached as a texture. Tokens are sprites from one texture atlas (simple shapes until art exists). Damage numbers use BitmapText.
- **Build and Play input:** pointer and keyboard both work. Arrow keys move a cell cursor, Enter selects, and Escape cancels, so the grid is fully usable without a mouse. Legal moves and valid targets come from the engine's `legalActions()`; the renderer only highlights what it is given.
- **Review playback:** animation is driven by the event stream (move, swing, hit flash, damage number, condition icon). Seeking to event *i* gives the same picture as playing up to *i*. With reduced motion on, it steps without tweening.
- The synchronized text log in the right panel lists every event with its rule source, and it doubles as the accessible alternative to the canvas.

### Charts

LayerChart draws the results: win-rate bars with confidence whiskers, a rounds histogram and per-creature damage. Every chart has a data table toggle beside it.

### Look and accessibility

- Plain CSS with custom properties in one `tokens.css` (color, spacing, type) and Svelte's scoped styles. No CSS framework, so there are no extra build tools for the agent to misconfigure.
- Light and dark themes from `prefers-color-scheme`, with a manual override.
- Target WCAG 2.2 AA. Every builder works by keyboard alone; progress uses an `aria-live` region; color is never the only signal for side or status.
- The workspace is designed for laptop screens first; below 900 px wide, the side panels collapse into tabs above the drawer.

## Quality gates

One command, `pnpm check`, runs every fast gate, and a task is not done until it passes locally and in CI. Gates are never weakened to make code pass: no disabling rules, no lowering thresholds, no skipping tests, no `@ts-ignore`. If a gate seems wrong, the agent writes a decision record and asks Erick.

| Command | Runs | When |
| --- | --- | --- |
| `pnpm check` | format check, lint, typecheck (`tsc -b` + `svelte-check`), `data:check`, `rules:check`, unit and property tests with coverage | Before every commit (Lefthook runs the fast subset) and in CI |
| `pnpm verify` | `check` + production build + Playwright end-to-end tests + bundle-size check | Before marking a task done; in CI on pull requests |
| `pnpm bench` | `vitest bench` for engine and sim hot paths, compared against the saved baseline | Engine or sim changes; CI reports, and fails above a 10% regression |

### TypeScript settings

`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `isolatedModules`. TypeScript stays pinned to 6.0.x (see "Locked decisions").

### Lint rules beyond the presets

- typescript-eslint `strict-type-checked` and `stylistic-type-checked`, plus eslint-plugin-svelte's recommended config.
- Banned everywhere: `any`, non-null assertions (`!`), `enum` (use `as const` objects and union types), default exports outside framework files, and `console.log` outside scripts.
- Banned in `packages/engine` and `packages/data`: imports of `svelte`, `pixi.js`, `dexie` or anything browser-only; `Math.random`, `Date.now`, `performance.now`, `crypto`, `window`, `document`.
- Exhaustive `switch` over discriminated unions, ending in `assertNever`.

### Tests

- **Unit tests:** every engine module and every rules effect. Each rules test names the source it checks, for example `it('Exertion recharges on a short rest [inazria:classes/civil/fighter#Core Class Features > Exertion (1st Level)]')`.
- **Property tests (fast-check):** HP stays between 0 and max (plus temporary HP); resources never go negative; a creature never acts twice in one turn; every trial ends within the round cap; results are independent of creature list order once IDs are fixed.
- **Statistical checks:** hit chance against AC, advantage odds and average damage match the closed-form math within tolerance over 100,000 seeded rolls.
- **Golden replays:** 12 seeded fights saved as event streams under `packages/engine/test/golden/`. Any change to them must be explained in the commit and approved, because it means fight outcomes changed.
- **Determinism:** the 1-, 2- and 8-worker comparison from "Simulation and performance".
- Explain-mode invariance: every golden replay, and a fast-check property over random encounters and seeds, gives identical non-AiDecision events with explain on and off. The chosen option is always the top of rankChoices for that state.
- **End-to-end (Playwright, against the production build):** build a party, build an encounter, run 1,000 trials, see results, open a replay, play two turns by hand, export, re-import and reload offline.
- **Coverage minimums:** `engine` 90% lines and 85% branches; `data` and `sim` 85% lines; `apps/web` covered by end-to-end tests instead of a number.

### CI (GitHub Actions)

`ci.yml` runs on every push and pull request: install with a frozen lockfile, `pnpm verify`, `pnpm bench` (report), and an upload of the Playwright report on failure. `deploy.yml` runs on `main` after CI passes (see "Hosting and deployment").

## Agent operating model

The agent works in small, verified tasks from `docs/PROJECT_STATUS.md`, looks up current documentation instead of trusting memory, and stops at every phase boundary for Erick's review. Four files carry its working memory between sessions: `PLAN.md` (this document), `PROJECT_STATUS.md`, `OPEN_QUESTIONS.md` and the decision records.

### The task loop

1. **Orient.** Read `AGENTS.md`, then `PROJECT_STATUS.md`. Pick the first unblocked task in the current phase. If none is unblocked, stop and report why.
2. **Restate.** Write the task's acceptance criteria into the status file and mark the task `in progress`.
3. **Look up.** Fetch current docs for every library the task touches (see "Documentation lookup" below). Never write SvelteKit, Vite, Vitest, ESLint or PixiJS code from memory alone.
4. **Test first** for engine, data and sim work: write the failing test, including the rule source tag, then implement.
5. **Implement** within the task's scope only. Unrelated problems spotted along the way go into the status file as new tasks.
6. **Verify.** Run `pnpm verify`. For any `.svelte` file, run the Svelte MCP `svelte-autofixer` until it reports no issues. For engine or sim changes, run `pnpm bench`.
7. **Self-review** against the checklist below.
8. **Record.** Mark the task `done`, with the commands run and their result, and add a `CHANGELOG.md` line if users would notice the change.
9. **Commit** on a task branch using Conventional Commits (`feat(engine): add opportunity attacks`). Open a pull request into `main`; Erick merges.

### Task size

One concern per task, ideally under about 300 changed lines excluding data and tests. Larger tasks are split in the status file before any code is written.

### Self-review checklist

- Does every rule applied cite a source, and does a test cover it?
- Is the engine still free of DOM, Svelte, PixiJS, clocks and `Math.random`?
- Any Svelte 4 syntax, `$app/stores`, `$lib` or `svelte.config.js`? (All banned.)
- Any PixiJS v7 API (`beginFill`, `drawRect`, `new Application({...})` without `init`)? (All banned.)
- Any new dependency? It needs a decision record.
- Any weakened gate, skipped test or new `eslint-disable`? Undo it.
- Do the golden replays still match? If not, is the change intended and explained?

### Stop and ask Erick when

- A rule is unclear, contradictory or missing. Log it in `OPEN_QUESTIONS.md`, mark the record `blocked`, and continue with other tasks.
- A locked decision, dependency, performance budget or quality gate would need to change.
- Golden replays change for a reason other than the task's intended rule.
- Anything touches licensing, the Legal page or content from the GM-only repo.
- A phase is complete. Write a phase report (what was built, test and bench results, open questions, risks) and wait for approval before starting the next phase.

### Never

- Invent or rebalance Inazria rules; the simulator reports balance, it does not set it.
- Edit files under `packages/data/vendor/`.
- Add a server, a backend API, analytics or tracking.
- Commit secrets, or push directly to `main`.
- Mark a task done with a failing or skipped check.

### Documentation lookup

| Library | Where the agent looks |
| --- | --- |
| Svelte, SvelteKit | Svelte MCP server: `list-sections`, then `get-documentation`; `svelte-autofixer` on every component. Without MCP: [svelte.dev/llms.txt](https://svelte.dev/llms.txt) and the [SvelteKit 3 migration guide](https://svelte.dev/docs/kit/migrating-to-sveltekit-3) |
| PixiJS v8 | The Markdown guides indexed at [pixijs.com/llms.txt](https://pixijs.com/llms.txt), especially the [v8 migration guide](https://pixijs.com/8.x/guides/migrations/v8.md) |
| Vite 8, Vitest 5, ESLint 10, Dexie 4, Valibot, Comlink, Playwright | Each project's official docs for the installed major version |
| SRD 5.1 rules | The SRD 5.1 text (CC BY 4.0), cited by section |
| Inazria rules | Only the vendored guide pages in `packages/data/vendor/inazria/` |

### Decision records

`docs/decisions/NNNN-short-title.md`, with five headings: Context, Options considered, Decision, Consequences, Status (proposed, accepted or superseded). The agent may propose; only Erick accepts. Record 0001 captures the locked decisions in this plan.

## Agent rules files

The rules exist once and reach both agents. `AGENTS.md` holds the core instructions, and both Cursor and Claude Code read it. Topic rules live in `.claude/rules/*.md`, scoped by file path; a script generates Cursor's `.cursor/rules/*.mdc` copies from them, and CI fails if the two drift. The full files are delivered alongside this plan as `inazria-agent-kit.zip`, ready to copy into the new repo in task P0-07.

### How each agent loads them

| File | Claude Code | Cursor |
| --- | --- | --- |
| `AGENTS.md` | Through `CLAUDE.md`, which imports it with `@AGENTS.md` | Read natively |
| `CLAUDE.md` | Loaded every session | Not used |
| `.claude/rules/*.md` | Loaded when Claude reads or edits a file matching `paths` | Not used |
| `.cursor/rules/*.mdc` | Not used | Auto-attached when a file matching `globs` is in context |
| `.mcp.json` / `.cursor/mcp.json` | Svelte MCP server | Svelte MCP server |

CLAUDE.md imports AGENTS.md rather than relying on Claude Code reading AGENTS.md directly, because Claude Code skips AGENTS.md whenever a CLAUDE.md exists and some sessions cannot read it at all.

### The rule set

| Rule file | Applies to | What it enforces |
| --- | --- | --- |
| `svelte5.md` | `*.svelte`, `*.svelte.ts` | Runes only; a table of every banned Svelte 4 pattern and its replacement; MCP lookup and `svelte-autofixer` on every component |
| `sveltekit3.md` | `apps/web/**` | SvelteKit 2 habits that break in 3 (`svelte.config.js`, `$lib`, `$app/stores`, `$app/environment`, `$service-worker`); the single workspace route and its URL state; static-only rules; base path for GitHub Pages |
| `typescript.md` | `*.ts`, `*.svelte` | TypeScript pinned to 6.0.x; strict flags; no `any`, `!` or `enum`; discriminated unions with `assertNever`; `Result` for expected failures |
| `engine.md` | `packages/engine/**` | Purity and determinism; seeded randomness only; data-driven rules; `@rule` source tags; zero allocation in batch hot paths; explain mode is read-only and never changes outcomes |
| `game-data.md` | `packages/data/**` | Vendored guide is the only Inazria source; provenance on every record; the "blocked, not guessed" protocol for unclear rules; no OGL datasets |
| `simulation-workers.md` | `packages/sim/**`, `*.worker.ts` | Vite module workers and Comlink; chunking; merge in chunk order; no SharedArrayBuffer; clean disposal |
| `pixi8.md` | `packages/render/**` | A v7-to-v8 trap table; the controller boundary; seek equals play; reduced motion; only this package imports PixiJS |
| `storage-offline.md` | storage module, service worker, manifest | One Dexie module; versioned migrations with fixture tests; persistence and export; hand-written service worker |
| `testing.md` | tests, benches, e2e | Test-first for rules; property, statistical, golden and determinism tests; no `.only` or `.skip`; coverage minimums |
| `ui-accessibility.md` | `apps/web` components and CSS | Tokens-only CSS; WCAG 2.2 AA checklist; focus management for panels and dialogs; keyboard control of the grid; reduced motion; chart table toggles |
| `dependencies-and-security.md` | `package.json`, lockfile, workflows | Decision record per new dependency; TypeScript stays on 6; no runtime network calls; pinned Actions; `pnpm audit` |
| `docs-and-status.md` | `docs/**`, agent files | Status board format, open-question format, decision records; edit `.claude/rules` only, then `pnpm rules:sync` |

### Also in the kit

- `scripts/sync-agent-rules.ts`: generates the Cursor copies (`pnpm rules:sync`) and verifies them (`pnpm rules:check`). It runs on plain Node 24 with no dependencies.
- `docs/PROJECT_STATUS.md` seeded with the Phase 0 tasks, plus templates for `OPEN_QUESTIONS.md`, decision records and decision record 0001 recording this plan's locked stack.

### Changing a rule

Edit only the file in `.claude/rules/`, run `pnpm rules:sync`, and commit both. If the agent keeps needing the same correction, it proposes a rule change in the status file instead of editing rules on its own.

## Milestones

The build runs in ten phases, each ending with a phase report and Erick's approval. Phases are ordered so the riskiest part, encoding the rules correctly and running the engine deterministically, is proven before any UI exists. Task IDs (`P2-04`) are the ones the agent uses in `PROJECT_STATUS.md` and branch names.

### Phase 0: Repository and guardrails

- [ ] P0-01 Create the pnpm workspace: `.nvmrc` (24), `packageManager`, root scripts (`check`, `verify`, `bench`, `data:*`, `rules:*`).
- [ ] P0-02 `tsconfig.base.json` with the locked compiler options; project references; empty `data`, `engine`, `sim`, `render` packages with `exports`.
- [ ] P0-03 Create `apps/web` with the official Svelte CLI (`npx sv create`, checking its current SvelteKit 3 options first) and adapter-static.
- [ ] P0-04 ESLint 10 flat config with typescript-eslint, eslint-plugin-svelte and the project bans; Prettier with the Svelte plugin.
- [ ] P0-05 Vitest 5 with coverage thresholds and fast-check; Playwright against `vite preview`.
- [ ] P0-06 Lefthook pre-commit (format, lint staged files, fast tests).
- [ ] P0-07 Install the agent kit: `AGENTS.md`, `CLAUDE.md`, `.claude/rules/`, `scripts/sync-agent-rules.ts`, `.mcp.json`, `.cursor/mcp.json`.
- [ ] P0-08 `ci.yml`; `docs/` files: `PLAN.md`, `PROJECT_STATUS.md`, `OPEN_QUESTIONS.md`, decision record 0001, `CHANGELOG.md`.

**Accept when:** `pnpm verify` passes on a placeholder page; CI is green; adding `Math.random()` to the engine fails lint; `pnpm rules:check` fails if a `.cursor/rules` file is hand-edited.

### Phase 1: Rules data

- [ ] P1-01 Valibot schemas: core types, creature, resource pool, feature and effect vocabulary, `source`, `status`.
- [ ] P1-02 `data:pull` (sparse checkout at a pinned commit, `SOURCE.json`) and `check-provenance`.
- [ ] P1-03 SRD core: conditions, damage types, starting weapons and armor.
- [ ] P1-04 SRD monsters: the 20 starter stat blocks.
- [ ] P1-05 Inazria races.
- [ ] P1-06 Fighter, levels 1–5: contexts Champion, Paladin, Varnic Knight and Tarvanin; Exertion, and Devotion for Paladins; technique ranks Untrained, Familiar, Practiced and Mastered.
- [ ] P1-07 Savant, levels 1–5: contexts Koboda, Hari-Yudha, Loremaster and Ranger; Focus Points and the Focus die.
- [ ] P1-08 Vagabond, levels 1–5: contexts Slayer, Cusgarn, Silakar and Purple Mage; Guile; trick ranks matching Fighter techniques. Purple Mage spells are cited and marked not simulated.
- [ ] P1-09 Compile step: frozen typed lookups and the `dataVersion` hash.

**Accept when:** `data:check` passes; every record has a `source`; every ambiguity is in `OPEN_QUESTIONS.md` rather than guessed; Erick has reviewed the encoded classes against his guide.

### Phase 2: Engine core (no grid)

- [ ] P2-01 sfc32 PRNG, `deriveSeed`, dice with advantage and disadvantage.
- [ ] P2-02 Ability checks, saving throws, initiative.
- [ ] P2-03 Trial state, turn loop and action-economy budgets.
- [ ] P2-04 Attacks, critical hits, damage, resistance, vulnerability, immunity, temporary HP.
- [ ] P2-05 0 HP, death saves, stabilizing, massive damage.
- [ ] P2-06 SRD conditions with durations and end-of-turn saves.
- [ ] P2-07 Event stream, `replay()`, and the first six golden replays.
- [ ] P2-08 Statistical tests against closed-form 5e math.

**Accept when:** abstract fights (everyone in reach) run to completion; property, statistical and golden tests pass; engine coverage meets its minimums.

### Phase 3: Grid and tactics

- [ ] P3-01 Grid model, movement costs, reach, difficult terrain and obstacles.
- [ ] P3-02 Opportunity attacks and reactions through the trigger system.
- [ ] P3-03 Area templates (sphere, cube, cone, line) using the SRD 5.1 coverage rule.
- [ ] P3-04 `legalActions` and `applyChoice`, with per-creature controllers (`ai` or `human`) and recorded choices.
- [ ] P3-05 Tactics scoring and the five profiles, built on `legalActions`.
- [ ] P3-06 Resource spend policies.
- [ ] P3-07 Six more golden replays that use the grid, including one replayed from recorded human choices.
- [ ] P3-08 Decision breakdown: score terms with rule sources, rankChoices, explain mode and AiDecision events, and the invariance test.

**Accept when:** movement and opportunity-attack tests pass; the AI makes identical choices for identical seeds; golden replays are reviewed; explain mode leaves every golden replay unchanged and pnpm bench shows no batch slowdown.

### Phase 4: Inazria features

- [ ] P4-01 Resource pools wired to rests and triggers (Exertion, Devotion, Guile, Focus Points).
- [ ] P4-02 Context features, one task per class.
- [ ] P4-03 Script modules for any feature the effect vocabulary cannot express.
- [ ] P4-04 Concentration, if any encoded feature needs it.

**Accept when:** every feature has a cited test; Erick reads three full replay logs and confirms they match how he would rule.

### Phase 5: Simulation runner

- [ ] P5-01 Worker pool with Comlink, chunking, progress and cancellation.
- [ ] P5-02 Aggregates with means, spreads, histograms and 95% confidence intervals.
- [ ] P5-03 Determinism test across 1, 2 and 8 workers.
- [ ] P5-04 Benchmarks, baseline and the performance-budget check.
- [ ] P5-05 Action-usage counters: fixed-size integer arrays indexed by compiled action ID, merged like the other aggregates, within the bench budget.

**Accept when:** the budgets in "Simulation and performance" are met, or a decision record with measurements proposes new ones.

### Phase 6: Workspace

- [ ] P6-01 Workspace shell at `/`: layout regions, mode switcher, `tokens.css`, themes; the `/legal` page.
- [ ] P6-02 `workspace-url.ts`: typed, validated URL state with history entries per mode change.
- [ ] P6-03 Party builder and creature pickers in the left panel (encounters are assembled as lists until the grid lands in Phase 7).
- [ ] P6-04 Homebrew creature editor dialog with live validation.
- [ ] P6-05 Simulate drawer: settings, progress and cancel; lazy-loads the worker pool.
- [ ] P6-06 Results drawer: charts with table toggles and the trial list; lazy-loads LayerChart.
- [ ] P6-07 Library and Settings dialogs.

**Accept when:** the end-to-end flow (build a list-based encounter, simulate, read results) passes on one route against the production build; the back button restores the previous mode; keyboard-only use works, with focus moving into each panel or dialog on open and returning on close.

### Phase 7: The grid (build, play and review)

- [ ] P7-01 `@inazria/render` controller with PixiJS v8: grid, terrain, tokens and camera, mounted once in the workspace.
- [ ] P7-02 Build mode: place and move creatures and obstacles by pointer and keyboard.
- [ ] P7-03 Play mode: legal-action panel, target highlighting, per-creature controllers, "Let AI finish", and saving a played session.
- [ ] P7-04 Review mode: event-driven animation, seeking, speed control, the synchronized log with rule sources, reduced motion.
- [ ] P7-05 Show AI reasoning: the Settings toggle, Why? panels in Play and Review, Ask the AI, candidate highlights on the grid, flags with Markdown export, and the action-usage table.

**Accept when:** `seek(i)` matches playing to event *i*; a manually played session replays identically from its saved choices; Build and Play work keyboard-only; 60 fps with 20 creatures on a production build; with Show AI reasoning off, no breakdown code loads and no AiDecision events are made.

### Phase 8: Storage and offline

- [ ] P8-01 Dexie database and the storage module.
- [ ] P8-02 Persistence request, usage display and quota handling.
- [ ] P8-03 Export and import with preview and migration.
- [ ] P8-04 Service worker, manifest and update prompt.

**Accept when:** end-to-end tests pass for offline reload and for importing a file saved under an older schema.

### Phase 9: Release

- [ ] P9-01 `deploy.yml` to GitHub Pages with the base path for erickrj.tech.
- [ ] P9-02 Smoke test against the live URL.
- [ ] P9-03 README, CHANGELOG and the `v1.0.0` tag.

**Accept when:** every "v1 is done when" criterion in Goals is met.

### After v1

- The other published classes and their contexts: Magi, Berserker, Druid, Invoker and Ascetic.
- Spellcasting (the compendium is already published, including Purple Mage from 1st level), multiclassing, and levels 6–20.
- An encounter difficulty estimator built on simulation results.
- **RPG track:** a Phaser 4 evaluation spike against the PixiJS renderer; an asset pipeline with art packs on Cloudflare R2; scenes and exploration reusing `@inazria/engine` unchanged.

## Hosting and deployment

v1 deploys to GitHub Pages at `erickrj.tech/inazria-simulator/`, beside the Player's Guide, because the simulator ships only code and JSON. Hosting moves to Cloudflare once large art assets or paid content arrive.

### GitHub Pages (v1)

- `deploy.yml` runs on pushes to `main` after CI passes. It builds with `BASE_PATH=/inazria-simulator`, uploads `apps/web/build` as the Pages artifact, and deploys with GitHub's official Pages actions, pinned to commit SHAs.
- The base path comes from that environment variable in `vite.config.ts`, per the adapter-static docs. Every internal link and asset URL uses SvelteKit's path helpers, so the same build would work at a domain root.
- `fallback: '404.html'` gives a branded not-found page.
- No custom headers are possible on GitHub Pages. That is why the plan avoids `SharedArrayBuffer`, and why the cache policy lives in the service worker.

| GitHub Pages limit | Value | Effect on v1 |
| --- | --- | --- |
| Published site size | 1 GB | v1 should be well under 10 MB |
| Bandwidth | 100 GB/month (soft) | Ample for code and JSON |
| Builds | 10/hour (soft), unless deployed by a custom Actions workflow | Not a constraint with `deploy.yml` |
| Use | Not for online businesses or commercial software-as-a-service | Fine for a free playtest tool; revisit before selling anything |

Source: [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

### When to move (post-v1)

Move when art packs push past roughly 100 MB, traffic approaches the bandwidth limit, or anything becomes paid.

- **App:** [Cloudflare Pages](https://developers.cloudflare.com/pages/platform/limits/), free plan: 20,000 files, 25 MiB per file, 500 builds a month, no published bandwidth limit.
- **Assets:** [Cloudflare R2](https://developers.cloudflare.com/r2/pricing/), with 10 GB of free storage and no egress fees. Art packs are versioned, content-hashed and cached by the service worker per region or scene.
- The move is a deploy-workflow change plus a base-path change; no application code depends on the host.

## Risks and open questions

The biggest risk is not speed but trust: the simulator's numbers are only as good as the rules encoding and the tactics AI. The second is toolchain churn, since SvelteKit 3 is two days old and newer than the agent's training data.

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Agent writes SvelteKit 2 or Svelte 4 code | High | `sveltekit3.md` and `svelte5.md` trap tables; MCP doc lookup; `svelte-autofixer` on every component; lint bans |
| SvelteKit 3 ecosystem lags (plugins, examples) | Medium | Few plugins in the stack; hand-written service worker; fallback below |
| Rules encoded wrongly or guessed | Medium | Provenance on every record; "blocked, not guessed" protocol; Erick reviews encoded classes and replay logs in Phases 1 and 4 |
| Simple tactics AI skews balance results | High | Five profiles and spend policies to compare; results page states which profile produced the numbers; deeper AI after v1 |
| Performance budget not met in TypeScript | Low–medium | Benchmarks from Phase 2; allocation discipline; WebAssembly only via a decision record |
| Browser clears user data | Medium | Persistence request, export reminders, installable app |
| TypeScript 7 upgrade pressure from tooling | Medium | Pinned to 6.0.x until SvelteKit, svelte-check and typescript-eslint support 7 |
| Scope creep toward the RPG | Medium | RPG work only after v1, under its own plan |

### Decisions for Erick

- [ ] **SvelteKit 3 now, or SvelteKit 2 for agent reliability?** The plan uses 3 (current, docs and MCP up to date). Pinning SvelteKit 2 would match agents' training better but means a migration later.
- [ ] **Which public repo holds the Player's Guide content?** Needed for `data:pull` (Q-001).
- [ ] **Repo license** for code and for Inazria content (Q-002).
- [ ] **Levels 1–5 for v1?** Raising the cap adds encoding work in Phase 1 and Phase 4.
- [ ] **Encode SRD classes as baselines?** Comparing an Inazria Fighter against an SRD Fighter is a strong balance test, but it roughly doubles the class work.
- [ ] **Battle maps for v1:** open field with simple obstacles (as planned), or premade terrain maps?
- [ ] **Public or unlisted?** The plan assumes a public link beside the Player's Guide.

## Sources

Versions were read from the npm registry on October 8, 2026.

**Svelte and SvelteKit**

- [Svelte 5 migration guide](https://svelte.dev/docs/svelte/v5-migration-guide)
- [Migrating to SvelteKit 3](https://svelte.dev/docs/kit/migrating-to-sveltekit-3)
- [SvelteKit adapter-static](https://svelte.dev/docs/kit/adapter-static)
- [Svelte docs for LLMs](https://svelte.dev/docs/llms)
- [Svelte MCP server](https://svelte.dev/docs/ai/mcp), its [local setup](https://svelte.dev/docs/ai/local-setup) and [tools](https://svelte.dev/docs/ai/tools)

**PixiJS**

- [PixiJS v8 migration guide](https://pixijs.com/8.x/guides/migrations/v8)
- [PixiJS docs index for LLMs](https://pixijs.com/llms.txt)
- [PixiJS v8.20 release notes](https://gamedev.net/news/5221-pixijs-v8200-released/)
- [Phaser 4 release](https://gamedev.net/news/2759-phaser-4-released/)

**Agent configuration**

- [AGENTS.md](https://agents.md/)
- [Cursor rules](https://cursor.com/docs/context/rules)
- [Claude Code memory, AGENTS.md and path-scoped rules](https://code.claude.com/docs/en/memory)

**Hosting and storage**

- [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Storage for the web (web.dev)](https://web.dev/articles/storage-for-the-web)

**Prior art and data**

- [BattleCast](https://battlecast.gg) (all rights reserved)
- [BattleSim](https://github.com/Trekiros/battleSim) (CC BY-NC-SA 4.0)
- [5e-bits/5e-database](https://github.com/5e-bits/5e-database) (archived; OGL 1.0a data)
- [Inazria Player's Guide](https://erickrj.tech/inazria-players-guide/)
- [Web Frameworks in 2026: A Tiered Comparison](https://claude.ai/code/artifact/175fddab-8f09-443c-84c9-c2d2c0f5ea20), the companion doc
