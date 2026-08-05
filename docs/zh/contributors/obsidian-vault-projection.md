# Obsidian Vault 投影

Obsidian vault 投影是 `ai-video-workflow` 的阅读、创作辅助和审阅视图，不是新的工作流源。

## 定位

默认工作流源仍然是 `packs/official-ai-video/` 和项目内已启用步骤 Markdown 文件。研究模式会投影 Step 0 到 Step 6，剧本模式会投影 Step 1 到 Step 6。Obsidian adapter 只把这些文件投影成更适合 Obsidian 浏览、关联、审阅和可视化管理的 vault 结构。

## 推荐的项目内观看层

推荐的生产布局是：

```text
project/
├─ 00_前期研究/ ... 06_执行计划/   # 研究模式
└─ _views/
   └─ obsidian/
      ├─ 流程/
      ├─ 镜头/
      ├─ 数据表/
      ├─ 画布/
      ├─ 笔记/
      └─ 投影清单.json
```

`project/` 仍是 AI 智能体工作目录和源文件根目录。`_views/obsidian/` 是 Obsidian vault 根目录。该 vault 内的 `流程/` 是生成 Markdown，用于阅读和回链 Step 文件。用户应在 Obsidian 中打开 `_views/obsidian/`，不要打开 `project/` 本身。

运行：

```powershell
ai-video-workflow export-obsidian --project <path> --in-project-view
ai-video-workflow verify-obsidian --project <path> --in-project-view
```

外部 vault 模式仍然支持 `--out <vault-path>` 和 `--vault <vault-path>`。

## 输入

- 项目根目录
- `project.config.yaml`
- 已启用步骤 Markdown 文件
- `official-ai-video` 的模板、质量门槛和文件合同

## 输出

- 生成的 Obsidian vault 目录，推荐位置为 `_views/obsidian/`
- 带 properties 和 tags 的投影 Markdown
- 使用编号标题的项目首页、审阅页、镜头索引和生产看板
- 集中存放源文件路径、编辑边界和提示词的项目级 `04_智能体交接.md` 页面
- 沉浸式 `镜头/<shotId>.md` 单镜头审阅页
- 带 Review Queue、Shot Progress、Execution Readiness、Modified Generated Files 视图的 Bases `.base` 文件
- 流程图、镜头流水线、审阅地图和逐镜头 `画布/镜头审阅/<shotId>.canvas` 审阅 Canvas 文件
- `投影清单.json` 生成清单
- `笔记/` 用户笔记入口
- 可选社区插件用法说明

## 同步方向

v0.3 只支持从项目到 Obsidian 的单向生成。投影文件必须标记来源路径，便于回到源文件修改。不要在 Obsidian 投影中修改源文件合同，也不要把投影文件当作 Step 文件的替代源。

v0.3.1 起，`export-obsidian` 默认是安全增量导出。再次导出到同一个 vault 时，CLI 会读取 `投影清单.json`，只更新自己生成且未被用户改动的文件。用户新增的笔记不在 manifest 中，会被保留；用户手动修改过的生成文件会被跳过并报告为 `skipped-user-modified`。

`--force` 会清空并重建输出目录，适合需要完全刷新投影时使用。`--dry-run` 只打印计划操作，不写入任何文件。

v0.3.2 起，生成的项目首页会变成审阅总览入口，集中链接审阅队列、镜头进度、执行就绪、Graph/Canvas 路线、数据表和用户笔记区。新增的审阅地图 canvas 会把项目首页、审阅总览、镜头索引、制作看板、数据表、笔记、流程图和镜头流水线组织成一条空间化审阅路线。

v0.3.3 起，每个生成的 `镜头/<shotId>.md` 都是沉浸式单镜头审阅页。它会链接和嵌入分镜、Step 4 图像提示词、Step 5 视频提示词、执行检查入口、用户审阅笔记目标和逐镜头 `画布/镜头审阅/<shotId>.canvas`。镜头页只保留短的修改入口，长期保留的人类评审记录应写在 `笔记/` 下。

