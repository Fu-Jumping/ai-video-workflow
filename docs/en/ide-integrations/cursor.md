# Cursor

Cursor uses `.cursor/rules/` as the native rule entry, `.cursor/skills/` as adapter-ready skill bundles, and `.cursor/ai-video-workflow/` as the runtime mirror.

## Adapter Contract

- Reads: `packs/official-ai-video/`, `project.config.yaml`, and project Step 1 to Step 6 files.
- Writes: `.cursor/rules/`, `.cursor/skills/`, and `.cursor/ai-video-workflow/`.
- Must not write: source Step files, generated Obsidian projection files, user `.obsidian/` config, or absolute links.
- Sync direction: `runtime-mirror`.
- Source of truth: `project-step-files`.
- Verify with `ai-video-workflow verify --project <path> --ide cursor`.
