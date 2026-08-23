# Adapter Boundaries

`ai-video-workflow` is not centered on one platform. It is centered on a verifiable AI video creation workflow.

## Mother Source

The default mother source is `packs/official-ai-video/`.

It defines:

- the enabled Step workflow; research mode includes Step 0 through Step 6, while script mode includes Step 1 through Step 6
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
- Cherry Studio uses the project working directory and shared docs as context without generating host memory or persona files in v0.6.
- Obsidian projects the files into a vault view for creation, review, and navigation.
- LibTV projects Step 4, Step 5, and Step 6 execution information into canvases, nodes, groups, or batch execution flows.
- MCP exposes the project as resources, prompts, and tools for agents; see [MCP adapter](./mcp-adapter.md) for the read-only starting boundary.

## What an Adapter Must Not Do

- Create a second Step workflow.
- Promote platform-specific fields into universal pack rules.
- Bypass Step 3 and Step 4 frame alignment.
- Weaken the fixed Step 4 file contract.
- Use absolute paths, drive-letter paths, `file://`, or IDE-specific URI links for documentation.
- Treat execution state as upstream creative truth.
- Copy host-level memory, persona files, platform caches, or credentials into shared project truth.

## Suggested Integration Order

v0.2 should first complete the mainline demo loop.

Suggested later order:

1. Obsidian vault projection.
2. LibTV execution projection.
3. MCP server.
4. Cross-agent workspace consistency.
5. More AI IDE and agent platform adapters.

Before an adapter enters the mainline, it must define inputs, outputs, sync direction, rollback behavior, and verification commands.

Use the [Agent adapter contract](./agent-adapter-contract.md) as the required checklist before adding or expanding platform-specific integrations.

## LibTV Asset Adapter

`ai-video-workflow libtv ...` is the LibTV asset execution adapter.

Scope:

- Upload Step 2 anchor images (character tri-views and scene images) to LibTV as image nodes.
- Create Step 4 keyframe image nodes with reference edges to anchor assets.
- Create Step 5 video nodes with reference edges to keyframes and anchor assets.
- Run image/video generation through LibTV HTTP API and record results in `.libtv/state.json`.
- Download generated assets to `outputs/images/...` and `outputs/video/...`.
- Support image review and two-stage refine: `libtv review` (direct/refine/regenerate) → `libtv refine` (GPT Image 2 / `lib-image-2` refine nodes) → `libtv approve` (the refined image joins the main chain via `finalNodeId`, status `final_approved`).

Out of scope:

- Story/plot/shooting design.
- `script storyboard` or any canvas-side script/storyboard logic.
- Editing Step source files from canvas state.

Boundary rules:

- Step files remain the only creative source of truth.
- `.libtv/` and `outputs/` are gitignored local execution surfaces.
- Keyframes must be manually approved (`libtv approve`) before video generation is allowed; when refine rounds exist, the main chain uses the latest refined image.
- `libtv refine` triggers real generation; the CLI requires an explicit `--allow-generation` flag and refuses to run without it.
- Edge order is written to `imageListOrder` / `mixedListOrder` in `--left` order, and `libtv verify-order` checks the Step 5 upload-order contract; `&#123;&#123;Node "name"&#125;&#125;` placeholders are rewritten to `&#123;&#123;Image n&#125;&#125;` / `&#123;&#123;Mixed n&#125;&#125;` by reference order (see the [LibTV asset adapter](./libtv-asset-adapter.md)).
