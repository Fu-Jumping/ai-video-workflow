# Trae

Trae 使用 `.trae/skills` 作为原生技能目录，默认不使用 `.agents/skills`。

## Adapter Contract

- 读取：`packs/official-ai-video/`、`project.config.yaml` 和项目 Step 1 到 Step 6 文件。
- 写入：`.trae/skills` 原生运行说明。
- 不能写入：源 Step 文件、生成的 Obsidian 投影文件、用户 `.obsidian/` 配置或绝对链接。
- 同步方向：`runtime-mirror`。
- 事实源：`project-step-files`。
- 使用 `ai-video-workflow verify --project <path> --ide trae` 验证。
