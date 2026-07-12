# Cross-Agent Workspace

`ai-video-workflow` projects can be opened by multiple agent platforms in the same working directory. The shared workspace model keeps those platforms aligned without making their runtime folders a second source of truth.

## Shared Entry

Every synced project should have:

- `AGENTS.md`
- `docs/ai-workspace/README.md`
- `docs/ai-workspace/BOUNDARIES.md`
- `docs/ai-workspace/HANDOFFS.md`
- `docs/ai-workspace/SECURITY.md`
- `docs/ai-workspace/PLATFORM_MATRIX.md`
- `docs/ai-workspace/ENTRYPOINT_RECONCILIATION.md`

`AGENTS.md` is the cross-agent root entry. `docs/ai-workspace/` is the shared AI documentation layer inside the project.

## Source of Truth

The source of truth is always `project-step-files`: Step 1 to Step 6 Markdown files in the project.

Runtime mirrors are adapter surfaces only:

- `.codex/`
- `.cursor/`
- `.claude/`
- `.trae/`
- `_views/obsidian/` generated Obsidian view layer
- `_views/obsidian/Notes/` user-authored Obsidian notes, preserved by incremental export but not project truth
- MCP resources and prompts

Platform memory is not project truth.

## Cherry Studio Host Files

If the project root is used as a Cherry Studio Agent working directory, Cherry Studio may automatically create:

- `SOUL.md`
- `USER.md`
- `memory/`

These files can coexist with `AGENTS.md` and `docs/ai-workspace/`, but they are host/user memory surfaces by default. Other agents that enter the same directory should read `AGENTS.md` and `docs/ai-workspace/` first, and must not treat `SOUL.md`, `USER.md`, or `memory/` as project truth or rewrite them automatically.

Some projects may intentionally version `SOUL.md`, `USER.md`, and `memory/` as a shared collaboration protocol. If so, the project should state that explicitly in its own `AGENTS.md`. The default `ai-video-workflow` CLI does not make that decision for the user.

## Initialization Order

| Order | Result | Boundary to handle |
| --- | --- | --- |
| Cherry Studio creates `SOUL.md`, `USER.md`, and `memory/` first, then `sync` runs | `sync` creates `AGENTS.md` and `docs/ai-workspace/` while preserving Cherry host files | If Cherry or the user already wrote a custom `AGENTS.md`, merge the ai-video-workflow block |
| Codex/Cursor/Claude Code/Trae runs `sync` first, then Cherry Studio creates host files | Shared entries remain stable and Cherry host files coexist | Other agents must not rewrite `SOUL.md`, `USER.md`, or `memory/` automatically |
| A custom `AGENTS.md` already exists before ai-video-workflow is added | `sync` preserves it and `verify` reports a merge task | Use `docs/ai-workspace/ENTRYPOINT_RECONCILIATION.md` or `doctor` output to merge |

## Platform Boundaries

Codex, Cursor, Claude Code, and Trae can receive generated runtime mirrors. Cherry Studio is documented as a working-directory adapter in v0.6 and is not a `sync --ide` target.

Cherry Studio persona files, global memory, `@cherry/memory`, and `MEMORY_FILE_PATH` are user-owned or host-owned surfaces. The root `.obsidian/` folder is also local UI/config state if a user accidentally opens the project root as a vault. `ai-video-workflow` does not generate or overwrite those host surfaces by default. Project verification skips root `_views/`, root `.obsidian/`, root `SOUL.md`, `USER.md`, case variants, and `memory/` so local host memory and generated view files do not pollute project-level checks.

`sync` writes a project `.gitignore` block for generated and local surfaces: `_views/`, `.obsidian/`, `.codex/`, `.cursor/`, `.claude/`, `.trae/`, `SOUL.md`, `USER.md`, case variants, and `memory/`. Codex, Cursor, Claude Code, Trae, Cherry Studio, MCP, and Obsidian should all read `AGENTS.md` and `docs/ai-workspace/`, but only Step files are project truth.

## Verification

Run:

```bash
ai-video-workflow verify --project <path> --ide <id>
```

The verifier checks that shared entries exist, contain the expected markers, and that platform runtime entries point back to `AGENTS.md`, `docs/ai-workspace/`, and `project-step-files`.
