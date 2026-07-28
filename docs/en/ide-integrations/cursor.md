# Cursor

Cursor uses `.cursor/rules/` as the native rule entry, `.cursor/skills/` as adapter-ready skill bundles, and `.cursor/ai-video-workflow/` as the runtime mirror.

Read `AGENTS.md` and `文档/智能体工作区/` before using Cursor rules.

## Adapter Contract

- Reads: `packs/official-ai-video/`, `project.config.yaml`, and the enabled project Step files; research mode includes Step 0 through Step 6, while script mode includes Step 1 through Step 6.
- Writes: `.cursor/rules/`, `.cursor/skills/`, and `.cursor/ai-video-workflow/`.
- Must not write: source Step files, generated Obsidian projection files, user `.obsidian/` config, or absolute links.
- Sync direction: `runtime-mirror`.
- Source of truth: `project-step-files`.
- Verify with `ai-video-workflow verify --project <path> --ide cursor`.
