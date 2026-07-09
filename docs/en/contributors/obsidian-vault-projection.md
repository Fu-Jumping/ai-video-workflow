# Obsidian Vault Projection

The Obsidian vault projection is a reading, creation, and review surface for `ai-video-workflow`. It is not a new workflow source.

## Role

The source of truth remains `packs/official-ai-video/` and the project Step 1 to Step 6 Markdown files. The Obsidian adapter only projects those files into a vault structure that is easier to browse, connect, review, and visualize in Obsidian.

## Inputs

- Project root
- `project.config.yaml`
- Step 1 to Step 6 Markdown files
- Templates, quality gates, and file contracts from `official-ai-video`

## Outputs

- Generated Obsidian vault directory
- Projected Markdown files with properties and tags
- Project home, review dashboard, shot index, and production board
- Bases `.base` files
- Canvas `.canvas` files
- Optional community plugin recipes

## Sync Direction

v0.3 only supports one-way generation from project files into an Obsidian vault projection. Generated files must record their source paths so users can return to the source files for edits. Do not modify source contracts inside the Obsidian projection, and do not treat projected files as replacements for Step files.

## Obsidian Features Used

- Properties: record `source_path`, `source_kind`, `step`, `shot_id`, and `status`.
- Tags: use nested tags for steps, file types, shots, and status.
- Backlinks / Outgoing links / Graph: show workflow relationships through real internal links.
- Search query blocks: surface review items in dashboards.
- Bases: browse shots, files, and production status as tables and cards.
- Canvas: use JSON Canvas to show Step 1 to Step 6 relationships and shot pipelines.

## Non-Goals

- No Obsidian plugin development.
- No `.obsidian/` local UI state writes.
- No reverse sync from Obsidian back to Step files.
- No dependency on Dataview, Tasks, Kanban, or Excalidraw.
- No direct image or video generation calls.

## Verification Requirements

- Generated files use relative links only.
- Canvas files parse as JSON.
- `.base` files are valid YAML.
- Every projected file remains traceable to a source project path.
- Step 3 to Step 4 frame alignment and Step 4 fixed contracts remain intact.
