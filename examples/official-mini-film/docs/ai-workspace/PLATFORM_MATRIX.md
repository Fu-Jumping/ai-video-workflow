# Platform Matrix

Marker: ai-video-workflow shared agent workspace.

| Platform | Shared entry | Runtime surface | Boundary |
| --- | --- | --- | --- |
| Codex | `AGENTS.md` | `.codex/` | Runtime mirror only |
| Cursor | `AGENTS.md` | `.cursor/` | Runtime mirror only |
| Claude Code | `AGENTS.md`, `CLAUDE.md` | `.claude/` | `CLAUDE.md` is Claude-specific and does not replace `AGENTS.md` |
| Trae | `AGENTS.md` | `.trae/` | Trae rules live under `.trae/rules/` |
| Cherry Studio | `AGENTS.md` | Working directory context plus possible root `SOUL.md`, `USER.md`, `memory/` | Host/user memory and persona surfaces; sync does not generate or overwrite them |
| Obsidian | Generated vault pages | `Workflow/`, `Shots/`, `Canvas/`, `Bases/` | Projection only |
| MCP | Resources and prompts | MCP server context | Read-only context |

`project-step-files` are the source of truth across every platform. Runtime mirror files and platform memory are not project truth. Platform memory is not project truth.
