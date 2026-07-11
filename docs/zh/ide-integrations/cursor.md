# Cursor

Cursor 使用 `.cursor/rules/` 作为原生规则入口，使用 `.cursor/skills/` 作为 adapter-ready 技能包，使用 `.cursor/ai-video-workflow/` 作为运行镜像。

## Adapter Contract

- 读取：`packs/official-ai-video/`、`project.config.yaml` 和项目 Step 1 到 Step 6 文件。
- 写入：`.cursor/rules/`、`.cursor/skills/` 和 `.cursor/ai-video-workflow/`。
- 不能写入：源 Step 文件、生成的 Obsidian 投影文件、用户 `.obsidian/` 配置或绝对链接。
- 同步方向：`runtime-mirror`。
- 事实源：`project-step-files`。
- 使用 `ai-video-workflow verify --project <path> --ide cursor` 验证。