v0.3.4 起，`04_智能体交接.md` 集中提供可复制的智能体上下文、逐镜头源文件路径、编辑边界和验证命令。用户可以先在 Obsidian 中观看和定位问题，再进入交接页把对应内容复制给智能体。镜头审阅页不展开完整提示词，避免让面向智能体的文本淹没创作者审阅内容。

v0.3.5 起，生成的项目首页会包含观看路线，用于第一次打开 vault 后快速进入项目、镜头、制作看板和智能体交接。可选的 `--include-obsidian-ui` 建议会把项目首页、智能体交接、镜头索引、审阅地图、镜头流水线和笔记加入书签，并在工作区中并排打开项目首页与审阅总览。

v0.3.6 起，发版硬化会把真实 vault QA 作为显式门槛。如果存在可选 UI 建议，`verify-obsidian` 会校验建议 JSON，包括 Bookmarks 和 Workspace 是否包含必要入口。`pnpm example:obsidian:ui` 会用 `--include-obsidian-ui` 导出官方示例并验证生成的 vault。真正打开 Obsidian 检查仍然是人工 QA 步骤，不作为自动 CLI 行为。

当前生成的观看层控制页、单镜头页、智能体交接页和模板页使用显式编号标题，例如 `## 1. 打开路线`、`## 5. 视频提示词` 和 `### 4.1 单镜头检查`。编号用于 Obsidian 大纲、页面内扫读和交接定位；`流程/` 下投影出来的 Step 文件正文仍保持源文件原样，不会被自动加编号。

`流程/` 投影页会把能映射到项目 Step Markdown 文件的源相对链接改写为 vault 内链接。例如步骤三镜头组文件中的 `../../04_图片提示词/镜头组-001/镜头-002-关键帧-01.md` 会指向 `流程/步骤四 - 图片提示词/镜头组-001/...` 下的真实投影文件，避免 Obsidian 点击时尝试创建不存在的路径。指向 Markdown 笔记的 Obsidian wiki link 使用无 `.md` 后缀的原生目标；Canvas 和 Base 链接仍保留 `.canvas` / `.base` 扩展名。

`verify-obsidian` 会继续校验这些观看层跳转：Markdown 和 wiki 链接必须指向存在的 vault 文件；带 `#` 的 Markdown 标题锚点必须能落到目标页面标题；带 `#` 的 Base 嵌入必须能落到目标 `.base` view；Canvas file 节点和 edge 端点必须可解析；可选 `.obsidian` UI 建议中的 vault 路径必须指向真实文件。

v0.7 起，推荐命令路径是 `--in-project-view`。导出器写入 schema version 2 manifest，不再记录本机绝对项目路径；生成 workflow notes 会记录源文件内容 hash；源 Step 文件在导出后变化时，`verify-obsidian` 会报告 `obsidian-view-stale`。`--force` 如果遇到包含 `.git` 的输出 vault，会拒绝删除。

默认导出不会写入 `.obsidian/`。只有显式使用 `--include-obsidian-ui` 时，才会生成可选的 Bookmarks、Workspace、核心插件和 appearance 建议 JSON。已有用户 `.obsidian` 文件不会被覆盖；导出会报告 `skipped-user-config-existing`，并把建议副本写入 `.obsidian/ai-video-workflow-suggested/`。

## 用户笔记区

`笔记/` 是 Obsidian 内的用户补充空间，适合放评审记录、会议记录、研究笔记和临时想法。增量导出不会覆盖用户在 `笔记/` 下新增的文件。源 Step 文件仍然是工作流事实源，Obsidian 笔记是辅助材料。

## 使用的 Obsidian 能力

