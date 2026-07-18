# Release Process

Stage 1 focuses on local build, validation, and pack integrity.

## Release Notes

- [v0.3 Obsidian vault projection](./release-notes-v0.3.md)

## v0.3 Verification Gate

Run release checks serially because build, tests, and examples share `apps/cli/dist`.

```bash
pnpm build
pnpm test
pnpm example:verify
pnpm example:obsidian
pnpm example:obsidian:ui
pnpm example:obsidian:in-project
pnpm example:mcp-context
pnpm verify:v0.2
git diff --check
```

For Obsidian-related releases, also run the absolute-link scan documented in the v0.3 release notes. Manual QA should open `examples/官方示例-云上早市/_views/obsidian/` in Obsidian, not `examples/官方示例-云上早市/`.
