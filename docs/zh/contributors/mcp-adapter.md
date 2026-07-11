# MCP Adapter

MCP adapter 把 `ai-video-workflow` 项目作为只读上下文暴露给智能体客户端。

MCP adapter 的起点是 resources、prompts 和只读 tools。它不能变成第二套工作流来源，也不能静默编辑项目文件。

## 目的

这个 adapter 帮助智能体理解项目，而不是猜仓库结构：

- 当前使用哪个 workflow pack
- 哪些 Step 1 到 Step 6 文件定义了项目
- 项目里有哪些镜头
- 每个镜头对应哪些 Step 3、Step 4、Step 5 和 Step 6 文件
- 故事、图像提示词、运动或执行计划修改应该改哪个源文件
- 修改后应该运行哪些验证命令

Step 文件仍然是事实源。

## 先只读

MCP adapter 在 v0.5 是上下文与交接入口，不是项目编辑器，不是 Obsidian 同步层，也不是 LibTV 执行层。

初始 MCP 工作应该在 adapter contract 中使用 `syncDirection: "read-only-context"`。这意味着：

- 读取项目 Step 文件和 pack metadata
- 暴露稳定的 resources 和 prompts
- 只暴露只读诊断 tools
- 报告无效或缺失文件，而不是自动修复
- 所有编辑仍然回到普通 workspace 工具和源 Step 文件

## Resources

Resources 应该暴露稳定的、项目相对的上下文。建议资源包括：

- `ai-video-workflow://project/summary`
- `ai-video-workflow://project/config`
- `ai-video-workflow://pack/official-ai-video/overview`
- `ai-video-workflow://workflow/step/1`
- `ai-video-workflow://workflow/step/2`
- `ai-video-workflow://workflow/step/3`
- `ai-video-workflow://workflow/step/4`
- `ai-video-workflow://workflow/step/5`
- `ai-video-workflow://workflow/step/6`
- `ai-video-workflow://shots/index`
- `ai-video-workflow://shots/{shotId}`
- `ai-video-workflow://handoff/project`
- `ai-video-workflow://verification/commands`

Resource 正文应使用项目相对路径。不要暴露盘符路径、`file://` 链接、IDE URI 或机器本地绝对路径。

## Prompts

Prompts 应该是可直接复制的常见智能体任务交接模板：

- `review_project`
- `inspect_shot`
- `revise_storyboard`
- `revise_image_prompt`
- `revise_video_prompt`
- `verify_project`

Prompt 文案必须告诉智能体：

- 先读取源 Step 文件
- 需要修改时只编辑源 Step 文件
- 不要把 Obsidian 投影、IDE runtime mirror 或 MCP resources 当作源文件编辑
- 修改后运行验证

内容修改边界：

- 故事和叙事帧修改回到 Step 3
- 视觉提示词和一致性修改回到 Step 4
- 运动和镜头行为修改回到 Step 5
- 执行组织和落地信息回到 Step 6

## Tools

v0.5 tools 应该只读：

- `get_project_summary`
- `list_shots`
- `get_shot_context`
- `run_project_verify`

`run_project_verify` 可以调用现有 verifier 并返回 issues。它不能修复文件、同步 runtime mirror、导出 Obsidian vault，也不能触发生成平台。

## 禁止写入

MCP adapter 不能写入：

- `01_concept/`
- `02_setting/`
- `03_storyboard/`
- `04_image_prompts/`
- `05_video_prompts/`
- `06_execution_plan/`
- `Workflow/`、`Shots/`、`Canvas/`、`Bases/` 等生成的 Obsidian 投影目录
- `.obsidian/`
- `.codex/`
- `.cursor/`
- `.claude/`
- `.trae/`
- LibTV 执行状态
- 本地绝对链接

任何未来写入工具都需要单独实施计划、显式 opt-in、源文件边界、冲突处理和测试。

## 验证

adapter 应分层验证：

1. Contract fixture：`mcp.contract.json` 使用 `read-only-context`。
2. Context builder：项目摘要和镜头映射是确定性的。
3. Server registry：resources、prompts 和 tools 暴露预期名称。
4. 安全检查：输出使用项目相对路径，并且只包含只读 tools。
5. 项目验证：现有 workflow checks 仍然通过。

计划中的命令：

```bash
ai-video-workflow mcp-context --project <path>
ai-video-workflow mcp-server --project <path>
```

`mcp-server` 应该是长时间运行的 stdio server。不要把它放进必须退出的验证脚本。

## 本地设置

先构建 CLI：

```bash
pnpm build
```

需要能自动退出的烟测命令时，使用：

```bash
pnpm example:mcp-context
```

只有在 MCP 客户端配置或明确需要长时间运行 stdio server 的终端里，才使用 server 命令：

```bash
ai-video-workflow mcp-server --project <project-path>
```

客户端配置应指向已构建的 CLI 或 package binary，并传入：

```text
mcp-server --project <project-path>
```

server 只绑定一个项目路径。每个项目单独启动一个 server。

## 排障

如果客户端没有显示 resources、prompts 或 tools：

- 先运行 `ai-video-workflow mcp-context --project <project-path>`，确认它能成功退出
- 检查项目是否有 `project.config.yaml`
- 检查 Step 1 到 Step 6 目录是否都存在
- 运行 `ai-video-workflow verify --project <project-path> --ide codex`

如果某个镜头没有出现在 MCP resources 中：

- 确认该镜头在 `03_storyboard/` 下有 Markdown 文件
- 确认 Step 3 文件链接到 Step 4 image prompt 和 Step 5 video prompt
- 重新运行 `mcp-context` 并检查 `shots` 数组

如果 verification 报错：

- 修改源 Step 文件
- 不要修改 MCP resources、生成的 Obsidian 投影文件或 IDE runtime mirror
- 修改后重新运行 verification

## 未来写入工具

写入工具明确不属于 v0.5 范围。添加之前必须定义：

- 每个 tool 可以编辑哪些 Step 文件
- 如何发现冲突
- 如何保留用户修改
- 变更是 patch 还是整段重写
- 修改后如何运行验证
- 如何报告需要重新生成投影或 runtime mirror

在这些设计完成前，MCP 是只读上下文 adapter。
