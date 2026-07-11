# Adapter 边界

`ai-video-workflow` 的核心不是某一个平台，而是一套可验证的 AI 视频创作工作流。

## 母版源

默认母版源是 `packs/official-ai-video/`。

它负责定义：

- Step 1 到 Step 6 的流程
- 模板
- skills
- 质量门槛
- 默认增强流程
- 文件合同

任何平台适配都不能重新定义这些规则。

## Adapter 是什么

Adapter 只负责把同一套工作流落到某个平台能读取或执行的位置。

例如：

- Codex、Cursor、Claude Code、Trae：把规则和 skills 放到各自原生运行目录。
- Obsidian：把项目文件组织成适合浏览、创作和审阅的 vault 视图。
- LibTV：把 Step 4、Step 5、Step 6 的执行信息投影到画布、节点、分组或批量执行流程。
- MCP：把项目暴露成 resources、prompts 和 tools，供智能体读取和调用；只读起步边界见 [MCP adapter](./mcp-adapter.md)。

## Adapter 不能做什么

- 不能创建第二套 Step 1 到 Step 6。
- 不能把平台专属字段写成母包通用规则。
- 不能绕过 Step 3 和 Step 4 的帧级对齐。
- 不能破坏 Step 4 的固定文件合同。
- 不能使用绝对路径、盘符路径、`file://` 或 IDE 专属 URI 作为文档链接。
- 不能把执行状态伪装成上游创作事实。

## 后续接入顺序

v0.2 优先完成主干可演示闭环。

后续建议顺序：

1. Obsidian vault 投影。
2. LibTV 执行投影。
3. MCP server。
4. 更多 AI IDE 和 agent 平台适配。

每个 adapter 在进入主线前，都必须说明输入、输出、同步方向、失败回滚方式和验证命令。

新增或扩展平台专属适配前，必须先使用 [智能体 Adapter Contract](./agent-adapter-contract.md) 作为检查清单。
