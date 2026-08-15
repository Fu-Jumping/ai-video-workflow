# 快速开始

如果你不熟悉本地 CLI，先看 [新手：让智能体代跑 CLI](./beginner-agent-init.md)。新手默认路径是让智能体询问选项并代你运行 CLI。

手动流程仍保留给熟练用户和脚本化场景：

1. 运行 `pnpm install`。
2. 运行 `pnpm build`。
3. 选择交互式或脚本化初始化。
4. 运行 `node apps/cli/dist/index.js verify --project <project-path> --ide <ide>`。
5. 如果校验失败，运行 `node apps/cli/dist/index.js doctor --project <project-path> --ide <ide>`。
6. 如果缺少 IDE 运行文件，运行 `node apps/cli/dist/index.js sync --project <project-path> --ide <ide>`。
7. 默认从 `00_前期研究/00_研究总览.md` 开始推进项目；如果已有完整剧本，可初始化时加 `--start-from script`，从 `01_概念策划/故事内核.md` 开始。

交互式初始化：

```powershell
node apps/cli/dist/index.js init
```

脚本化初始化：

```powershell
node apps/cli/dist/index.js init --name my-ai-video-project --ide codex --image openai --video runway
```

默认 pack 是 `official-ai-video`。新建项目默认启用 Step 0 前期研究和增强流程；已有完整剧本时使用：

```powershell
node apps/cli/dist/index.js init --name my-script-project --ide codex --image openai --video runway --start-from script
```

Step 0 资料归档命令：

```powershell
ai-video-workflow research ingest --project <project-path> --source <url-or-file> --platform auto --with-comments --comment-limit 10
ai-video-workflow research inbox --project <project-path>
```

`research ingest` 生成可追溯的 `SRC-xxxx` 来源卡。CLI 不保存 cookie、token、浏览器 profile 或完整评论原始包；这些本地原始材料默认被 `.gitignore` 排除。

## 导出 Obsidian vault 投影

构建后，可以把官方示例导出到推荐的项目内 Obsidian 观看层：

```powershell
pnpm build
pnpm example:obsidian:in-project
```

实际项目中，AI 智能体工作目录仍是项目根目录；Obsidian 只打开 `project/_views/obsidian/` 作为 vault。不要把 `project/` 本身作为这个工作流的 Obsidian vault。

也可以直接运行 CLI：

```powershell
node apps/cli/dist/index.js export-obsidian --project <project-path> --in-project-view
node apps/cli/dist/index.js verify-obsidian --project <project-path> --in-project-view
```

智能体修改 Step 文件后，按顺序运行：

```powershell
ai-video-workflow verify --project <path> --ide <id>
ai-video-workflow export-obsidian --project <path> --in-project-view
ai-video-workflow verify-obsidian --project <path> --in-project-view
```

如果你更想把生成 vault 放在项目外，外部 vault 模式仍然可用：

```powershell
node apps/cli/dist/index.js export-obsidian --project examples/官方示例-云上早市 --out .tmp/官方示例-云上早市-obsidian
node apps/cli/dist/index.js verify-obsidian --project examples/官方示例-云上早市 --vault .tmp/官方示例-云上早市-obsidian
```

默认导出是安全增量模式。再次导出到同一个 vault 时，CLI 会读取 `投影清单.json`，只更新未被用户改动的生成文件，并保留用户在 `04_个人笔记/` 中新增的笔记；升级旧布局时，会清理可由清单证明且未修改的旧生成文件，并迁移旧 `笔记/` 中的用户笔记。

生成的 vault 以五个编号入口组织：`00_开始审阅/`、`01_阶段审核/`、`02_按镜头联查/`、`03_审阅工具/` 和 `04_个人笔记/`。从 `00_开始审阅/00_项目首页.md` 进入后，默认先按阶段审核；在每个阶段按镜头组与镜头顺序完整审阅。只有发现跨阶段不一致时，才进入 `02_按镜头联查/单镜头/<shotId>.md`，并可使用 `03_审阅工具/01_智能体交接.md` 复制源文件上下文给智能体。这些都是基于 Step 文件生成的审阅视图，不是第二套事实源。

常用选项：

```powershell
node apps/cli/dist/index.js export-obsidian --project examples/官方示例-云上早市 --in-project-view --dry-run
node apps/cli/dist/index.js export-obsidian --project examples/官方示例-云上早市 --in-project-view --force
node apps/cli/dist/index.js export-obsidian --project examples/官方示例-云上早市 --in-project-view --include-obsidian-ui
```

`--dry-run` 只打印计划操作，不写入文件。`--force` 会清空并重建输出 vault；如果该 vault 包含 `.git`，命令会拒绝删除。默认导出不会写入 `.obsidian/`；`--include-obsidian-ui` 会额外生成可选的书签和工作区建议，用于预置项目首页、智能体交接、镜头索引、审阅地图和镜头流水线，且不会覆盖已有用户配置。该投影是单向生成的阅读和审阅视图，不要把投影文件当作源 Step 文件。更多边界见 [Obsidian Vault 投影](../contributors/obsidian-vault-projection.md)。

## 清理与重建项目内观看层

如果 `_views/obsidian/` 里残留了旧投影文件，优先使用维护命令，而不是手工删除整个项目目录：

```powershell
node apps/cli/dist/index.js clean-view --project <project-path> --dry-run
node apps/cli/dist/index.js clean-view --project <project-path>
node apps/cli/dist/index.js rebuild-view --project <project-path>
```

`clean-view` 只清理项目内 `_views/obsidian/` 中由 `投影清单.json` 记录的生成文件，并保留清单外文件，例如你在 `04_个人笔记/` 里新增的手写笔记。`rebuild-view` 会默认先同步当前项目配置里的 IDE runtime，再清理旧观看层、重新导出并运行观看层校验。

也可以只清理或重建一部分观看层生成文件：

```powershell
node apps/cli/dist/index.js clean-view --project <project-path> --step 4 --dry-run
node apps/cli/dist/index.js rebuild-view --project <project-path> --shot shot-002
node apps/cli/dist/index.js clean-view --project <project-path> --kind canvas --dry-run
node apps/cli/dist/index.js clean-view --project <project-path> --dir "01_阶段审核/04_图片提示词" --dry-run
node apps/cli/dist/index.js rebuild-view --project <project-path> --property 源文件类型=图片提示词
```

可用筛选条件包括 `--kind workflow-notes|shot-pages|canvas|base|dashboard|obsidian-ui`、`--step 0..6`、`--shot shot-002` 或 `--shot 2`、`--dir <vault-relative-path>` 和 `--property 字段=值`。同一条件可重复写，也可以用英文逗号分隔；不同条件会叠加缩小范围。`--dir` 必须是 Obsidian vault 内的相对路径，使用 `/`，不能写绝对路径、反斜杠、`.` 或 `..`。`--property` 只匹配生成 Markdown 的 properties 等值，不会匹配 `.canvas` 或 `.base`。

局部 `clean-view` 会把命中的生成文件从 `投影清单.json` 中移除，适合排查残留或准备局部重建；如果要得到完整可校验的观看层，优先直接运行带筛选条件的 `rebuild-view`。

带筛选条件的 `--dry-run` 会按生成类型分组列出代表文件、标出清理风险和给出下一条可执行命令；先看清列表，再移除 `--dry-run` 或运行对应的 `rebuild-view`。

如果只是想看会发生什么，加 `--dry-run`。如果你只想重建观看层、不补 IDE runtime，可以加 `--skip-sync`。`export-obsidian --force` 仍是高级破坏性重建入口，会清空输出 vault；日常维护优先用 `rebuild-view`。
