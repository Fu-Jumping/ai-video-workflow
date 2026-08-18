# ai-video-workflow

`ai-video-workflow` is an open-source product repo for AI video creation workflows.

Simplified Chinese: [README.zh-CN.md](README.zh-CN.md)

It combines:

- an official workflow pack
- a TypeScript CLI
- a bilingual VitePress documentation site
- IDE integrations
- checks and validation rules

## Current Status

This repository is the first-stage refactor from the former internal mother package. The current default pack is `official-ai-video`.

## Beginner Start

If you want to start a creative project, do not write scripts inside this tool repository. Download or clone this repository, then let an agent run the CLI to create a separate creative project directory.

Start here: [Beginner start with an agent](docs/en/quickstart/beginner-agent-init.md).

## v0.2 Mainline

The current recommended focus is the mainline demo loop: non-interactive init, the official example project, verification and doctor guidance, adapter boundaries, and quickstart docs.

Future Obsidian, LibTV, MCP, and agent-platform work should attach as adapters, not as second workflow sources.

## Seedance Video Prompt Contract

- New projects default to Seedance 2.0 all-purpose reference mode.
- Steps 3-5 use recursive `镜头组-001/` directories. One shot is one video-generation task with a 15-second default and up to four internal storyboard segments.
- Step 4 keyframes are not limited to first or last frames and use names such as `镜头-001-关键帧-01.md`.
- Formal Step 5 prompts use the five-section contract and explicitly state `无配乐、无字幕`.

## Cross-Agent Workspace

`sync --ide codex|cursor|claude-code|trae` initializes a shared agent workspace in each project:

- `AGENTS.md` is the cross-agent root entry.
- `文档/智能体工作区/` records shared boundaries, handoffs, platform matrix, and security rules.
- Platform runtime mirrors remain adapter surfaces, not project truth.
- Cherry Studio is documented as a working-directory adapter; it does not receive generated memory or persona files.
- If a project already has a custom `AGENTS.md`, `sync` preserves it; merge the ai-video-workflow block from `文档/智能体工作区/入口协调.md` or `doctor` output.

See `docs/en/contributors/cross-agent-workspace.md` and `docs/en/ide-integrations/cherry-studio.md`.

## v0.2 Verification

```powershell
pnpm verify:v0.2
```

This command builds the CLI and docs site, runs tests (the test suite bootstraps the official example's IDE runtime mirror, so a clean clone can run it directly), and verifies the official example project.

Supported image/video platforms: `openai`, `veo`, `runway`, `luma`, `minimax`, `seedance`, `midjourney` (`midjourney` is config registration only; image generation still happens on the platform itself).

## Obsidian Vault Projection

```powershell
pnpm build
pnpm example:obsidian:in-project
```

The recommended production layout keeps the AI agent working directory at the project root and opens only the generated Obsidian view layer as the vault:

```text
project/_views/obsidian/
```

Do not open the project root itself as the Obsidian vault for this workflow. `project/_views/obsidian/` contains generated viewing surfaces: `流程/`, `镜头/`, `数据表/`, `画布/`, `00_项目首页.md`, and `投影清单.json`. `笔记/` is user-authored and preserved by incremental export, but it is not the Step source of truth. In research mode, files under `00_前期研究/` through `06_执行计划/` are the creative source. In script mode for projects that already have a complete script, the source still starts at `01_概念策划/`.

This command exports the official example into the in-project Obsidian view layer and verifies the Chinese dashboards, Bases, Canvas files, projection manifest hashes, and source paths. External vault mode remains supported with `export-obsidian --project <path> --out <vault-path>` and `verify-obsidian --project <path> --vault <vault-path>`.

`export-obsidian` uses safe incremental export by default: repeated exports to the same vault update generated projection files while preserving user-authored Obsidian notes. Use `--force` for a clean rebuild, or `--dry-run` to print create/update/skip/keep operations without writing files. `--force` deletes the output vault before rebuilding and is blocked if that vault contains `.git`.

Use `04_智能体交接.md` and the agent handoff section in each shot page to copy source-file context into an agent conversation. The agent should edit source Step files, not generated Obsidian projection files.

By default the exporter does not write `.obsidian/`. Use `--include-obsidian-ui` only when you want optional suggested Bookmarks and Workspace for the open-vault path: `00_项目首页.md`, `04_智能体交接.md`, `02_镜头索引.md`, `画布/审阅地图.canvas`, and `画布/镜头流水线.canvas`. Existing user `.obsidian` files are not overwritten; suggested copies are written under `.obsidian/ai-video-workflow-suggested/`.

For release QA of the optional opening experience, run `pnpm example:obsidian:ui` after `pnpm build`. This exports the official sample with `--include-obsidian-ui` and verifies the generated vault without launching Obsidian automatically.

See `docs/en/contributors/release-notes-v0.3.md` for the v0.3 Obsidian release notes.

## MCP Read-Only Context

```powershell
pnpm build
pnpm example:mcp-context
```

`mcp-context` prints deterministic JSON for the official example: workflow steps, shot source paths, edit boundaries, and verification commands. It is read-only and does not write project files.

For a local MCP client, use the CLI command `ai-video-workflow mcp-server --project <project-path>` after building the CLI. The server is scoped to one project, runs over stdio, and exposes read-only resources, prompts, and tools. Do not use `mcp-server` in scripts that must exit; use `mcp-context` for smoke tests.

See `docs/en/contributors/mcp-adapter.md` for the MCP adapter boundary.

## Step 0 Research

New real-world or prototype-based projects start with `00_前期研究/` by default. Step 0 organizes reports, interviews, historical records, video observations, comment samples, and visual evidence into traceable `SRC-xxxx` sources for Step 1.

If you already have a complete script, initialize with:

```powershell
ai-video-workflow init --name <project-name> --start-from script
```

Research archive commands:

```powershell
ai-video-workflow research ingest --project <path> --source <url-or-file> --platform auto --with-comments
ai-video-workflow research inbox --project <path>
```

The project tracks `metadata.json`, `source-card.md`, and anonymized `comment-sample.md` by default. Raw captures, media, full comment dumps, browser profiles, and cookies are ignored by `.gitignore`.

## Quick Start

1. For a beginner-friendly path, use [Beginner start with an agent](docs/en/quickstart/beginner-agent-init.md).
2. For manual setup, install dependencies with `pnpm install`.
3. Build the CLI and docs with `pnpm build`.
4. Run `node apps/cli/dist/index.js init` or the scripted CLI form from [Quickstart](docs/en/quickstart/index.md).
5. To make the `ai-video-workflow` command form (used across docs and `init` output) globally available, run `npm install -g apps/cli` after building; then `ai-video-workflow <command>` is equivalent to `node apps/cli/dist/index.js <command>`.

## Product Shape

- `apps/cli` contains the CLI implementation.
- `packs/official-ai-video` contains the flagship workflow pack.
- `docs` contains the bilingual docs site.
- `scaffolds` contains workflow pack starter structures.
- `examples` contains public, non-proprietary examples.
