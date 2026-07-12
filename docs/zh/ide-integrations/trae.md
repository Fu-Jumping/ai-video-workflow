# Trae

Trae 使用 `.trae/skills/` 作为原生技能包，使用 `.trae/rules/` 作为运行规则入口，使用 `.trae/specs/ai-video-workflow/` 作为生成的工作流规范，使用 `.trae/documents/ai-video-workflow/` 作为可读运行镜像。默认不使用 `.agents/skills`。

`AGENTS.md` 是跨智能体共享入口。Trae 专属说明应放在 `.trae/rules/`。

## 生成输出

`sync --ide trae` 会写入：

- `AGENTS.md`
- `.trae/skills/`
- `.trae/rules/ai-video-workflow.md`
- `.trae/specs/ai-video-workflow/`
- `.trae/documents/ai-video-workflow/WORKFLOW_OVERVIEW.md`
- `.trae/documents/ai-video-workflow/skills/`
- `.trae/documents/ai-video-workflow/skill-bundles/`
- `.trae/documents/ai-video-workflow/templates/`
- `.trae/documents/ai-video-workflow/indexes/`

它不会写入 `CLAUDE.md`；需要 Claude Code 根入口时应使用 Claude Code adapter。

Trae 应先读取 `AGENTS.md`，再读取 `.trae/rules/ai-video-workflow.md`，然后继续读取 documents 镜像和技能包。需要修改项目时，应编辑源 Step 文件，而不是生成的 Trae 镜像或 Obsidian 投影文件。

## Adapter Contract

- 读取：`packs/official-ai-video/`、`project.config.yaml` 和项目 Step 1 到 Step 6 文件。
- 写入：`AGENTS.md`、`.trae/skills/`、`.trae/rules/`、`.trae/specs/ai-video-workflow/` 和 `.trae/documents/ai-video-workflow/`。
- 不能写入：源 Step 文件、生成的 Obsidian 投影文件、用户 `.obsidian/` 配置、`CLAUDE.md` 或绝对链接。
- 同步方向：`runtime-mirror`。
- 事实源：`project-step-files`。
- 使用 `ai-video-workflow verify --project <path> --ide trae` 验证。
