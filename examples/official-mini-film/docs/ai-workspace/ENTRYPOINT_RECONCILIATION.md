# Entrypoint Reconciliation

Marker: ai-video-workflow shared agent workspace.

This project may be opened by Cherry Studio before or after Codex, Cursor, Claude Code, or Trae.

Stable source layers:

- `AGENTS.md` is the cross-agent root entry.
- `docs/ai-workspace/` is the shared AI documentation layer.
- `project-step-files` are the Step 1 to Step 6 creative source of truth.

Cherry Studio host surfaces:

- `SOUL.md` may describe Cherry Studio persona or project-specific agent identity.
- `USER.md` may describe user preferences or profile.
- `memory/` may contain host or user memory.

If `AGENTS.md` already exists without ai-video-workflow markers, keep the user's file and merge this block into it:

```md
## ai-video-workflow

Marker: ai-video-workflow shared agent entry.

- Read `docs/ai-workspace/README.md` and `docs/ai-workspace/BOUNDARIES.md` before changing workflow files.
- Treat `project-step-files` as the source of truth for Step 1 to Step 6.
- Keep `.codex/`, `.cursor/`, `.claude/`, `.trae/`, Obsidian projections, MCP resources, and platform memory outside project truth.
- Keep Cherry Studio `SOUL.md`, `USER.md`, and `memory/` compatible, but do not treat them as project truth unless this project explicitly says so.
- Use relative links only.
```

Do not copy secrets, private memory exports, provider tokens, platform caches, or absolute local paths into shared project truth.

Platform memory is not project truth.
