# v0.3 发布说明：Obsidian Vault 投影

v0.3 会把官方 AI 视频工作流项目导出成适合 Obsidian 阅读的 vault 投影。这个功能服务于阅读、导航、审阅和智能体交接，不会把 Obsidian 变成第二套工作流来源。

## 主要变化

- 新增 `export-obsidian`，可以从项目 Step 文件生成 Obsidian vault 投影。
- 新增 `verify-obsidian`，用于校验 dashboards、Bases、Canvas、source path、manifest 和可选 UI 建议。
- 新增带 `投影清单.json` 和内容 hash 的安全增量导出。
- 新增项目首页、审阅总览、镜头索引、制作看板和智能体交接等项目页面。
- 新增 `镜头/<shotId>.md` 沉浸式单镜头审阅页。
- 新增 workflow、shot pipeline、review route 和逐镜头 review 的 JSON Canvas。
- 新增用于 workflow files、shot progress、production readiness、review queue 和 modified generated files 的 Obsidian Bases。
- 新增可选 `--include-obsidian-ui`，生成 Bookmarks、Workspace、核心插件和 appearance 建议。
- 新增 `pnpm example:obsidian:ui`，用于可选打开体验的发版 QA。

## 对外命令

```bash
pnpm build
pnpm example:obsidian
pnpm example:obsidian:ui
```

直接使用 CLI：

```bash
node apps/cli/dist/index.js export-obsidian --project examples/官方示例-云上早市 --out .tmp/官方示例-云上早市-obsidian --force
node apps/cli/dist/index.js verify-obsidian --project examples/官方示例-云上早市 --vault .tmp/官方示例-云上早市-obsidian
```

生成可选 UI 建议：

```bash
node apps/cli/dist/index.js export-obsidian --project examples/官方示例-云上早市 --out .tmp/官方示例-云上早市-obsidian-ui --force --include-obsidian-ui
```

## 事实源边界

事实源仍然是项目 Step 1 到 Step 6 Markdown 文件，以及 `official-ai-video` pack。

- 叙事帧和 storyboard 修改回到 Step 3。
- 画面提示词和视觉一致性修改回到 Step 4。
- 视频提示词、运动和镜头行为修改回到 Step 5。
- Obsidian 生成文件用于阅读、定位上下文、画布/数据表导航和复制智能体交接提示词。
- 长期保留的个人审阅笔记放在 `笔记/` 下。

生成的 `流程/`、`镜头/`、`画布/`、`数据表/` 和首页/看板文件都是投影输出，不应被当作源 Step 文件。

## 明确不做

- 不开发 Obsidian 插件。
- 默认不写入 `.obsidian/`。
- 不从 Obsidian 反向同步到源 Step 文件。
- 不从 Obsidian 自动调用智能体。
- 不依赖 Dataview、Tasks、Kanban 或 Excalidraw。
- v0.3 不做 LibTV 执行投影。
- 不直接调用生图或生视频平台。

## 验证

串行运行：

```bash
pnpm build
pnpm test
pnpm example:verify
pnpm example:obsidian
pnpm example:obsidian:ui
pnpm verify:v0.2
git diff --check
rg -n "\[[^\]]+\]\((https?://|file://|vscode://|[A-Za-z]:|/)" README.md README.zh-CN.md docs examples/官方示例-云上早市
```

绝对链接扫描应只命中文档中已有的故意反例。
