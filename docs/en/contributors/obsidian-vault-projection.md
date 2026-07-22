# Obsidian Vault Projection

The Obsidian vault projection is a reading, creation, and review surface for `ai-video-workflow`. It is not a new workflow source.

## Role

The source of truth remains `packs/official-ai-video/` and the project Step 1 to Step 6 Markdown files. The Obsidian adapter only projects those files into a vault structure that is easier to browse, connect, review, and visualize in Obsidian.

## Recommended In-Project View Layer

The recommended production layout is:

```text
project/
├─ 01_概念策划/ ... 06_执行计划/
└─ _views/
   └─ obsidian/
      ├─ 流程/
      ├─ 镜头/
      ├─ 数据表/
      ├─ 画布/
      ├─ 笔记/
      └─ 投影清单.json
```

`project/` remains the AI agent working directory and source root. `_views/obsidian/` is the Obsidian vault root. `流程/` inside that vault is generated Markdown for reading and linking back to Step files. Users should open `_views/obsidian/` in Obsidian, not `project/`.

Run:

```powershell
ai-video-workflow export-obsidian --project <path> --in-project-view
ai-video-workflow verify-obsidian --project <path> --in-project-view
```

External vault mode remains supported with `--out <vault-path>` and `--vault <vault-path>`.

## Inputs

- Project root
- `project.config.yaml`
- Step 1 to Step 6 Markdown files
- Templates, quality gates, and file contracts from `official-ai-video`

## Outputs

- Generated Obsidian vault directory, recommended at `_views/obsidian/`
- Projected Markdown files with properties and tags
- Project home, review dashboard, shot index, and production board with numbered sections
- Project-level `04_智能体交接.md` page that centralizes source paths, edit boundaries, and copy-ready agent prompts
- Immersive `镜头/<shotId>.md` single-shot review pages
- Bases `.base` files with Review Queue, Shot Progress, Execution Readiness, and Modified Generated Files views
- Canvas `.canvas` files for the workflow map, shot pipeline, review map, and per-shot `画布/镜头审阅/<shotId>.canvas` review canvases
- `投影清单.json`
- `笔记/` user-note entry point
- Optional community plugin recipes

## Sync Direction

v0.3 only supports one-way generation from project files into an Obsidian vault projection. Generated files must record their source paths so users can return to the source files for edits. Do not modify source contracts inside the Obsidian projection, and do not treat projected files as replacements for Step files.

Starting in v0.3.1, `export-obsidian` is a safe incremental export by default. When exporting to the same vault again, the CLI reads `投影清单.json` and updates only generated files that have not been edited by the user. User-created notes are not in the manifest and are preserved; user-edited generated files are skipped and reported as `skipped-user-modified`.

Use `--force` to clear and rebuild the output directory. Use `--dry-run` to print planned operations without writing files.

Starting in v0.3.2, the generated project home is a review command center. It links to review queues, shot progress, execution readiness, Graph/Canvas routes, Bases, and the user note area. The review map canvas is a spatial route through the project home, review dashboard, shot index, production board, Bases, notes, workflow map, and shot pipeline.

Starting in v0.3.3, each generated `镜头/<shotId>.md` page is an immersive single-shot review hub. It links and embeds the storyboard, Step 4 image prompt, Step 5 video prompt, execution checks, user review note target, and per-shot `画布/镜头审阅/<shotId>.canvas`. Shot pages keep only a short edit entry, and durable human comments belong under `笔记/`.

Starting in v0.3.4, `04_智能体交接.md` centralizes copy-ready agent context, per-shot source paths, edit boundaries, and verification commands. Users can inspect the project in Obsidian, then open the handoff page and copy the relevant context to an agent. Shot review pages no longer expand the full agent prompt, keeping agent-facing text out of the main creator review flow.

Starting in v0.3.5, the generated project home includes a viewing route for first-time vault use. Optional `--include-obsidian-ui` suggestions bookmark the project home, agent handoff, shot index, review map, shot pipeline, and notes, and open the project home next to the review dashboard in the suggested workspace.

Starting in v0.3.6, release hardening treats real-vault QA as an explicit gate. `verify-obsidian` validates optional suggested UI JSON when present, including required Bookmarks and Workspace routes. `pnpm example:obsidian:ui` exports the official sample with `--include-obsidian-ui` and verifies the generated vault. Opening the vault in Obsidian remains a human QA step, not an automated CLI action.

Generated view-layer control pages, single-shot pages, agent handoff pages, and templates now use explicit numbered headings, such as `## 1. 打开路线`, `## 5. 视频提示词`, and `### 4.1 单镜头检查`. The numbering supports Obsidian outlines, scanning, and handoff anchors. Projected Step-file bodies under `流程/` still preserve source Markdown headings and are not automatically renumbered.

Projected pages under `流程/` rewrite source-relative links that can be mapped to project Step Markdown files into vault-internal links. For example, `../04_图片提示词/镜头-002-关键帧.md` from Step 3 points to the real projected file under `流程/步骤四 - 图片提示词/...`, so Obsidian does not try to create a missing path when users click it. Obsidian wiki links that target Markdown notes use native targets without the `.md` suffix; Canvas and Base links still keep their `.canvas` / `.base` extensions.

