# Inazria agent kit

Agent instructions and project scaffolding for `erickrj003/inazria-simulator`. Copy everything in this folder into the root of the new repo during task P0-07, except this README.

## What's here

| Path | Purpose |
| --- | --- |
| `AGENTS.md` | Core instructions, read by Cursor and (through `CLAUDE.md`) Claude Code |
| `CLAUDE.md` | Imports `AGENTS.md`; Claude Code specifics |
| `.claude/rules/*.md` | Topic rules scoped by file path. **The source of truth.** |
| `.cursor/rules/*.mdc` | Generated from `.claude/rules`. Do not edit. |
| `.mcp.json`, `.cursor/mcp.json` | Svelte MCP server for each agent |
| `scripts/sync-agent-rules.ts` | `node scripts/sync-agent-rules.ts [--check]` |
| `docs/PROJECT_STATUS.md` | Task board seeded with Phase 0 |
| `docs/OPEN_QUESTIONS.md` | Questions for Erick (two already open) |
| `docs/decisions/` | Decision record template and 0001 (locked stack) |
| `docs/CHANGELOG.md` | Empty changelog |

Add `docs/PLAN.md` by exporting the plan doc to Markdown.

## Root `package.json` scripts to add

```json
{
  "scripts": {
    "rules:sync": "node scripts/sync-agent-rules.ts",
    "rules:check": "node scripts/sync-agent-rules.ts --check"
  }
}
```
