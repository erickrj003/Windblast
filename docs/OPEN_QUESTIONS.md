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
- Status: open

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
