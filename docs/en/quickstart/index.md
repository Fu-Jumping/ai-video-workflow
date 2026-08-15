# Quickstart

If you are new to local CLI tools, start with [Beginner start with an agent](./beginner-agent-init.md). The recommended beginner path is to let an agent ask for choices and run the CLI for you.

Manual setup remains available for advanced and scripted use:

1. Run `pnpm install`.
2. Run `pnpm build`.
3. Choose either interactive or scripted initialization.
4. Run `node apps/cli/dist/index.js verify --project <project-path> --ide <ide>`.
5. If verification fails, run `node apps/cli/dist/index.js doctor --project <project-path> --ide <ide>`.
6. If IDE runtime files are missing, run `node apps/cli/dist/index.js sync --project <project-path> --ide <ide>`.
7. By default, start from `00_前期研究/00_研究总览.md`. If you already have a complete script, initialize with `--start-from script` and start from `01_概念策划/故事内核.md`.

Interactive initialization:

```powershell
node apps/cli/dist/index.js init
```

Scripted initialization:

```powershell
node apps/cli/dist/index.js init --name my-ai-video-project --ide codex --image openai --video runway
```

The default pack is `official-ai-video`. New projects enable Step 0 research and enhanced flow by default. For complete-script projects, use:

```powershell
node apps/cli/dist/index.js init --name my-script-project --ide codex --image openai --video runway --start-from script
```

Step 0 source archiving:

```powershell
ai-video-workflow research ingest --project <project-path> --source <url-or-file> --platform auto --with-comments --comment-limit 10
ai-video-workflow research inbox --project <project-path>
```

`research ingest` creates traceable `SRC-xxxx` source cards. The CLI does not store cookies, tokens, browser profiles, or complete raw comment packages in project truth; local raw material is gitignored by default.

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

Default export is safe and incremental. When exporting to the same vault again, the CLI reads `投影清单.json`, updates generated files that have not been user-edited, and preserves user notes created under `04_个人笔记/`. When upgrading a legacy vault, it removes only manifest-proven, unchanged generated files and migrates user notes from the former `笔记/` directory.

The vault has five numbered entry areas: `00_开始审阅/`, `01_阶段审核/`, `02_按镜头联查/`, `03_审阅工具/`, and `04_个人笔记/`. Start at `00_开始审阅/00_项目首页.md`, review each production stage in order, then review each stage by shot group and shot order. Use `02_按镜头联查/单镜头/<shotId>.md` only when an inconsistency crosses stages, and use `03_审阅工具/01_智能体交接.md` to copy source-file context into an agent conversation. These are generated views over the Step files, not a second source of truth.

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

`clean-view` only removes generated files recorded in the in-project view manifest `投影清单.json`, and preserves untracked files such as hand-written notes you add under `04_个人笔记/`. `rebuild-view` syncs the IDE runtime from the project config by default, cleans the old in-project view, exports a fresh one, and verifies it.

You can also clean or rebuild only part of the generated viewing layer:

```powershell
node apps/cli/dist/index.js clean-view --project <project-path> --step 4 --dry-run
node apps/cli/dist/index.js rebuild-view --project <project-path> --shot shot-002
node apps/cli/dist/index.js clean-view --project <project-path> --kind canvas --dry-run
node apps/cli/dist/index.js clean-view --project <project-path> --dir "01_阶段审核/04_图片提示词" --dry-run
node apps/cli/dist/index.js rebuild-view --project <project-path> --property 源文件类型=图片提示词
```

Supported filters are `--kind workflow-notes|shot-pages|canvas|base|dashboard|obsidian-ui`, `--step 0..6`, `--shot shot-002` or `--shot 2`, `--dir <vault-relative-path>`, and `--property field=value`. You can repeat a filter or comma-separate values. Values within one filter are OR; different filter types combine as AND. `--dir` must be a vault-relative path using `/`, not an absolute path, backslash path, `.`, or `..`. `--property` only matches generated Markdown frontmatter equality and does not match `.canvas` or `.base` files.

Partial `clean-view` removes matched generated files from `投影清单.json`, which is useful for inspecting stale output or preparing a local rebuild. To end with a complete verifiable viewing layer, prefer running filtered `rebuild-view` directly.

Filtered `--dry-run` output groups matched files by generated type, shows representative paths, marks the cleanup risk, and prints the next command to run after review.

Use `--dry-run` to preview the cleanup and export plan. Use `--skip-sync` when you want to rebuild the view without refreshing IDE runtime files. `export-obsidian --force` remains available as the advanced destructive rebuild path because it clears the output vault; prefer `rebuild-view` for routine maintenance.
