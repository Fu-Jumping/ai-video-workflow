# Quickstart

If you are new to local CLI tools, start with [Beginner start with an agent](./beginner-agent-init.md). The recommended beginner path is to let an agent ask for choices and run the CLI for you.

Manual setup remains available for advanced and scripted use:

1. Run `pnpm install`.
2. Run `pnpm build`.
3. Choose either interactive or scripted initialization.
4. Run `node apps/cli/dist/index.js verify --project <project-path> --ide <ide>`.
5. If verification fails, run `node apps/cli/dist/index.js doctor --project <project-path> --ide <ide>`.
6. If IDE runtime files are missing, run `node apps/cli/dist/index.js sync --project <project-path> --ide <ide>`.
7. Start working from `01_概念策划/故事内核.md`.

Interactive initialization:

```powershell
node apps/cli/dist/index.js init
```

Scripted initialization:

```powershell
node apps/cli/dist/index.js init --name my-ai-video-project --ide codex --image openai --video runway
```

The default pack is `official-ai-video`, and enhanced flow is enabled unless the project explicitly disables it.

## Export an Obsidian Vault Projection

After building, export the official example into the recommended in-project Obsidian viewing layer:

```powershell
pnpm build
pnpm example:obsidian:in-project
```

For project work, keep the AI agent working directory at the project root and open only `project/_views/obsidian/` as the Obsidian vault. Do not open `project/` itself as the vault for this workflow.

Use the CLI directly:

```powershell
node apps/cli/dist/index.js export-obsidian --project <project-path> --in-project-view
node apps/cli/dist/index.js verify-obsidian --project <project-path> --in-project-view
```

After an agent changes Step files, run:

```powershell
ai-video-workflow verify --project <path> --ide <id>
ai-video-workflow export-obsidian --project <path> --in-project-view
ai-video-workflow verify-obsidian --project <path> --in-project-view
```

External vault mode remains available when you want the generated vault outside the project:

```powershell
node apps/cli/dist/index.js export-obsidian --project examples/官方示例-云上早市 --out .tmp/官方示例-云上早市-obsidian
node apps/cli/dist/index.js verify-obsidian --project examples/官方示例-云上早市 --vault .tmp/官方示例-云上早市-obsidian
```

Default export is safe and incremental. When exporting to the same vault again, the CLI reads `投影清单.json`, updates generated files that have not been user-edited, and preserves user notes created under `笔记/`.

The generated vault includes `00_项目首页.md`, `01_审阅总览.md`, `02_镜头索引.md`, `03_制作看板.md`, `04_智能体交接.md`, review queues, shot progress, execution readiness, `画布/流程图.canvas`, `画布/镜头流水线.canvas`, `画布/审阅地图.canvas`, immersive `镜头/<shotId>.md` review pages, and per-shot `画布/镜头审阅/<shotId>.canvas` canvases. Open `00_项目首页.md`, follow the viewing route, inspect a shot, use `04_智能体交接.md` to copy source-file context into an agent conversation, then rerun verification after source Step edits. These are generated views over the Step files, not a second source of truth.

Common options:

```powershell
node apps/cli/dist/index.js export-obsidian --project examples/官方示例-云上早市 --in-project-view --dry-run
node apps/cli/dist/index.js export-obsidian --project examples/官方示例-云上早市 --in-project-view --force
node apps/cli/dist/index.js export-obsidian --project examples/官方示例-云上早市 --in-project-view --include-obsidian-ui
```

`--dry-run` prints planned operations without writing files. `--force` clears and rebuilds the output vault, and refuses to delete a vault containing `.git`. By default, export does not write `.obsidian/`; `--include-obsidian-ui` adds optional suggested Bookmarks and Workspace for the project home, agent handoff, shot index, review map, and shot pipeline without overwriting existing user config. The projection is a one-way reading and review view. Do not treat projected files as source Step files. See [Obsidian vault projection](../contributors/obsidian-vault-projection.md) for the boundary.

## Clean and Rebuild the In-Project View

If `_views/obsidian/` contains stale generated projection files, use the maintenance commands instead of deleting the whole project directory manually:

```powershell
node apps/cli/dist/index.js clean-view --project <project-path> --dry-run
node apps/cli/dist/index.js clean-view --project <project-path>
node apps/cli/dist/index.js rebuild-view --project <project-path>
```

`clean-view` only removes generated files recorded in the in-project view manifest `投影清单.json`, and preserves untracked files such as hand-written notes you add under `笔记/`. `rebuild-view` syncs the IDE runtime from the project config by default, cleans the old in-project view, exports a fresh one, and verifies it.

You can also clean or rebuild only part of the generated viewing layer:

```powershell
node apps/cli/dist/index.js clean-view --project <project-path> --step 4 --dry-run
node apps/cli/dist/index.js rebuild-view --project <project-path> --shot shot-002
node apps/cli/dist/index.js clean-view --project <project-path> --kind canvas --dry-run
node apps/cli/dist/index.js clean-view --project <project-path> --dir "流程/步骤四 - 图片提示词" --dry-run
node apps/cli/dist/index.js rebuild-view --project <project-path> --property 源文件类型=图片提示词
```

Supported filters are `--kind workflow-notes|shot-pages|canvas|base|dashboard|obsidian-ui`, `--step 1..6`, `--shot shot-002` or `--shot 2`, `--dir <vault-relative-path>`, and `--property field=value`. You can repeat a filter or comma-separate values. Values within one filter are OR; different filter types combine as AND. `--dir` must be a vault-relative path using `/`, not an absolute path, backslash path, `.`, or `..`. `--property` only matches generated Markdown frontmatter equality and does not match `.canvas` or `.base` files.

Partial `clean-view` removes matched generated files from `投影清单.json`, which is useful for inspecting stale output or preparing a local rebuild. To end with a complete verifiable viewing layer, prefer running filtered `rebuild-view` directly.

Filtered `--dry-run` output groups matched files by generated type, shows representative paths, marks the cleanup risk, and prints the next command to run after review.

Use `--dry-run` to preview the cleanup and export plan. Use `--skip-sync` when you want to rebuild the view without refreshing IDE runtime files. `export-obsidian --force` remains available as the advanced destructive rebuild path because it clears the output vault; prefer `rebuild-view` for routine maintenance.
