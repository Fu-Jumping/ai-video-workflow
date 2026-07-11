# MCP Adapter

The MCP adapter exposes an `ai-video-workflow` project to agent clients as read-only context.

MCP adapter work starts with resources, prompts, and read-only tools. It must not become another workflow source, and it must not silently edit project files.

## Purpose

The adapter helps an agent understand the project without guessing the repository layout:

- which workflow pack is active
- which Step 1 to Step 6 files define the project
- which shots exist
- which Step 3, Step 4, Step 5, and Step 6 files belong to each shot
- which source file should be edited for story, image prompt, motion, or execution-plan changes
- which verification commands should run after edits

The Step files remain the source of truth.

## Read-Only First

The MCP adapter is a context and handoff surface. It is not a project editor, not an Obsidian sync layer, and not a LibTV execution layer in v0.5.

Initial MCP work should use `syncDirection: "read-only-context"` in the adapter contract. That means:

- read project Step files and pack metadata
- expose stable resources and prompts
- expose only read-only diagnostics tools
- report invalid or missing files instead of repairing them
- leave all edits to normal workspace tools and source Step files

## Resources

Resources should expose stable, project-relative context. Suggested resources include:

- `ai-video-workflow://project/summary`
- `ai-video-workflow://project/config`
- `ai-video-workflow://pack/official-ai-video/overview`
- `ai-video-workflow://workflow/step/1`
- `ai-video-workflow://workflow/step/2`
- `ai-video-workflow://workflow/step/3`
- `ai-video-workflow://workflow/step/4`
- `ai-video-workflow://workflow/step/5`
- `ai-video-workflow://workflow/step/6`
- `ai-video-workflow://shots/index`
- `ai-video-workflow://shots/{shotId}`
- `ai-video-workflow://handoff/project`
- `ai-video-workflow://verification/commands`

Resource bodies should use project-relative paths. Do not expose drive-letter paths, `file://` links, IDE URIs, or machine-local absolute paths.

## Prompts

Prompts should be copy-ready handoff templates for common agent tasks:

- `review_project`
- `inspect_shot`
- `revise_storyboard`
- `revise_image_prompt`
- `revise_video_prompt`
- `verify_project`

Prompt text must tell the agent:

- read source Step files first
- edit only source Step files when changes are needed
- do not edit Obsidian projections, IDE runtime mirrors, or MCP resources as source files
- run verification after edits

For content changes:

- story and frame changes belong in Step 3
- visual prompt and consistency changes belong in Step 4
- motion and camera behavior changes belong in Step 5
- execution logistics belong in Step 6

## Tools

v0.5 tools should be read-only:

- `get_project_summary`
- `list_shots`
- `get_shot_context`
- `run_project_verify`

`run_project_verify` may call the existing verifier and return issues. It must not repair files, sync runtime mirrors, export Obsidian vaults, or trigger generation platforms.

## Forbidden Writes

The MCP adapter must not write:

- `01_concept/`
- `02_setting/`
- `03_storyboard/`
- `04_image_prompts/`
- `05_video_prompts/`
- `06_execution_plan/`
- generated Obsidian projection folders such as `Workflow/`, `Shots/`, `Canvas/`, and `Bases/`
- `.obsidian/`
- `.codex/`
- `.cursor/`
- `.claude/`
- `.trae/`
- LibTV execution state
- local absolute links

Any future write tool needs a separate implementation plan, explicit opt-in behavior, source-file boundaries, conflict handling, and tests.

## Verification

The adapter should be verified in layers:

1. Contract fixture: `mcp.contract.json` uses `read-only-context`.
2. Context builder: project summary and shot mapping are deterministic.
3. Server registry: resources, prompts, and tools expose the expected names.
4. Safety checks: output uses project-relative paths and read-only tools only.
5. Project verification: existing workflow checks still pass.

Planned commands:

```bash
ai-video-workflow mcp-context --project <path>
ai-video-workflow mcp-server --project <path>
```

`mcp-server` should be a long-running stdio server. Do not put it in scripts that must exit.

## Future Write Tools

Write tools are deliberately out of scope for v0.5. Before adding them, define:

- which Step files each tool may edit
- how conflicts are detected
- how user edits are preserved
- whether changes are patches or full rewrites
- how verification runs after edits
- how the tool reports that generated surfaces must be regenerated

Until that exists, MCP is a read-only context adapter.
