# Boundaries

Marker: ai-video-workflow shared agent workspace.

The project uses `project-step-files` as its only creative source of truth.

Editable source areas:

- `01_concept/`
- `02_setting/`
- `03_storyboard/`
- `04_image_prompts/`
- `05_video_prompts/`
- `06_execution_plan/`

Generated or adapter-only areas:

- `.codex/` runtime mirror
- `.cursor/` runtime mirror
- `.claude/` runtime mirror
- `.trae/` runtime mirror
- `SOUL.md`, `USER.md`, `soul.md`, `user.md`, and root `memory/` when created by Cherry Studio
- Obsidian projection directories such as `Workflow/`, `Shots/`, `Canvas/`, and `Bases/`
- MCP resources and prompts

Do not treat runtime mirror files, Obsidian projections, MCP resources, Cherry Studio host memory/persona files, or platform memory as project truth. Platform memory is not project truth.
