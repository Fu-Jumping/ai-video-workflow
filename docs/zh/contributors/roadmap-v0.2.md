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
3. v0.4.1 先加固 Codex adapter，作为第一个具体平台实现。
4. 继续推进 Cursor、Claude Code 和 Trae adapter。
5. 规划 MCP server。
6. 等 LibTV 平台和 CLI 足够稳定后，再回到 LibTV 执行投影。
