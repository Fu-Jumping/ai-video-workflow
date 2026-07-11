# AGENTS

Marker: ai-video-workflow shared agent entry.

Use the `official-ai-video` pack as the default workflow pack.

Read order:

1. `project.config.yaml`
2. `docs/ai-workspace/README.md`
3. `docs/ai-workspace/BOUNDARIES.md`
4. `docs/ai-workspace/HANDOFFS.md`
5. Source Step files in `01_concept/` through `06_execution_plan/`

Source of truth:

- `project-step-files` means Step 1 to Step 6 Markdown files are the creative source of truth.
- `.codex/`, `.cursor/`, `.claude/`, and `.trae/` are runtime mirror surfaces.
- Obsidian vault files, MCP resources, platform cache, and platform memory are not project truth.
- Cherry Studio may create `SOUL.md`, `USER.md`, and `memory/`; keep them compatible but do not treat them as project truth by default.

Global rules:

- Keep Step 3 and Step 4 frame-aligned.
- Keep Step 4 file contracts intact.
- Default to enhanced flow unless a project explicitly disables it.
- Use relative links only.
- Do not overwrite Cherry Studio `SOUL.md`, `USER.md`, or `memory/` host surfaces.
- Platform memory is not project truth.
