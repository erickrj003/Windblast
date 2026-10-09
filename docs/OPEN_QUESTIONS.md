# Open questions

Rules gaps and decisions waiting on Erick. The agent adds entries; Erick answers them. Never delete an entry: mark it `answered` and link the commit that applied the answer.

## Template

```markdown
## Q-NNN: <one-line question>
- Source: inazria:<page>#<section> @ <commit>   (or srd51:<section>)
- Quote: "<exact text from the source>"
- Readings:
  - (a) …
  - (b) …
- Blocks: <content files or tasks marked blocked>
- Status: open | answered (<date>, <commit>) | withdrawn
- Answer: <Erick's ruling, verbatim>
```

## Questions

## Q-001: Which public repository holds the Player's Guide content?
- Source: plan, "Rules data pipeline"
- Readings: (a) the Quartz repo that publishes erickrj.tech/inazria-players-guide; (b) a content-only repo it pulls from
- Blocks: P1-02 `data:pull`
- Status: answered (2026-10-08, recorded at the Phase 0 review; applied in P1-02)
- Answer: "Use this URL: https://github.com/erickrj003/inazria-players-guide"

## Q-002: What license should the simulator repo use?
- Source: plan, "Rules data pipeline → Licensing"
- Readings: (a) MIT for code, Inazria content all rights reserved; (b) MIT for code, Inazria content CC BY-NC 4.0; (c) other
- Blocks: P0-01 `LICENSE` file, P6-01 Legal page
- Status: answered (2026-10-08, applied in P0-01 `LICENSE`)
- Answer: (a) MIT for code, Inazria content all rights reserved.

## Q-003: Should the deploy base path follow the repo name `Windblast`?
- Source: plan, "Hosting and deployment" (`BASE_PATH=/inazria-simulator`, `erickrj.tech/inazria-simulator/`)
- Readings: (a) deploy at `erickrj.tech/Windblast/` (GitHub Pages uses the repo name; the path is case-sensitive); (b) rename the repo to `inazria-simulator` before Phase 9; (c) keep `Windblast` and serve the simulator from a custom path or subdomain
- Blocks: P9-01 `deploy.yml`
- Status: open

## Q-004: Does the Human 10th-level +1 have to be a third ability score?
- Source: inazria:races/humans#Traits @ 23a5f30fff291f77e01939feea769ecedad57446
- Quote: "+1 to two different ability scores of your choice. At 10th level, you may add +1 to another ability score."
- Readings:
  - (a) the 10th-level +1 must be a score that is not one of the two chosen at 1st level
  - (b) "another" means one additional +1, which may go on a score already increased
- Blocks: character-build UI for Humans at level 10 (v1 is levels 1–5, so this does not affect play yet). Encoded as a second choice grant of +1 at level 10 with `distinct: false` (reading b) in `content/inazria/races/human.json`.
- Status: open

## Q-005: What does Veteran's Focus add when Exertion already refills on a short rest?
- Source: inazria:classes/civil/fighter#Fighter @ 23a5f30fff291f77e01939feea769ecedad57446
- Quote: "You regain all expended Exertion when you finish a short or long rest." and "When you finish a short rest, you regain 1 expended Exertion (in addition to the Exertion you normally regain)."
- Readings:
  - (a) Exertion still refills completely on a short rest, so Veteran's Focus adds a point only if something left the pool short of full; it never raises the pool above its maximum
  - (b) a short rest was meant to regain only 1 Exertion (Veteran's Focus), and "all expended" applies to a long rest
  - (c) Veteran's Focus grants 1 Exertion even above the maximum
- Blocks: nothing yet. Encoded as reading (a): Exertion's recharge is `pool-max` on a short or long rest, and `veterans-focus` is a script for the extra point. `content/inazria/classes/fighter.json`
- Status: open
