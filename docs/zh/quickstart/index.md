# 快速开始

1. 运行 `pnpm install`。
2. 运行 `pnpm build`。
3. 选择交互式或脚本化初始化。
4. 运行 `node apps/cli/dist/index.js verify --project <project-path> --ide <ide>`。
5. 如果校验失败，运行 `node apps/cli/dist/index.js doctor --project <project-path> --ide <ide>`。
6. 如果缺少 IDE 运行文件，运行 `node apps/cli/dist/index.js sync --project <project-path> --ide <ide>`。
7. 从 `01_concept/` 开始推进项目。

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

构建后，可以把官方示例导出为 Obsidian 可浏览的 vault 投影：

```powershell
pnpm build
pnpm example:obsidian
```

也可以直接指定项目和输出目录：

```powershell
node apps/cli/dist/index.js export-obsidian --project examples/official-mini-film --out .tmp/official-mini-film-obsidian
node apps/cli/dist/index.js verify-obsidian --project examples/official-mini-film --vault .tmp/official-mini-film-obsidian
```

默认导出是安全增量模式。再次导出到同一个 vault 时，CLI 会读取 `Projection Manifest.json`，只更新未被用户改动的生成文件，并保留用户在 `Notes/` 中新增的笔记。

生成的 vault 包含 Project Home、Review Dashboard、Shot Index、Production Board、Review Queue、Shot Progress、Execution Readiness、Workflow Map、Shot Pipeline 和 Review Map。这些都是基于 Step 文件生成的审阅视图，不是第二套事实源。

常用选项：

```powershell
node apps/cli/dist/index.js export-obsidian --project examples/official-mini-film --out .tmp/official-mini-film-obsidian --dry-run
node apps/cli/dist/index.js export-obsidian --project examples/official-mini-film --out .tmp/official-mini-film-obsidian --force
node apps/cli/dist/index.js export-obsidian --project examples/official-mini-film --out .tmp/official-mini-film-obsidian --include-obsidian-ui
```

`--dry-run` 只打印计划操作，不写入文件。`--force` 会清空并重建输出目录。默认导出不会写入 `.obsidian/`；`--include-obsidian-ui` 会额外生成可选的 Bookmarks、Workspace、核心插件和 appearance 建议 JSON，且不会覆盖已有用户配置。该投影是单向生成的阅读和审阅视图，不要把投影文件当作源 Step 文件。更多边界见 [Obsidian Vault 投影](../contributors/obsidian-vault-projection.md)。
