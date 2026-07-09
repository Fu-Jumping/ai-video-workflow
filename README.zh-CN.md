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

该命令会把官方示例导出为 Obsidian vault 投影，并校验 dashboard、Bases、Canvas 和来源路径。生成的 vault 包含项目首页、审阅队列、镜头进度、执行就绪视图、Workflow Map、Shot Pipeline 和 Review Map。设计边界见 `docs/zh/contributors/obsidian-vault-projection.md`。

`export-obsidian` 默认使用安全增量导出：再次导出到同一个 vault 时，只更新投影层生成文件，保留用户在 Obsidian 中新增的笔记。`--force` 会清空并重建输出目录，`--dry-run` 会只打印将创建、更新、跳过或保留的文件，不写入磁盘。导出的 `Projection Manifest.json` 用于追踪生成文件；`Notes/` 目录用于用户自己的 Obsidian 笔记。

默认导出不会写入 `.obsidian/`。只有显式使用 `--include-obsidian-ui` 时，才会生成可选的 Bookmarks、Workspace、核心插件和 appearance 建议 JSON。已有用户 `.obsidian` 文件不会被覆盖；建议副本会写入 `.obsidian/ai-video-workflow-suggested/`。

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
