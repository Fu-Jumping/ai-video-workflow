# Agent Handoffs

Marker: ai-video-workflow shared agent workspace.

Use this handoff boundary whenever one AI agent hands work to another.

Default prompt frame:

```text
Read AGENTS.md first, then read docs/ai-workspace/README.md and docs/ai-workspace/BOUNDARIES.md. Treat project-step-files as the source of truth. Edit Step files only when changing project truth. Do not edit runtime mirror files, Obsidian projections, MCP resources, Cherry Studio SOUL/USER/memory files, or platform memory as source files.
```

Change routing:

- Story and narrative frame changes go to Step 3 storyboard files.
- Visual consistency and image prompt changes go to Step 4 image prompt files.
- Motion and camera behavior changes go to Step 5 video prompt files.
- Execution organization changes go to Step 6 execution plan files.

After edits, run `ai-video-workflow verify --project <path> --ide <id>`. Platform memory is not project truth. Cherry Studio `SOUL.md`, `USER.md`, and `memory/` are host/user surfaces unless the user explicitly asks to maintain them.
