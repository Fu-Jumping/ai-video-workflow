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

## Completed Since v0.2

v0.3 delivered the Obsidian vault projection as a one-way adapter:

- safe incremental export
- generated dashboards, Bases, and Canvas maps
- single-shot immersive review pages
- Agent Handoff pages for source-file editing context
- optional UI suggestions
- real-vault QA through `pnpm example:obsidian:ui`

See [Obsidian vault projection](./obsidian-vault-projection.md) for the adapter boundary.

## Next Direction

After v0.3, the next priority is not more Obsidian surface area. The next priority is a platform-neutral agent adapter contract.

Suggested order:

1. v0.3 release consolidation and release notes.
2. v0.4 agent adapter contract for Codex, Cursor, Claude Code, Trae, MCP, and future adapters.
3. v0.4.1 to v0.4.5 Codex, Cursor, Claude Code, and Trae adapter hardening with runtime verification.
4. v0.5: MCP read-only context adapter. Start with resources, prompts, and read-only diagnostics. Write tools and LibTV execution remain postponed.
5. LibTV execution projection after the platform and CLI are stable enough to validate against real state.

## Completed Since v0.4

v0.4 defined the platform-neutral adapter contract and added concrete runtime mirror checks for the first IDE adapters:

- Codex runtime mirror contract and verification.
- Cursor runtime mirror contract and verification.
- Claude Code runtime mirror contract and verification.
- Trae runtime mirror contract and verification.
- `doctor` remediation that points missing runtime files to the matching `sync --ide <id>` command.

## v0.5 Direction

v0.5 should introduce MCP as a read-only context adapter:

- expose project and shot context through MCP resources
- provide agent handoff prompts for project review and shot revision
- add only read-only tools such as project summary, shot lookup, and verification diagnostics
- keep Step files as the source of truth
- avoid write tools, Obsidian mutation, IDE runtime sync, generation-platform calls, and LibTV execution
