# Adapter Boundaries

`ai-video-workflow` is not centered on one platform. It is centered on a verifiable AI video creation workflow.

## Mother Source

The default mother source is `packs/official-ai-video/`.

It defines:

- the Step 1 to Step 6 workflow
- templates
- skills
- quality gates
- the default enhanced flow
- file contracts

Platform adapters must not redefine these rules.

## What an Adapter Does

An adapter maps the same workflow into a platform-specific readable or executable location.

Examples:

- Codex, Cursor, Claude Code, and Trae place rules and skills into native runtime locations.
- Obsidian projects the files into a vault view for creation, review, and navigation.
- LibTV projects Step 4, Step 5, and Step 6 execution information into canvases, nodes, groups, or batch execution flows.
- MCP exposes the project as resources, prompts, and tools for agents.

## What an Adapter Must Not Do

- Create a second Step 1 to Step 6 workflow.
- Promote platform-specific fields into universal pack rules.
- Bypass Step 3 and Step 4 frame alignment.
- Weaken the fixed Step 4 file contract.
- Use absolute paths, drive-letter paths, `file://`, or IDE-specific URI links for documentation.
- Treat execution state as upstream creative truth.

## Suggested Integration Order

v0.2 should first complete the mainline demo loop.

Suggested later order:

1. Obsidian vault projection.
2. LibTV execution projection.
3. MCP server.
4. More AI IDE and agent platform adapters.

Before an adapter enters the mainline, it must define inputs, outputs, sync direction, rollback behavior, and verification commands.
