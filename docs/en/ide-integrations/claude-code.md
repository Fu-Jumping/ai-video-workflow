# Claude Code

Claude Code uses `CLAUDE.md` plus `.claude/` native runtime files.

## Adapter Contract

- Reads: `packs/official-ai-video/`, `project.config.yaml`, and project Step 1 to Step 6 files.
- Writes: `CLAUDE.md` and `.claude/` native runtime guidance.
- Must not write: source Step files, generated Obsidian projection files, user `.obsidian/` config, or absolute links.
- Sync direction: `runtime-mirror`.
- Source of truth: `project-step-files`.
- Verify with `ai-video-workflow verify --project <path> --ide claude-code`.
