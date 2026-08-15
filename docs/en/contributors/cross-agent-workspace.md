# Cross-Agent Workspace

`ai-video-workflow` projects can be opened by multiple agent platforms in the same working directory. The shared workspace model keeps those platforms aligned without making their runtime folders a second source of truth.

## Shared Entry

Every synced project should have:

- `AGENTS.md`
- `文档/智能体工作区/入口说明.md`
- `文档/智能体工作区/边界说明.md`
- `文档/智能体工作区/智能体交接.md`
- `文档/智能体工作区/安全边界.md`
- `文档/智能体工作区/平台矩阵.md`
- `文档/智能体工作区/入口协调.md`

`AGENTS.md` is the cross-agent root entry. `文档/智能体工作区/` is the shared AI documentation layer inside the project.

## Source of Truth

The source of truth is always `project-step-files`: enabled Step Markdown files in the project. Research mode includes Step 0 through Step 6; script mode includes Step 1 through Step 6.

Runtime mirrors are adapter surfaces only:

- `.codex/`
- `.cursor/`
- `.claude/`
- `.trae/`
- `_views/obsidian/` generated Obsidian view layer
- `_views/obsidian/04_个人笔记/` user-authored Obsidian notes, preserved by incremental export but not project truth
- MCP resources and prompts

Platform memory is not project truth.

## Cherry Studio Host Files

If the project root is used as a Cherry Studio Agent working directory, Cherry Studio may automatically create:

- `SOUL.md`
- `USER.md`
- `memory/`

These files can coexist with `AGENTS.md` and `文档/智能体工作区/`, but they are host/user memory surfaces by default. Other agents that enter the same directory should read `AGENTS.md` and `文档/智能体工作区/` first, and must not treat `SOUL.md`, `USER.md`, or `memory/` as project truth or rewrite them automatically.

Some projects may intentionally version `SOUL.md`, `USER.md`, and `memory/` as a shared collaboration protocol. If so, the project should state that explicitly in its own `AGENTS.md`. The default `ai-video-workflow` CLI does not make that decision for the user.

## Initialization Order

| Order | Result | Boundary to handle |
| --- | --- | --- |
| Cherry Studio creates `SOUL.md`, `USER.md`, and `memory/` first, then `sync` runs | `sync` creates `AGENTS.md` and `文档/智能体工作区/` while preserving Cherry host files | If Cherry or the user already wrote a custom `AGENTS.md`, merge the ai-video-workflow block |
| Codex/Cursor/Claude Code/Trae runs `sync` first, then Cherry Studio creates host files | Shared entries remain stable and Cherry host files coexist | Other agents must not rewrite `SOUL.md`, `USER.md`, or `memory/` automatically |
| A custom `AGENTS.md` already exists before ai-video-workflow is added | `sync` preserves it and `verify` reports a merge task | Use `文档/智能体工作区/入口协调.md` or `doctor` output to merge |

## Platform Boundaries

Codex, Cursor, Claude Code, and Trae can receive generated runtime mirrors. Cherry Studio is documented as a working-directory adapter in v0.6 and is not a `sync --ide` target.

Cherry Studio persona files, global memory, `@cherry/memory`, and `MEMORY_FILE_PATH` are user-owned or host-owned surfaces. The root `.obsidian/` folder is also local UI/config state if a user accidentally opens the project root as a vault. `ai-video-workflow` does not generate or overwrite those host surfaces by default. Project verification skips root `_views/`, root `.obsidian/`, root `SOUL.md`, `USER.md`, case variants, and `memory/` so local host memory and generated view files do not pollute project-level checks.

`sync` writes a project `.gitignore` block for generated and local surfaces: `_views/`, `.obsidian/`, `.codex/`, `.cursor/`, `.claude/`, `.trae/`, `SOUL.md`, `USER.md`, case variants, and `memory/`. Codex, Cursor, Claude Code, Trae, Cherry Studio, MCP, and Obsidian should all read `AGENTS.md` and `文档/智能体工作区/`, but only Step files are project truth.

## Verification

Run:

```bash
ai-video-workflow verify --project <path> --ide <id>
```

The verifier checks that shared entries exist, contain the expected markers, and that platform runtime entries point back to `AGENTS.md`, `文档/智能体工作区/`, and `project-step-files`.
