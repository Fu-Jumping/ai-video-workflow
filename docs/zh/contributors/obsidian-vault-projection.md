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
- 沉浸式 `Shots/<shotId>.md` 单镜头审阅页
- 带 Review Queue、Shot Progress、Execution Readiness、Modified Generated Files 视图的 Bases `.base` 文件
- Workflow Map、Shot Pipeline、Review Map 和逐镜头 `Canvas/Shot Reviews/<shotId>.canvas` 审阅 Canvas 文件
- `Projection Manifest.json` 生成清单
- `Notes/` 用户笔记入口
- 可选社区插件用法说明

## 同步方向

v0.3 只支持从项目到 Obsidian 的单向生成。投影文件必须标记来源路径，便于回到源文件修改。不要在 Obsidian 投影中修改源文件合同，也不要把投影文件当作 Step 文件的替代源。

v0.3.1 起，`export-obsidian` 默认是安全增量导出。再次导出到同一个 vault 时，CLI 会读取 `Projection Manifest.json`，只更新自己生成且未被用户改动的文件。用户新增的笔记不在 manifest 中，会被保留；用户手动修改过的生成文件会被跳过并报告为 `skipped-user-modified`。

`--force` 会清空并重建输出目录，适合需要完全刷新投影时使用。`--dry-run` 只打印计划操作，不写入任何文件。

v0.3.2 起，生成的项目首页会变成审阅总览入口，集中链接审阅队列、镜头进度、执行就绪、Graph/Canvas 路线、Bases 和用户笔记区。新增的 Review Map canvas 会把 Project Home、Review Dashboard、Shot Index、Production Board、Bases、Notes、Workflow Map 和 Shot Pipeline 组织成一条空间化审阅路线。

v0.3.3 起，每个生成的 `Shots/<shotId>.md` 都是沉浸式单镜头审阅页。它会链接和嵌入 storyboard、Step 4 图像提示词、Step 5 视频提示词、执行就绪入口、用户审阅笔记目标和逐镜头 `Canvas/Shot Reviews/<shotId>.canvas`。镜头页仍然是生成投影内容；长期保留的人类评审记录应写在 `Notes/` 下。

默认导出不会写入 `.obsidian/`。只有显式使用 `--include-obsidian-ui` 时，才会生成可选的 Bookmarks、Workspace、核心插件和 appearance 建议 JSON。已有用户 `.obsidian` 文件不会被覆盖；导出会报告 `skipped-user-config-existing`，并把建议副本写入 `.obsidian/ai-video-workflow-suggested/`。

## 用户笔记区

`Notes/` 是 Obsidian 内的用户补充空间，适合放评审记录、会议记录、研究笔记和临时想法。增量导出不会覆盖用户在 `Notes/` 下新增的文件。源 Step 文件仍然是工作流事实源，Obsidian 笔记是辅助材料。

## 使用的 Obsidian 能力

- Properties：记录 `source_path`、`source_kind`、`step`、`shot_id`、`shot_order`、`stage_group`、`review_status`、`execution_status`、`needs_attention` 和 `status`。
- Tags：用 nested tags 区分步骤、文件类型、镜头和状态。
- Backlinks / Outgoing links / Graph：通过真实内部链接展示工作流关系。
- Search query blocks：在 dashboard 中呈现待处理项。
- Bases：用表格和卡片视图浏览 Review Queue、Shot Progress、Execution Readiness、Modified Generated Files、镜头、文件和生产状态。
- Canvas：用 JSON Canvas 展示 Step 1 到 Step 6 关系、镜头流水线、项目级审阅路线和单镜头审阅路线。

## 不做什么

- 不开发 Obsidian 插件。
- 默认不写入 `.obsidian/` 本地 UI 状态。可选 UI 建议必须显式使用 `--include-obsidian-ui`，且不能覆盖已有用户配置。
- 不从 Obsidian 反向同步 Step 文件。
- 不依赖 Dataview、Tasks、Kanban 或 Excalidraw。
- 不调用生图或生视频平台。

## 验证要求

- 生成文件只能使用相对链接。
- Canvas 文件必须是可解析 JSON。
- `.base` 文件必须是有效 YAML。
- Review Map、关键 dashboard 标记和关键 Bases 视图必须存在。
- 单镜头审阅页和逐镜头 Review Canvas 必须存在，并且只使用 vault 相对路径。
- 如果存在 `.obsidian/ai-video-workflow-suggested/*.json`，必须能解析为 JSON。
- 每个投影文件必须能追踪到源项目路径。
- `Projection Manifest.json` 必须存在、可解析，并且记录的 hash 与生成文件一致。
- Step 3 到 Step 4 的帧级对齐和 Step 4 固定合同不能被削弱。
