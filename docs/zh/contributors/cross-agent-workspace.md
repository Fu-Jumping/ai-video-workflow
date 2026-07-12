# 跨智能体工作目录

`ai-video-workflow` 项目可以在同一个工作目录里被多个智能体平台打开。共享工作目录模型的目标是让这些平台读取同一套规则，同时避免平台 runtime、缓存或记忆变成第二套事实源。

## 共享入口

每个同步后的项目都应包含：

- `AGENTS.md`
- `docs/ai-workspace/README.md`
- `docs/ai-workspace/BOUNDARIES.md`
- `docs/ai-workspace/HANDOFFS.md`
- `docs/ai-workspace/SECURITY.md`
- `docs/ai-workspace/PLATFORM_MATRIX.md`
- `docs/ai-workspace/ENTRYPOINT_RECONCILIATION.md`

`AGENTS.md` 是跨智能体根入口。`docs/ai-workspace/` 是项目内共享 AI 文档层。

## 事实源

事实源始终是 `project-step-files`：项目中的 Step 1 到 Step 6 Markdown 文件。

以下内容只属于 adapter 表面：

- `.codex/`
- `.cursor/`
- `.claude/`
- `.trae/`
- `_views/obsidian/` 生成 Obsidian 观看层
- `_views/obsidian/Notes/` 用户手写 Obsidian 笔记，增量导出会保留，但不是项目事实源
- MCP resources 和 prompts

平台记忆不是项目事实源。

## Cherry Studio 宿主文件

如果把项目根目录设置为 Cherry Studio Agent 的工作目录，Cherry Studio 可能会自动创建：

- `SOUL.md`
- `USER.md`
- `memory/`

这些文件可以与 `AGENTS.md` 和 `docs/ai-workspace/` 共存，但默认属于 Cherry Studio 宿主/用户记忆层。其他智能体进入同一目录时，应先读 `AGENTS.md` 和 `docs/ai-workspace/`，不要把 `SOUL.md`、`USER.md` 或 `memory/` 当成项目事实源，也不要自动改写它们。

如果某个项目像独立协作仓库一样，明确把 `SOUL.md`、`USER.md`、`memory/` 版本化为共享协议，可以在项目自己的 `AGENTS.md` 里说明。`ai-video-workflow` 的默认 CLI 不替用户做这个决定。

## 初始化顺序

| 顺序 | 结果 | 需要处理的边界 |
| --- | --- | --- |
| Cherry Studio 先创建 `SOUL.md`、`USER.md`、`memory/`，随后运行 `sync` | `sync` 创建 `AGENTS.md` 和 `docs/ai-workspace/`，并保留 Cherry 宿主文件 | 如果 Cherry 或用户已经写了自定义 `AGENTS.md`，需要合并 ai-video-workflow block |
| Codex/Cursor/Claude Code/Trae 先运行 `sync`，随后 Cherry Studio 创建宿主文件 | 共享入口保持不变，Cherry 宿主文件共存 | 其他智能体不要自动改写 `SOUL.md`、`USER.md`、`memory/` |
| 已有自定义 `AGENTS.md`，再接入 ai-video-workflow | `sync` 不覆盖已有入口，`verify` 报合并提示 | 按 `docs/ai-workspace/ENTRYPOINT_RECONCILIATION.md` 或 `doctor` 输出合并 |

## 平台边界

Codex、Cursor、Claude Code 和 Trae 可以接收生成的 runtime mirror。Cherry Studio 在 v0.6 中只作为工作目录型 adapter 写入文档与 contract，不作为 `sync --ide` 目标。

Cherry Studio persona 文件、全局记忆、`@cherry/memory` 和 `MEMORY_FILE_PATH` 都属于用户或宿主平台表面。如果用户误把项目根目录作为 Obsidian vault 打开，根 `.obsidian/` 也属于本地 UI/config 状态。`ai-video-workflow` 默认不生成也不覆盖这些宿主表面。项目校验会跳过根 `_views/`、根 `.obsidian/`、根 `SOUL.md`、`USER.md`、大小写变体和 `memory/`，避免平台记忆和生成观看层污染项目级校验。

`sync` 会写入项目 `.gitignore` 保护块，覆盖 `_views/`、`.obsidian/`、`.codex/`、`.cursor/`、`.claude/`、`.trae/`、`SOUL.md`、`USER.md`、大小写变体和 `memory/`。Codex、Cursor、Claude Code、Trae、Cherry Studio、MCP 和 Obsidian 都应读取 `AGENTS.md` 与 `docs/ai-workspace/`，但只有 Step 文件是项目事实源。

## 验证

运行：

```bash
ai-video-workflow verify --project <path> --ide <id>
```

验证器会检查共享入口是否存在、marker 是否完整，以及平台 runtime 入口是否回指 `AGENTS.md`、`docs/ai-workspace/` 和 `project-step-files`。
