# AGENTS

标记：ai-video-workflow 共享智能体入口。

默认使用 `official-ai-video` 工作流包。

## 阅读顺序

1. `project.config.yaml`
2. `文档/智能体工作区/入口说明.md`
3. `文档/智能体工作区/边界说明.md`
4. `文档/智能体工作区/智能体交接.md`
5. 源文件目录：`00_前期研究/` 到 `06_执行计划/`

## 事实源

- `project-step-files` 表示步骤零到步骤六的 Markdown 文件是创作事实源。
- `.codex/`、`.cursor/`、`.claude/` 和 `.trae/` 是运行镜像表面。
- `_views/obsidian/` 是生成的 Obsidian vault 观看层；Obsidian vault 文件、MCP 资源、平台缓存和平台记忆都不是项目事实源。
- Cherry Studio 可能创建 `SOUL.md`、`USER.md` 和 `memory/`；保持兼容，但默认不要把它们当作项目事实源。

## 全局规则

- 保持步骤三和步骤四逐镜头对齐。
- 保持步骤四文件合同完整。
- 除非项目明确关闭，否则默认使用增强流程。
- 只使用相对链接。
- 不要覆盖 Cherry Studio 的 `SOUL.md`、`USER.md` 或 `memory/` 宿主表面。
- 平台记忆不是项目事实源。
