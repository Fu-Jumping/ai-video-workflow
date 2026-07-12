# Obsidian Vault Projection

The Obsidian vault projection is a reading, creation, and review surface for `ai-video-workflow`. It is not a new workflow source.

## Role

The source of truth remains `packs/official-ai-video/` and the project Step 1 to Step 6 Markdown files. The Obsidian adapter only projects those files into a vault structure that is easier to browse, connect, review, and visualize in Obsidian.

## Recommended In-Project View Layer

The recommended production layout is:

```text
project/
├─ 01_concept/ ... 06_execution_plan/
└─ _views/
   └─ obsidian/
      ├─ Workflow/
      ├─ Shots/
      ├─ Bases/
      ├─ Canvas/
      ├─ Notes/
      └─ Projection Manifest.json
```

`project/` remains the AI agent working directory and source root. `_views/obsidian/` is the Obsidian vault root. `Workflow/` inside that vault is generated Markdown for reading and linking back to Step files. Users should open `_views/obsidian/` in Obsidian, not `project/`.

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
- Project home, review dashboard, shot index, and production board
- Project-level `04_Agent_Handoff.md` page for copying source context into agent conversations
- Immersive `Shots/<shotId>.md` single-shot review pages
- Bases `.base` files with Review Queue, Shot Progress, Execution Readiness, and Modified Generated Files views
- Canvas `.canvas` files for Workflow Map, Shot Pipeline, Review Map, and per-shot `Canvas/Shot Reviews/<shotId>.canvas` review canvases
- `Projection Manifest.json`
- `Notes/` user-note entry point
- Optional community plugin recipes

## Sync Direction

v0.3 only supports one-way generation from project files into an Obsidian vault projection. Generated files must record their source paths so users can return to the source files for edits. Do not modify source contracts inside the Obsidian projection, and do not treat projected files as replacements for Step files.

Starting in v0.3.1, `export-obsidian` is a safe incremental export by default. When exporting to the same vault again, the CLI reads `Projection Manifest.json` and updates only generated files that have not been edited by the user. User-created notes are not in the manifest and are preserved; user-edited generated files are skipped and reported as `skipped-user-modified`.

Use `--force` to clear and rebuild the output directory. Use `--dry-run` to print planned operations without writing files.

Starting in v0.3.2, the generated project home is a review command center. It links to review queues, shot progress, execution readiness, Graph/Canvas routes, Bases, and the user note area. The Review Map canvas is a spatial route through Project Home, Review Dashboard, Shot Index, Production Board, Bases, Notes, Workflow Map, and Shot Pipeline.

Starting in v0.3.3, each generated `Shots/<shotId>.md` page is an immersive single-shot review hub. It links and embeds the storyboard, Step 4 image prompt, Step 5 video prompt, execution readiness, user review note target, and per-shot `Canvas/Shot Reviews/<shotId>.canvas`. The shot page is still generated projection content; durable human comments belong under `Notes/`.

Starting in v0.3.4, `04_Agent_Handoff.md` and each shot page include copy-ready agent context. Users can inspect the project in Obsidian, then ask an agent to modify source Step files in chat. The generated handoff text tells agents to edit Step files only and never treat Obsidian projection files as the workflow source.

Starting in v0.3.5, the generated Project Home includes an `Open Vault Workflow` path for first-time vault use. Optional `--include-obsidian-ui` suggestions bookmark Project Home, Agent Handoff, Shot Index, Review Map, Shot Pipeline, and Notes, and open Project Home next to Agent Handoff in the suggested workspace.

Starting in v0.3.6, release hardening treats real-vault QA as an explicit gate. `verify-obsidian` validates optional suggested UI JSON when present, including required Bookmarks and Workspace routes. `pnpm example:obsidian:ui` exports the official sample with `--include-obsidian-ui` and verifies the generated vault. Opening the vault in Obsidian remains a human QA step, not an automated CLI action.

Starting in v0.7, `--in-project-view` is the recommended command path. The exporter writes schema version 2 manifests without local absolute project paths, records source content hashes for generated workflow notes, and `verify-obsidian` reports `obsidian-view-stale` when Step sources changed after export. `--force` refuses to delete an output vault that contains `.git`.

By default, export does not write `.obsidian/`. Use `--include-obsidian-ui` only when you want optional suggested Bookmarks, Workspace, core plugin, and appearance JSON files. Existing user `.obsidian` files are not overwritten; the exporter reports `skipped-user-config-existing` and writes suggested copies under `.obsidian/ai-video-workflow-suggested/`.

## User Notes

`Notes/` is the user-authored space inside Obsidian. Use it for review notes, meeting notes, research, and temporary ideas. Incremental export does not overwrite new files created under `Notes/`. Source Step files remain the workflow source of truth, and Obsidian notes are supporting material.

## Obsidian Features Used

- Properties: record `source_path`, `source_kind`, `step`, `shot_id`, `shot_order`, `stage_group`, `review_status`, `execution_status`, `needs_attention`, and `status`.
- Tags: use nested tags for steps, file types, shots, and status.
- Markdown internal links: connect generated vault pages with vault-relative links.
- Graph: show workflow relationships derived from internal links.
- Search query blocks: surface review items in dashboards.
- Bases: `.base` files browse Review Queue, Shot Progress, Execution Readiness, Modified Generated Files, shots, files, and production status as tables and cards.
- Canvas: `.canvas` JSON files show Step 1 to Step 6 relationships, shot pipelines, the project-level review route, each single-shot review route, and the agent handoff entry.
- Optional Bookmarks and Workspace: `.obsidian` suggestions are opt-in UI state only.

## Vault QA Checklist

- Build the CLI with `pnpm build`.
- Export and verify the default official sample with `pnpm example:obsidian`.
- Export and verify the optional UI sample with `pnpm example:obsidian:ui`.
- Export and verify the in-project sample with `pnpm example:obsidian:in-project`.
- Open `examples/official-mini-film/_views/obsidian/` manually when doing release QA, not `examples/official-mini-film/`.
- Confirm Project Home, Agent Handoff, Shot Index, Review Map, Shot Pipeline, and Notes are easy to reach.
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
- Single-shot review pages and per-shot review canvases exist and use relative vault paths.
- Agent Handoff page and shot-level Agent Handoff sections exist.
- Optional `.obsidian/ai-video-workflow-suggested/*.json` files parse when present and include the required opening routes.
- Every projected file remains traceable to a source project path.
- `Projection Manifest.json` exists, parses, records hashes that match generated files, contains no local absolute paths, and can diagnose stale views through source hashes.
- Step 3 to Step 4 frame alignment and Step 4 fixed contracts remain intact.
