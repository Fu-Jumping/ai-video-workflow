# v0.2 Roadmap: Mainline Demo Loop

## Goal

v0.2 should let a new user clone the repo, initialize a project, inspect the official example, run verification, and understand where future platform adapters fit.

## Required

- `init` supports non-interactive options.
- The official example demonstrates the smallest Step 1 to Step 6 loop.
- `verify` checks key file contracts and link risks.
- `doctor` gives actionable remediation.
- Docs explain adapter boundaries.
- Quickstart covers build, init, verify, doctor, and sync.

## Not Included

- No Obsidian plugin.
- No LibTV canvas automation.
- No MCP server.
- No direct image or video platform calls.
- No workflow marketplace.

## Later Direction

After v0.2 is stable:

1. v0.3 Obsidian vault projection: start with one-way generation for reading, review, Bases, and Canvas views without developing an Obsidian plugin.
2. LibTV execution projection.
3. MCP server.
4. More agent platform adapters.

See [Obsidian vault projection](./obsidian-vault-projection.md) for the adapter boundary.
