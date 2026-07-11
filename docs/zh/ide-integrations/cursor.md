# Cursor

Cursor 使用兼容入口文件与 `.cursor` 原生目标目录。

## Adapter Contract

- 读取：`packs/official-ai-video/`、`project.config.yaml` 和项目 Step 1 到 Step 6 文件。
- 写入：Cursor 可读的运行说明和 `.cursor` 原生目标。
- 不能写入：源 Step 文件、生成的 Obsidian 投影文件、用户 `.obsidian/` 配置或绝对链接。
- 同步方向：`runtime-mirror`。
- 事实源：`project-step-files`。
- 使用 `ai-video-workflow verify --project <path> --ide cursor` 验证。
