# Testing

- `pnpm build`
- `pnpm test`
- `pnpm example:verify`
- `pnpm example:obsidian`
- `pnpm example:obsidian:ui`
- `pnpm example:obsidian:in-project`
- `pnpm example:mcp-context`
- `pnpm verify:v0.2`
- `git diff --check`

Run commands that touch `apps/cli/dist` serially. The built-CLI tests and example scripts rebuild or read the same `dist` directory, so parallel execution can create false failures.

For Obsidian manual QA, open `examples/official-mini-film/_views/obsidian/` in Obsidian, not `examples/official-mini-film/`.
