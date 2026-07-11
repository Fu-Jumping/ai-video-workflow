# Codex

Codex keeps two runtime layers:

- `.codex/ai-video-workflow/` as the full runtime mirror
- `.codex/skills/` as runtime skill entrypoints

## Adapter Contract

- Reads: `packs/official-ai-video/`, `project.config.yaml`, and project Step 1 to Step 6 files.
- Writes: `.codex/ai-video-workflow/` and `.codex/skills/`.
- Must not write: source Step files, generated Obsidian projection files, user `.obsidian/` config, or absolute links.
- Sync direction: `runtime-mirror`.
- Source of truth: `project-step-files`.
- Verify with `ai-video-workflow verify --project <path> --ide codex`.