- Properties：新导出的生成笔记使用中文属性，例如 `标题`、`镜头标题`、`下一步`、`投影生成`、`源文件路径`、`源文件类型`、`步骤`、`镜头ID`、`镜头顺序`、`阶段`、`审阅状态`、`执行状态`、`需要关注` 和 `状态`。默认数据表只展示创作者确认保留的字段：`标题`、`镜头标题`、`源文件路径`、`源文件类型`、`步骤名称`、`审阅状态`、`执行状态`、`镜头索引`、`审阅画布`、`审阅笔记` 和基于 `file.mtime` 的 `最近修改时间`。`下一步`、`镜头ID`、`投影生成` 等属性仍保留给后续配置、过滤、交接和诊断，但不作为默认可见列。`tags`、`ai-video/...` 标签、`shot-001` 镜头机器 ID 和 `投影清单.json` schema 仍保持机器可读。
- Tags：用 nested tags 区分步骤、文件类型、镜头和状态。
- Markdown 内部链接：用 vault 相对链接连接生成页面。
- Graph：根据内部链接展示工作流关系。
- Search query blocks：在需要时可用于呈现待处理项；默认审阅页优先使用 Bases 和 Canvas，减少技术查询文本。
- Bases：用 `.base` 文件提供表格和卡片视图，浏览审阅队列、镜头进度、执行就绪、已改动生成文件、镜头、流程文件和制作状态。主视图优先显示人读字段，诊断视图保留源路径和生成标记。
- Canvas：用 `.canvas` JSON 文件展示已启用步骤关系、镜头流水线、项目级审阅路线、单镜头审阅路线和智能体交接入口。
- 可选 Bookmarks 和 Workspace：`.obsidian` 建议只属于 opt-in UI 状态。

## Vault QA 清单

- 使用 `pnpm build` 构建 CLI。
- 使用 `pnpm example:obsidian` 导出并验证默认官方示例。
- 使用 `pnpm example:obsidian:ui` 导出并验证带可选 UI 建议的官方示例。
- 使用 `pnpm example:obsidian:in-project` 导出并验证项目内示例。
- 发版 QA 时人工打开 `examples/官方示例-云上早市/_views/obsidian/`，不要打开 `examples/官方示例-云上早市/`。
- 确认项目首页、智能体交接、镜头索引、审阅地图、镜头流水线和笔记都容易进入。
- 确认生成投影文件只用于阅读和定位；源内容修改仍然回到 Step 文件。
- 确认增量导出会保留用户笔记，并且不会覆盖用户已有 `.obsidian` 文件。

## 不做什么

- 不开发 Obsidian 插件。
- 默认不写入 `.obsidian/` 本地 UI 状态。可选 UI 建议必须显式使用 `--include-obsidian-ui`，且不能覆盖已有用户配置。
- 不从 Obsidian 反向同步 Step 文件。
- 不从 Obsidian 自动调用智能体；交接页只提供可复制的上下文。
- 不依赖 Dataview、Tasks、Kanban 或 Excalidraw。
- 不调用生图或生视频平台。

## 验证要求

- 生成文件只能使用相对链接。
- Canvas 文件必须是可解析 JSON。
- `.base` 文件必须是有效 YAML。
- Review Map、关键 dashboard 标记和关键 Bases 视图必须存在。
- 关键观看层页面必须保留编号标题，便于 Obsidian 大纲和页面内导航。
- 生成 Markdown 中指向 vault 内文件的链接必须能解析到真实文件；用户笔记目标除外。
- 生成 Markdown 中指向标题或 Base view 的 `#` 锚点必须能解析到真实标题或真实 view。
- 单镜头审阅页和逐镜头 Review Canvas 必须存在，并且只使用 vault 相对路径。
- Canvas edge 必须连接到真实节点；可选 `.obsidian` UI 配置中的 vault 路径必须存在。
- 智能体交接页面必须存在；镜头页必须保留通往智能体交接页面的短入口。
- 如果存在 `.obsidian/ai-video-workflow-suggested/*.json`，必须能解析为 JSON，并且包含必要的打开路线。
- 每个投影文件必须能追踪到源项目路径。
- `投影清单.json` 必须存在、可解析，记录的 hash 与生成文件一致，不包含本机绝对路径，并能通过源文件 hash 诊断视图过期。
- Step 3 到 Step 4 的帧级对齐和 Step 4 固定合同不能被削弱。
