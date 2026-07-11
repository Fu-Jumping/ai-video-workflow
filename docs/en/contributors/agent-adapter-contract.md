# Agent Adapter Contract

The agent adapter contract defines how each IDE, agent runtime, vault projection, or future automation layer consumes `ai-video-workflow` without creating a second workflow source.

## Why This Exists

`ai-video-workflow` is centered on one verifiable workflow: the `official-ai-video` pack and the project Step 1 to Step 6 Markdown files. Agent platforms can make that workflow easier to read, sync, or execute, but they must not reinterpret the workflow independently.

This contract gives every adapter the same checklist:

- what it reads
- what it writes
- which direction data flows
- where handoff prompts live
- how users verify it
- what it must never write
- how it behaves when files already exist or are modified

## Required Fields

Every adapter description should define these fields:

- `adapterId`: stable lowercase id such as `codex`, `cursor`, `claude-code`, `trae`, `obsidian`, or `mcp`.
- `displayName`: reader-facing name.
- `inputs`: project, pack, and source files read by the adapter.
- `outputs`: generated files, runtime mirrors, or read-only surfaces produced by the adapter.
- `syncDirection`: one of `runtime-mirror`, `one-way-project-to-adapter`, or `read-only-context`.
- `sourceOfTruth`: must be `project-step-files`.
- `handoffSurfaces`: pages, prompts, rules, resources, or generated notes that tell an agent what to inspect or edit.
- `verificationCommands`: commands that prove the adapter is healthy.
- `forbiddenWrites`: paths or file classes the adapter must not edit.
- `failureBehavior`: how the adapter handles conflicts, missing files, stale generated files, and user-owned state.

## Sync Direction Taxonomy

`runtime-mirror`

The adapter copies pack/runtime guidance into a platform-specific location. Codex, Cursor, Claude Code, and Trae integrations usually fit here.

`one-way-project-to-adapter`

The adapter projects project files into a richer reading or execution surface. Obsidian vault projection fits here.

`read-only-context`

The adapter exposes project files as context without writing project or runtime files by default. MCP resources and prompts should start here.

## Source-of-Truth Rules

- Step 1 to Step 6 project Markdown files remain the creative source.
- `packs/official-ai-video/` remains the workflow pack source.
- Generated adapter output must point back to source Step files when edits are needed.
- Execution state can inform status, but it cannot become upstream creative truth.
- Platform-specific settings must not redefine Step contracts.

## Handoff Rules

Agent handoff surfaces must tell the agent:

- which source Step files to inspect
- which source Step files may be edited
- which generated files must not be edited
- which verification commands to run afterward

For video workflow changes:

- story and frame changes go to Step 3
- visual prompt and consistency changes go to Step 4
- motion and camera behavior changes go to Step 5

## Verification Rules

Each adapter must have at least one verification path. A good adapter verification checks:

- required generated or mirrored files exist
- relative links are used
- source paths resolve
- platform-specific output does not redefine the core workflow
- user-owned config is preserved when applicable

## Forbidden Behavior

Adapters must not:

- create another Step 1 to Step 6 workflow
- weaken Step 3 to Step 4 frame alignment
- weaken the Step 4 file contract
- write absolute local links into docs or generated projection files
- overwrite user-owned local platform state by default
- treat Obsidian notes, IDE runtime files, MCP resources, or LibTV execution state as creative source files

## Adapter Examples

### Codex

- Reads: official pack docs and skills.
- Writes: `.codex/ai-video-workflow/` runtime mirror and `.codex/skills/` skill entrypoints.
- Direction: `runtime-mirror`.
- Verify: `ai-video-workflow verify --project <path> --ide codex`.

### Cursor

- Reads: official pack rules and workflow docs.
- Writes: Cursor-readable runtime guidance.
- Direction: `runtime-mirror`.
- Verify: adapter-specific sync plus project verification.

### Claude Code

- Reads: official pack rules and workflow docs.
- Writes: Claude Code-readable guidance.
- Direction: `runtime-mirror`.
- Verify: adapter-specific sync plus project verification.

### Trae

- Reads: official pack rules and workflow docs.
- Writes: Trae-readable guidance.
- Direction: `runtime-mirror`.
- Verify: adapter-specific sync plus project verification.

### Obsidian

- Reads: project Step files.
- Writes: generated vault projection files, manifest, Bases, Canvas, dashboards, and optional UI suggestions.
- Direction: `one-way-project-to-adapter`.
- Verify: `verify-obsidian`.

### MCP

- Reads: project Step files and pack metadata.
- Writes: no project files by default; exposes resources, prompts, and tools.
- Direction: `read-only-context` at first.
- Verify: server contract tests and project verification.

See [MCP adapter](./mcp-adapter.md).
