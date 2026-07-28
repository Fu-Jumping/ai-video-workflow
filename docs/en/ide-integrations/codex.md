# Codex

Codex keeps two runtime layers:

- `.codex/ai-video-workflow/` as the full runtime mirror
- `.codex/skills/` as runtime skill entrypoints

Read `AGENTS.md` and `文档/智能体工作区/` before using the Codex runtime mirror.

## Adapter Contract

- Reads: `packs/official-ai-video/`, `project.config.yaml`, and the enabled project Step files; research mode includes Step 0 through Step 6, while script mode includes Step 1 through Step 6.
- Writes: `.codex/ai-video-workflow/` and `.codex/skills/`.
- Must not write: source Step files, generated Obsidian projection files, user `.obsidian/` config, or absolute links.
- Sync direction: `runtime-mirror`.
- Source of truth: `project-step-files`.
- Verify with `ai-video-workflow verify --project <path> --ide codex`.
