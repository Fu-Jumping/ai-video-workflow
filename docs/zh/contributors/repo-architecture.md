# 仓库架构

仓库采用 workspace 结构，包含 CLI、docs、packs、scaffolds、examples、schemas 和 tests。

- `packs/official-ai-video/` 是工作流母版源（规则、模板、skills、质量门槛、checks）。
- `apps/cli/` 是 TypeScript CLI（init / sync / verify / doctor / impact / deviation / research / obsidian / mcp / libtv）。
- `docs/` 包含双语 VitePress 文档站；面向 Agent 的上下文工程材料保留在仓库目录中，不编入公开站点。

给 Agent 的完整结构说明、任务路由与验证门禁见仓库内 `docs/context-engineering/00-project-context.md`；面向人类的系统级讲解见 [workflow-system-map.md](./workflow-system-map.md)。