`verify-obsidian` also checks these navigation surfaces: Markdown and wiki links must resolve to existing vault files; `#` anchors on Markdown links must land on a real heading; `#` anchors on Base embeds must land on a real view; Canvas file nodes and edge endpoints must resolve; optional `.obsidian` UI suggestions must point at real vault files.

Starting in v0.7, `--in-project-view` is the recommended command path. The exporter writes schema version 2 manifests without local absolute project paths, records source content hashes for generated workflow notes, and `verify-obsidian` reports `obsidian-view-stale` when Step sources changed after export. `--force` refuses to delete an output vault that contains `.git`.

By default, export does not write `.obsidian/`. Use `--include-obsidian-ui` only when you want optional suggested Bookmarks, Workspace, core plugin, and appearance JSON files. Existing user `.obsidian` files are not overwritten; the exporter reports `skipped-user-config-existing` and writes suggested copies under `.obsidian/ai-video-workflow-suggested/`.

## User Notes

`笔记/` is the user-authored space inside Obsidian. Use it for review notes, meeting notes, research, and temporary ideas. Incremental export does not overwrite new files created under `笔记/`. Source Step files remain the workflow source of truth, and Obsidian notes are supporting material.

## Obsidian Features Used

- Properties: newly generated notes use Chinese property names such as `标题`, `镜头标题`, `下一步`, `投影生成`, `源文件路径`, `源文件类型`, `步骤`, `镜头ID`, `镜头顺序`, `阶段`, `审阅状态`, `执行状态`, `需要关注`, and `状态`. Default tables now show only the user-approved columns: `标题`, `镜头标题`, `源文件路径`, `源文件类型`, `步骤名称`, `审阅状态`, `执行状态`, `镜头索引`, `审阅画布`, `审阅笔记`, and `最近修改时间` backed by `file.mtime`. Properties such as `下一步`, `镜头ID`, and `投影生成` remain available for filtering, routing, handoff, and diagnostics, but they are no longer part of the default visible columns. `tags`, `ai-video/...` tags, `shot-001` machine IDs, and the `投影清单.json` schema remain machine-readable.
- Tags: use nested tags for steps, file types, shots, and status.
- Markdown internal links: connect generated vault pages with vault-relative links.
- Graph: show workflow relationships derived from internal links.
- Search query blocks: can surface review items when needed; default review pages prioritize Bases and Canvas to avoid exposing technical query text.
- Bases: `.base` files browse review queues, shot progress, execution readiness, modified generated files, shots, files, and production status as tables and cards. Default tables emphasize human-readable fields, while diagnostic views keep source paths and generation markers.
- Canvas: `.canvas` JSON files show Step 1 to Step 6 relationships, shot pipelines, the project-level review route, each single-shot review route, and the agent handoff entry.
- Optional Bookmarks and Workspace: `.obsidian` suggestions are opt-in UI state only.

## Vault QA Checklist

- Build the CLI with `pnpm build`.
- Export and verify the default official sample with `pnpm example:obsidian`.
- Export and verify the optional UI sample with `pnpm example:obsidian:ui`.
- Export and verify the in-project sample with `pnpm example:obsidian:in-project`.
- Open `examples/官方示例-云上早市/_views/obsidian/` manually when doing release QA, not `examples/官方示例-云上早市/`.
- Confirm the project home, agent handoff, shot index, review map, shot pipeline, and notes are easy to reach.
- Confirm generated projection files are used for reading and location only; source edits still happen in Step files.
- Confirm incremental export preserves user notes and does not overwrite user-owned `.obsidian` files.

## Non-Goals

- No Obsidian plugin development.
- No default `.obsidian/` local UI state writes. Optional UI suggestions require `--include-obsidian-ui` and must not overwrite existing user config.
- No reverse sync from Obsidian back to Step files.
- No automatic agent execution from Obsidian; handoff pages only provide copy-ready context.
- No dependency on Dataview, Tasks, Kanban, or Excalidraw.
- No direct image or video generation calls.

## Verification Requirements

- Generated files use relative links only.
- Canvas files parse as JSON.
- `.base` files are valid YAML.
- Review Map, key dashboard markers, and key Bases views exist.
- Key view-layer pages keep numbered headings for Obsidian outlines and in-page navigation.
- Generated Markdown links that target vault files resolve to existing files, except intentional user-note targets.
- Generated Markdown and Base `#` anchors resolve to real headings or views.
- Single-shot review pages and per-shot review canvases exist and use relative vault paths.
- Canvas edges connect to real nodes, and optional `.obsidian` UI paths exist.
- The agent handoff page exists, and shot pages keep a short entry link to it.
- Optional `.obsidian/ai-video-workflow-suggested/*.json` files parse when present and include the required opening routes.
- Every projected file remains traceable to a source project path.
- `投影清单.json` exists, parses, records hashes that match generated files, contains no local absolute paths, and can diagnose stale views through source hashes.
- Step 3 to Step 4 frame alignment and Step 4 fixed contracts remain intact.
