# Claude Code

Claude Code 使用 `CLAUDE.md` 作为根入口，使用 `.claude/skills/` 作为 adapter-ready 技能包，使用 `.claude/commands/` 作为命令式交接入口，使用 `.claude/ai-video-workflow/` 作为生成的运行镜像。

## 生成输出

`sync --ide claude-code` 会写入：

- `CLAUDE.md`
- `.claude/skills/`
- `.claude/commands/ai-video-workflow.md`
- `.claude/ai-video-workflow/WORKFLOW_OVERVIEW.md`
- `.claude/ai-video-workflow/workflow/`
- `.claude/ai-video-workflow/skills/`
- `.claude/ai-video-workflow/skill-bundles/`
- `.claude/ai-video-workflow/templates/`
- `.claude/ai-video-workflow/indexes/`

Claude Code 应先读取根入口，再沿运行镜像和技能包继续读取。需要修改项目时，应编辑源 Step 文件，而不是生成的运行镜像或 Obsidian 投影文件。

## Adapter Contract

- 读取：`packs/official-ai-video/`、`project.config.yaml` 和项目 Step 1 到 Step 6 文件。
- 写入：`CLAUDE.md`、`.claude/skills/`、`.claude/commands/` 和 `.claude/ai-video-workflow/`。
- 不能写入：源 Step 文件、生成的 Obsidian 投影文件、用户 `.obsidian/` 配置或绝对链接。
- 同步方向：`runtime-mirror`。
- 事实源：`project-step-files`。
- 使用 `ai-video-workflow verify --project <path> --ide claude-code` 验证。
