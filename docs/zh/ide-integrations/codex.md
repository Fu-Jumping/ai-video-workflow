# Codex

Codex 保留两层运行结构：

- `.codex/ai-video-workflow/`：完整运行镜像层
- `.codex/skills/`：技能运行入口层

## Adapter Contract

- 读取：`packs/official-ai-video/`、`project.config.yaml` 和项目 Step 1 到 Step 6 文件。
- 写入：`.codex/ai-video-workflow/` 和 `.codex/skills/`。
- 不能写入：源 Step 文件、生成的 Obsidian 投影文件、用户 `.obsidian/` 配置或绝对链接。
- 同步方向：`runtime-mirror`。
- 事实源：`project-step-files`。
- 使用 `ai-video-workflow verify --project <path> --ide codex` 验证。
