# 快速开始

如果你不熟悉本地 CLI，先看 [新手：让智能体代跑 CLI](./beginner-agent-init.md)。新手默认路径是让智能体询问选项并代你运行 CLI。

手动流程仍保留给熟练用户和脚本化场景：

1. 运行 `pnpm install`。
2. 运行 `pnpm build`。
3. 选择交互式或脚本化初始化。
4. 运行 `node apps/cli/dist/index.js verify --project <project-path> --ide <ide>`。
5. 如果校验失败，运行 `node apps/cli/dist/index.js doctor --project <project-path> --ide <ide>`。
6. 如果缺少 IDE 运行文件，运行 `node apps/cli/dist/index.js sync --project <project-path> --ide <ide>`。
7. 从 `01_concept/story-kernel.md` 开始推进项目。

交互式初始化：

```powershell
node apps/cli/dist/index.js init
```

脚本化初始化：

```powershell
node apps/cli/dist/index.js init --name my-ai-video-project --ide codex --image openai --video runway
```

默认 pack 是 `official-ai-video`。除非项目显式关闭，否则默认启用增强流程。

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
node apps/cli/dist/index.js export-obsidian --project examples/official-mini-film --out .tmp/official-mini-film-obsidian
node apps/cli/dist/index.js verify-obsidian --project examples/official-mini-film --vault .tmp/official-mini-film-obsidian
```

默认导出是安全增量模式。再次导出到同一个 vault 时，CLI 会读取 `Projection Manifest.json`，只更新未被用户改动的生成文件，并保留用户在 `Notes/` 中新增的笔记。

生成的 vault 包含 Project Home、Review Dashboard、Shot Index、Production Board、Agent Handoff 页面、Review Queue、Shot Progress、Execution Readiness、Workflow Map、Shot Pipeline、Review Map、沉浸式 `Shots/<shotId>.md` 单镜头审阅页，以及逐镜头 `Canvas/Shot Reviews/<shotId>.canvas`。打开 `00_Project_Home.md` 后，按 `Open Vault Workflow` 先看项目、进入镜头、用 `04_Agent_Handoff.md` 把源文件上下文复制到智能体对话中，并在源 Step 文件修改后重新校验。这些都是基于 Step 文件生成的审阅视图，不是第二套事实源。

常用选项：

```powershell
node apps/cli/dist/index.js export-obsidian --project examples/official-mini-film --in-project-view --dry-run
node apps/cli/dist/index.js export-obsidian --project examples/official-mini-film --in-project-view --force
node apps/cli/dist/index.js export-obsidian --project examples/official-mini-film --in-project-view --include-obsidian-ui
```

`--dry-run` 只打印计划操作，不写入文件。`--force` 会清空并重建输出 vault；如果该 vault 包含 `.git`，命令会拒绝删除。默认导出不会写入 `.obsidian/`；`--include-obsidian-ui` 会额外生成可选的 Bookmarks 和 Workspace 建议，用于预置 Project Home、Agent Handoff、Shot Index、Review Map 和 Shot Pipeline，且不会覆盖已有用户配置。该投影是单向生成的阅读和审阅视图，不要把投影文件当作源 Step 文件。更多边界见 [Obsidian Vault 投影](../contributors/obsidian-vault-projection.md)。
