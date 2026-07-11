# v0.2 路线图：主干可演示闭环

## 目标

v0.2 的目标是让新人能拉下仓库、初始化项目、查看官方示例、运行校验，并理解后续平台适配的位置。

## 必须完成

- `init` 支持非交互参数。
- 官方示例项目能展示 Step 1 到 Step 6 的最小闭环。
- `verify` 能检查关键文件合同和链接风险。
- `doctor` 能给出可执行的修复建议。
- 文档说明 adapter 边界。
- 快速开始覆盖构建、初始化、校验、诊断和同步。

## 暂不完成

- 不开发 Obsidian 插件。
- 不执行 LibTV 画布自动化。
- 不实现 MCP server。
- 不直接调用生图或生视频平台。
- 不做工作流市场。

## v0.2 之后已完成

v0.3 已经完成 Obsidian vault 投影这个单向 adapter：

- 安全增量导出
- 生成 dashboard、Bases 和 Canvas map
- 单镜头沉浸式审阅页
- 用于源文件修改上下文的 Agent Handoff 页面
- 可选 UI 建议
- 通过 `pnpm example:obsidian:ui` 进行真实 vault QA

Obsidian 投影的边界见 [Obsidian Vault 投影](./obsidian-vault-projection.md)。

## 下一阶段方向

v0.3 之后，优先级不是继续增加 Obsidian 表层功能，而是定义平台无关的智能体 adapter contract。

建议顺序：

1. v0.3 发布整理和 release notes。
2. v0.4 智能体 adapter contract，覆盖 Codex、Cursor、Claude Code、Trae、MCP 和未来 adapter。
3. v0.4.1 到 v0.4.5 完成 Codex、Cursor、Claude Code 和 Trae adapter 加固，并加入 runtime 验证。
4. v0.5：MCP 只读上下文 adapter。先提供 resources、prompts 和只读诊断；写入工具和 LibTV 执行继续暂缓。
5. v0.6：跨智能体工作目录一致性。使用 `AGENTS.md` 和 `docs/ai-workspace/` 作为 Codex、Cursor、Claude Code、Trae、Cherry Studio、Obsidian 和 MCP 表面的共享项目入口。
5. 等 LibTV 平台和 CLI 足够稳定后，再回到 LibTV 执行投影。

## v0.4 之后已完成

v0.4 定义了平台无关的 adapter contract，并给第一批 IDE adapter 加入具体 runtime mirror 检查：

- Codex runtime mirror contract 和验证。
- Cursor runtime mirror contract 和验证。
- Claude Code runtime mirror contract 和验证。
- Trae runtime mirror contract 和验证。
- `doctor` 能根据缺失 runtime 文件提示对应的 `sync --ide <id>` 命令。

## v0.5 方向

v0.5 应把 MCP 作为只读上下文 adapter 引入：

- 通过 MCP resources 暴露项目和镜头上下文
- 提供项目审阅和镜头修改的智能体交接 prompts
- 只加入项目摘要、镜头查询和验证诊断等只读 tools
- 保持 Step 文件作为事实源
- 避免写入工具、Obsidian 修改、IDE runtime sync、生成平台调用和 LibTV 执行

## v0.6 跨智能体工作目录

v0.6 应让多平台反复访问同一工作目录更安全：

- IDE sync 创建 `AGENTS.md` 和 `docs/ai-workspace/`
- 平台 runtime mirror 回指共享入口
- 把 Cherry Studio 记录为工作目录型 adapter，不写宿主记忆或 persona 文件
- 校验共享文档缺失和 runtime 入口重定义事实源的问题
