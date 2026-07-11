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
pnpm example:obsidian
```

该命令会把官方示例导出为 Obsidian vault 投影，并校验 dashboard、Bases、Canvas 和来源路径。生成的 vault 包含项目首页、审阅队列、镜头进度、执行就绪视图、Agent Handoff 页面、Workflow Map、Shot Pipeline、Review Map、沉浸式 `Shots/<shotId>.md` 单镜头审阅页，以及逐镜头 `Canvas/Shot Reviews/<shotId>.canvas`。设计边界见 `docs/zh/contributors/obsidian-vault-projection.md`。

`export-obsidian` 默认使用安全增量导出：再次导出到同一个 vault 时，只更新投影层生成文件，保留用户在 Obsidian 中新增的笔记。`--force` 会清空并重建输出目录，`--dry-run` 会只打印将创建、更新、跳过或保留的文件，不写入磁盘。导出的 `Projection Manifest.json` 用于追踪生成文件；`Shots/` 仍属于投影生成区，`Notes/` 目录用于用户自己的 Obsidian 笔记。

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

1. 运行 `pnpm install` 安装依赖。
2. 运行 `pnpm build` 构建 CLI 与文档站。
3. 运行 `pnpm --filter ai-video-workflow test` 执行 CLI 测试。
4. 使用 `ai-video-workflow init` 生成新项目骨架。

## 仓库结构

- `apps/cli`：CLI 实现
- `packs/official-ai-video`：官方 workflow pack
- `docs`：双语文档站
- `scaffolds`：workflow pack 脚手架
- `examples`：可公开的最小示例
