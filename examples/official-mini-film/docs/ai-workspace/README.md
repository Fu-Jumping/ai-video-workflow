# AI Workspace

Marker: ai-video-workflow shared agent workspace.

`docs/ai-workspace/` is the shared AI documentation layer for this project. It gives Codex, Cursor, Claude Code, Trae, Cherry Studio, Obsidian projections, and MCP contexts the same starting point.

Read order:

1. `AGENTS.md`
2. `docs/ai-workspace/BOUNDARIES.md`
3. `docs/ai-workspace/HANDOFFS.md`
4. `docs/ai-workspace/PLATFORM_MATRIX.md`
5. Source Step files in `01_concept/` through `06_execution_plan/`

Source of truth:

- `project-step-files` means the project Step 1 to Step 6 Markdown files are the creative source of truth.
- Runtime mirror files are adapter surfaces, not project truth.
- Obsidian projections, MCP resources, and platform memory are not project truth.
- Platform memory is not project truth.

Cherry Studio compatibility:

- Cherry Studio may create `SOUL.md`, `USER.md`, and `memory/` in the project root.
- Treat those files as host/user memory and persona surfaces unless the project explicitly adopts them as a versioned collaboration protocol.
- Do not overwrite or delete them during cross-agent sync.
