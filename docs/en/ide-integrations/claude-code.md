# Claude Code

Claude Code uses `CLAUDE.md` as the root entrypoint, `.claude/skills/` as adapter-ready skill bundles, `.claude/commands/` as command-style handoff entries, and `.claude/ai-video-workflow/` as the generated runtime mirror.

## Generated outputs

`sync --ide claude-code` writes:

- `CLAUDE.md`
- `.claude/skills/`
- `.claude/commands/ai-video-workflow.md`
- `.claude/ai-video-workflow/WORKFLOW_OVERVIEW.md`
- `.claude/ai-video-workflow/workflow/`
- `.claude/ai-video-workflow/skills/`
- `.claude/ai-video-workflow/skill-bundles/`
- `.claude/ai-video-workflow/templates/`
- `.claude/ai-video-workflow/indexes/`

Claude Code should read the root entry first, then follow the mirror and skill bundle links. When changing the project, edit the source Step files, not the generated runtime mirror or Obsidian projection files.

## Adapter Contract

- Reads: `packs/official-ai-video/`, `project.config.yaml`, and project Step 1 to Step 6 files.
- Writes: `CLAUDE.md`, `.claude/skills/`, `.claude/commands/`, and `.claude/ai-video-workflow/`.
- Must not write: source Step files, generated Obsidian projection files, user `.obsidian/` config, or absolute links.
- Sync direction: `runtime-mirror`.
- Source of truth: `project-step-files`.
- Verify with `ai-video-workflow verify --project <path> --ide claude-code`.
