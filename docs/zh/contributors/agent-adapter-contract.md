# 智能体 Adapter Contract

智能体 adapter contract 定义每个 IDE、智能体运行时、vault 投影或未来自动化层应该如何使用 `ai-video-workflow`，同时避免创建第二套工作流来源。

## 为什么需要这个合同

`ai-video-workflow` 的中心是一套可验证工作流：`official-ai-video` pack 和项目 Step 1 到 Step 6 Markdown 文件。智能体平台可以让这套工作流更容易阅读、同步或执行，但不能各自重新解释工作流。

这个合同给每个 adapter 同一张检查表：

- 读取什么
- 写入什么
- 数据向哪个方向流动
- 智能体交接提示词在哪里
- 用户如何验证
- 哪些内容绝对不能写
- 遇到已有文件、冲突或用户本地状态时如何处理

## 必填字段

每个 adapter 描述都应该定义这些字段：

- `adapterId`：稳定的小写 id，例如 `codex`、`cursor`、`claude-code`、`trae`、`obsidian` 或 `mcp`。
- `displayName`：面向读者的名称。
- `inputs`：adapter 会读取的项目、pack 和源文件。
- `outputs`：adapter 会生成的文件、运行镜像或只读上下文表面。
- `syncDirection`：必须是 `runtime-mirror`、`one-way-project-to-adapter` 或 `read-only-context` 之一。
- `sourceOfTruth`：必须是 `project-step-files`。
- `handoffSurfaces`：告诉智能体检查或修改什么的页面、提示词、规则、resources 或生成笔记。
- `verificationCommands`：证明 adapter 健康的命令。
- `forbiddenWrites`：adapter 不得编辑的路径或文件类别。
- `failureBehavior`：adapter 遇到冲突、缺失文件、过期生成文件和用户本地状态时的处理方式。

## 同步方向分类

`runtime-mirror`

adapter 把 pack 或运行说明复制到平台专属位置。Codex、Cursor、Claude Code 和 Trae 通常属于这一类。

`one-way-project-to-adapter`

adapter 把项目文件投影成更丰富的阅读或执行表面。Obsidian vault 投影属于这一类。

`read-only-context`

adapter 默认只把项目文件暴露为上下文，不写项目文件或运行文件。MCP resources 和 prompts 应该从这一类开始。

## 事实源规则

- Step 1 到 Step 6 项目 Markdown 文件仍然是创作事实源。
- `packs/official-ai-video/` 仍然是工作流 pack 源。
- 生成的 adapter 输出在需要修改时必须指回源 Step 文件。
- 执行状态可以提供状态参考，但不能变成上游创作事实。
- 平台专属设置不能重新定义 Step 文件合同。

## 智能体交接规则

智能体交接表面必须告诉智能体：

- 要检查哪些源 Step 文件
- 可以修改哪些源 Step 文件
- 哪些生成文件不能修改
- 修改后要运行哪些验证命令

对视频工作流修改：

- 故事和叙事帧修改回到 Step 3
- 视觉提示词和一致性修改回到 Step 4
- 运动和镜头行为修改回到 Step 5

## 验证规则

每个 adapter 至少要有一条验证路径。好的 adapter 验证应检查：

- 必需的生成文件或镜像文件存在
- 使用相对链接
- source path 能解析
- 平台专属输出没有重新定义核心工作流
- 在适用时保护用户本地配置

## 禁止行为

adapter 不能：

- 创建另一套 Step 1 到 Step 6 工作流
- 削弱 Step 3 到 Step 4 的帧级对齐
- 削弱 Step 4 文件合同
- 把本地绝对链接写进文档或生成投影
- 默认覆盖用户本地平台状态
- 把 Obsidian 笔记、IDE runtime 文件、MCP resources 或 LibTV 执行状态当作创作源文件

## Adapter 示例

### Codex

- 读取：官方 pack 文档和 skills。
- 写入：`.codex/ai-video-workflow/` 运行镜像和 `.codex/skills/` 技能入口。
- 方向：`runtime-mirror`。
- 验证：`ai-video-workflow verify --project <path> --ide codex`。

### Cursor

- 读取：官方 pack rules 和 workflow docs。
- 写入：Cursor 可读的运行说明。
- 方向：`runtime-mirror`。
- 验证：adapter 专属同步加项目验证。

### Claude Code

- 读取：官方 pack rules 和 workflow docs。
- 写入：Claude Code 可读的说明。
- 方向：`runtime-mirror`。
- 验证：adapter 专属同步加项目验证。

### Trae

- 读取：官方 pack rules 和 workflow docs。
- 写入：Trae 可读的说明。
- 方向：`runtime-mirror`。
- 验证：adapter 专属同步加项目验证。

### Obsidian

- 读取：项目 Step 文件。
- 写入：生成的 vault 投影文件、manifest、Bases、Canvas、dashboard 和可选 UI 建议。
- 方向：`one-way-project-to-adapter`。
- 验证：`verify-obsidian`。

### MCP

- 读取：项目 Step 文件和 pack metadata。
- 写入：默认不写项目文件；暴露 resources、prompts 和 tools。
- 方向：先从 `read-only-context` 开始。
- 验证：server contract 测试和项目验证。

参见 [MCP adapter](./mcp-adapter.md)。
