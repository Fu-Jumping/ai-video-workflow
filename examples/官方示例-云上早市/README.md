# 官方示例-云上早市

这是一个由 `ai-video-workflow` 生成的 AI 视频创作项目，不是 `ai-video-workflow` 工具仓库本身。

## 从这里开始

1. 请在你的 AI 智能体中打开这个项目目录。
2. 让智能体先读取 `AGENTS.md` 和 `文档/智能体工作区/入口说明.md`。
3. 从 `00_前期研究/00_研究总览.md` 开始查看资料依据，再进入 `01_概念策划/故事内核.md`。
4. 以步骤零到步骤六的源文件作为事实源。

## 常用命令

```powershell
ai-video-workflow verify --project . --ide codex
ai-video-workflow export-obsidian --project . --in-project-view
ai-video-workflow verify-obsidian --project . --in-project-view
```

## Obsidian 边界

如果使用 Obsidian，请把 `_views/obsidian/` 作为 vault 打开。不要把这个项目根目录本身当作 Obsidian vault。

外部 vault 模式仍可使用：`ai-video-workflow export-obsidian --project . --out <vault-path>`。
