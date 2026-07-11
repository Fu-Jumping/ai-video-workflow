# Testing

- `pnpm build`
- `pnpm test`
- `pnpm example:verify`
- `pnpm example:obsidian`
- `pnpm example:obsidian:ui`
- `pnpm verify:v0.2`
- `git diff --check`

Run commands that touch `apps/cli/dist` serially. The built-CLI tests and example scripts rebuild or read the same `dist` directory, so parallel execution can create false failures.
