@AGENTS.md

## Claude Code specifics

- Topic rules in `.claude/rules/` load automatically when you read or edit matching files. They are the source of truth; `.cursor/rules/` is generated from them by `pnpm rules:sync`. Edit only `.claude/rules/`, then run `pnpm rules:sync`.
- The Svelte MCP server is configured in `.mcp.json`. Use it for every Svelte or SvelteKit question and run `svelte-autofixer` on every `.svelte` file you write.
- Use plan mode for any task that touches more than one package.
- Keep `docs/PROJECT_STATUS.md` current; it is how the next session knows where you stopped.
