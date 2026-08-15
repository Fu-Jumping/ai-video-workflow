# v0.3 Release Notes: Obsidian Vault Projection

v0.3 turns the official AI video workflow project into an Obsidian-readable vault projection. The feature is designed for reading, navigation, review, and agent handoff. It does not make Obsidian a second workflow source.

> **Current layout note:** This release note records the v0.3 paths. The current vault uses `00_开始审阅/`, `01_阶段审核/`, `02_按镜头联查/`, `03_审阅工具/`, and `04_个人笔记/`; see [Obsidian Vault Projection](./obsidian-vault-projection.md) for the active contract.

## What Changed

- Added `export-obsidian` to generate an Obsidian vault projection from project Step files.
- Added `verify-obsidian` to validate dashboards, Bases, Canvas files, source paths, manifests, and optional UI suggestions.
- Added safe incremental export with `投影清单.json` and content hashes.
- Added generated project pages: project home, review dashboard, shot index, production board, and agent handoff.
- Added generated `镜头/<shotId>.md` immersive single-shot review pages.
- Added JSON Canvas maps for workflow, shot pipeline, review route, and per-shot review.
- Added Obsidian Bases for workflow files, shot progress, production readiness, review queue, and modified generated files.
- Added optional `--include-obsidian-ui` suggestions for Bookmarks, Workspace, core plugins, and appearance.
- Added `pnpm example:obsidian:ui` for release QA of the optional opening experience.

## Public Commands

```bash
pnpm build
pnpm example:obsidian
pnpm example:obsidian:ui
```

Direct CLI use:

```bash
node apps/cli/dist/index.js export-obsidian --project examples/官方示例-云上早市 --out .tmp/官方示例-云上早市-obsidian --force
node apps/cli/dist/index.js verify-obsidian --project examples/官方示例-云上早市 --vault .tmp/官方示例-云上早市-obsidian
```

Optional UI suggestions:

```bash
node apps/cli/dist/index.js export-obsidian --project examples/官方示例-云上早市 --out .tmp/官方示例-云上早市-obsidian-ui --force --include-obsidian-ui
```

## Source-of-Truth Boundary

The source of truth remains the project Step 1 to Step 6 Markdown files and the `official-ai-video` pack.

- Edit Step 3 for storyboard and narrative-frame changes.
- Edit Step 4 for image prompt and visual consistency changes.
- Edit Step 5 for video prompt, motion, and camera behavior changes.
- Use Obsidian generated files for reading, locating context, Canvas/Bases navigation, and copying agent handoff prompts.
- Keep durable personal review notes under `笔记/`.

Generated `流程/`, `镜头/`, `画布/`, `数据表/`, and dashboard files are projection output. Do not treat them as source Step files.

## Known Non-Goals

- No Obsidian plugin.
- No default `.obsidian/` writes.
- No reverse sync from Obsidian back into source Step files.
- No automatic agent execution from Obsidian.
- No Dataview, Tasks, Kanban, or Excalidraw dependency.
- No LibTV execution projection in v0.3.
- No direct image or video generation platform calls.

## Verification

Run these commands serially:

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

The absolute-link scan should only report documented intentional fixtures.
