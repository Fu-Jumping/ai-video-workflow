# Obsidian Vault 投影

Obsidian vault 投影是 `ai-video-workflow` 的阅读、创作辅助和审阅视图，不是新的工作流源。

## 定位

默认工作流源仍然是 `packs/official-ai-video/` 和项目内 Step 1 到 Step 6 Markdown 文件。Obsidian adapter 只把这些文件投影成更适合 Obsidian 浏览、关联、审阅和可视化管理的 vault 结构。

## 输入

- 项目根目录
- `project.config.yaml`
- Step 1 到 Step 6 Markdown 文件
- `official-ai-video` 的模板、质量门槛和文件合同

## 输出

- 生成的 Obsidian vault 目录
- 带 properties 和 tags 的投影 Markdown
- 项目首页、审阅页、镜头索引和生产看板
- Bases `.base` 文件
- Canvas `.canvas` 文件
- 可选社区插件用法说明

## 同步方向

v0.3 只支持从项目到 Obsidian 的单向生成。投影文件必须标记来源路径，便于回到源文件修改。不要在 Obsidian 投影中修改源文件合同，也不要把投影文件当作 Step 文件的替代源。

## 使用的 Obsidian 能力

- Properties：记录 `source_path`、`source_kind`、`step`、`shot_id` 和 `status`。
- Tags：用 nested tags 区分步骤、文件类型、镜头和状态。
- Backlinks / Outgoing links / Graph：通过真实内部链接展示工作流关系。
- Search query blocks：在 dashboard 中呈现待处理项。
- Bases：用表格和卡片视图浏览镜头、文件和生产状态。
- Canvas：用 JSON Canvas 展示 Step 1 到 Step 6 关系和镜头流水线。

## 不做什么

- 不开发 Obsidian 插件。
- 不写入 `.obsidian/` 本地 UI 状态。
- 不从 Obsidian 反向同步 Step 文件。
- 不依赖 Dataview、Tasks、Kanban 或 Excalidraw。
- 不调用生图或生视频平台。

## 验证要求

- 生成文件只能使用相对链接。
- Canvas 文件必须是可解析 JSON。
- `.base` 文件必须是有效 YAML。
- 每个投影文件必须能追踪到源项目路径。
- Step 3 到 Step 4 的帧级对齐和 Step 4 固定合同不能被削弱。
