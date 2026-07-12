# ai-video-workflow

`ai-video-workflow` 是一个面向 AI 视频创作工作流的开源产品仓库。

它同时包含：

- 官方 workflow pack
- TypeScript CLI
- 双语 VitePress 文档站
- IDE 集成层
- checks 与校验规则

## 当前状态

这个仓库是从旧的内部母包重构出来的第一阶段产品仓库，当前默认官方 pack 是 `official-ai-video`。

## 新手启动

如果你只是想开始一个 AI 视频创作项目，不要直接在这个工具仓库里写剧本。推荐做法是：先下载或克隆本仓库，再让智能体代跑 CLI 创建一个单独的创作项目目录。

正式入口见 [新手：让智能体代跑 CLI](docs/zh/quickstart/beginner-agent-init.md)。关于“工具仓库和创作项目的区别”“目标目录已有文件时会发生什么”“重复初始化和 `sync` 的区别”的审计背景，见 [新手启动与初始化体验记录](docs/zh/contributors/onboarding-initialization-notes.md)。

## v0.2 主线

当前建议优先关注主干可演示闭环：非交互初始化、官方示例项目、校验诊断、adapter 边界和快速开始文档。

后续 Obsidian、LibTV、MCP 和更多智能体平台都应作为 adapter 接入，不作为第二套工作流来源。

## 跨智能体工作目录

`sync --ide codex|cursor|claude-code|trae` 会为每个项目初始化共享智能体工作目录：

- `AGENTS.md` 是跨智能体根入口。
- `docs/ai-workspace/` 记录共享边界、交接、平台矩阵和安全规则。
- 平台 runtime mirror 仍然只是 adapter 表面，不是项目事实源。
- Cherry Studio 作为工作目录型 adapter 进入文档，不生成记忆或 persona 文件。
- 如果项目已有自定义 `AGENTS.md`，`sync` 不会覆盖它；按 `docs/ai-workspace/ENTRYPOINT_RECONCILIATION.md` 或 `doctor` 输出合并 ai-video-workflow block。

说明见 `docs/zh/contributors/cross-agent-workspace.md` 和 `docs/zh/ide-integrations/cherry-studio.md`。

## v0.2 验证

```powershell
pnpm verify:v0.2
```

该命令会构建 CLI 与文档站、运行测试，并验证官方示例项目。

## Obsidian vault 投影

```powershell
pnpm build
pnpm example:obsidian:in-project
```

推荐的生产布局是：AI 智能体仍以项目根目录为工作目录，Obsidian 只打开生成的观看层：

```text
project/_views/obsidian/
```

不要把项目根目录本身作为 Obsidian vault 打开。`project/_views/obsidian/` 内的 `Workflow/`、`Shots/`、`Bases/`、`Canvas/`、dashboard 和 `Projection Manifest.json` 都是生成观看表面。`Notes/` 是用户手写笔记区，增量导出会保留它，但它不是 Step 事实源。Step 1 到 Step 6 文件仍是唯一创作事实源。

该命令会把官方示例导出到项目内 Obsidian 观看层，并校验 dashboard、Bases、Canvas、manifest hash 和来源路径。外部 vault 旧模式仍可用：`export-obsidian --project <path> --out <vault-path>` 与 `verify-obsidian --project <path> --vault <vault-path>`。

`export-obsidian` 默认使用安全增量导出：再次导出到同一个 vault 时，只更新投影层生成文件，保留用户在 Obsidian 中新增的笔记。`--force` 会在重建前删除输出 vault；如果该 vault 包含 `.git`，命令会拒绝删除。`--dry-run` 会只打印将创建、更新、跳过或保留的文件，不写入磁盘。

使用 `04_Agent_Handoff.md` 和每个镜头页里的 `Agent Handoff` 区块，可以把源文件上下文复制到智能体对话中。智能体应修改源 Step 文件，而不是修改生成的 Obsidian 投影文件。

默认导出不会写入 `.obsidian/`。只有显式使用 `--include-obsidian-ui` 时，才会生成可选的 Bookmarks 和 Workspace 建议，用于预置 Project Home、Agent Handoff、Shot Index、Review Map 和 Shot Pipeline 打开路径。已有用户 `.obsidian` 文件不会被覆盖；建议副本会写入 `.obsidian/ai-video-workflow-suggested/`。

如果要对可选打开体验做发版 QA，可以在 `pnpm build` 后运行 `pnpm example:obsidian:ui`。它会用 `--include-obsidian-ui` 导出官方示例并验证生成的 vault，但不会自动启动 Obsidian。

v0.3 Obsidian 发布说明见 `docs/zh/contributors/release-notes-v0.3.md`。

## MCP 只读上下文

```powershell
pnpm build
pnpm example:mcp-context
```

`mcp-context` 会为官方示例打印确定性的 JSON，包含 workflow steps、镜头源文件路径、修改边界和验证命令。它是只读命令，不会写项目文件。

本地 MCP 客户端可以在构建 CLI 后使用 `ai-video-workflow mcp-server --project <project-path>`。该 server 只绑定一个项目，通过 stdio 运行，并暴露只读 resources、prompts 和 tools。不要把 `mcp-server` 放进必须退出的验证脚本；烟测使用 `mcp-context`。

MCP adapter 边界见 `docs/zh/contributors/mcp-adapter.md`。

## 快速开始

1. 新手优先看 [新手：让智能体代跑 CLI](docs/zh/quickstart/beginner-agent-init.md)。
2. 手动使用时，运行 `pnpm install` 安装依赖。
3. 运行 `pnpm build` 构建 CLI 与文档站。
4. 使用 `node apps/cli/dist/index.js init` 或 [快速开始](docs/zh/quickstart/index.md) 中的脚本化命令生成项目。

## 仓库结构

- `apps/cli`：CLI 实现
- `packs/official-ai-video`：官方 workflow pack
- `docs`：双语文档站
- `scaffolds`：workflow pack 脚手架
- `examples`：可公开的最小示例
