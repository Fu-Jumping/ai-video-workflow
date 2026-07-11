# Trae

Trae uses `.trae/skills/` as native skill bundles, `.trae/rules/` as runtime rule entries, `.trae/specs/ai-video-workflow/` as generated workflow specs, and `.trae/documents/ai-video-workflow/` as the readable runtime mirror. It does not default to `.agents/skills`.

## Generated outputs

`sync --ide trae` writes:

- `AGENTS.md`
- `.trae/skills/`
- `.trae/rules/ai-video-workflow.md`
- `.trae/specs/ai-video-workflow/`
- `.trae/documents/ai-video-workflow/WORKFLOW_OVERVIEW.md`
- `.trae/documents/ai-video-workflow/skills/`
- `.trae/documents/ai-video-workflow/skill-bundles/`
- `.trae/documents/ai-video-workflow/templates/`
- `.trae/documents/ai-video-workflow/indexes/`

It does not write `CLAUDE.md`; use the Claude Code adapter when Claude Code needs a root entrypoint.

Trae should read `AGENTS.md`, then `.trae/rules/ai-video-workflow.md`, then the documents mirror and skill bundles. When changing the project, edit the source Step files, not the generated Trae mirror or Obsidian projection files.

## Adapter Contract

- Reads: `packs/official-ai-video/`, `project.config.yaml`, and project Step 1 to Step 6 files.
- Writes: `AGENTS.md`, `.trae/skills/`, `.trae/rules/`, `.trae/specs/ai-video-workflow/`, and `.trae/documents/ai-video-workflow/`.
- Must not write: source Step files, generated Obsidian projection files, user `.obsidian/` config, `CLAUDE.md`, or absolute links.
- Sync direction: `runtime-mirror`.
- Source of truth: `project-step-files`.
- Verify with `ai-video-workflow verify --project <path> --ide trae`.
