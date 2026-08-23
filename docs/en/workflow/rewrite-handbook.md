# Source-Layer Rewrite Handbook

"Full rewrite" means overturning the existing direction (structural anchors, character lineup, shot-group division, etc.) and redoing the work from Step 1. This handbook explains what the tooling provides and what must be done manually.

> Tooling boundary: `clean-view` / `rebuild-view` only manage the Obsidian view-layer projection. They **do not clean or back up source Step files**. Old versions of the source layer can only be recovered through git.

## 1. Before the rewrite

1. **Tag/backup**: `git tag scene-<n>-complete` or simply commit, so the old version can be rolled back.
2. **Define the rewrite scope**: which parts are "structural redo" (anchors, sequences, group division, numbering, anti-confusion criteria) and which are "reusable migrations" (standalone shot content, character details, keyframe copy).
3. **Record the decision**: write down "why it was overturned and what the new direction is" in the Step 0 creative brief or the project README changelog.

## 2. Rewrite execution order

1. **Step 1 story core**: rewrite structural anchors, asset lists, and the visual engineering baseline — this is the master switch for everything downstream.
2. **Step 2 world settings**: rebuild character/scene sections per the new sequence (keep reusable details, renumber).
3. **Step 3 storyboard**: restructure shot-group directories (delete old groups, create new ones), renumber shots, rewrite group notes and affected shot cards.
4. **Step 4/5**: delete/reorder the corresponding keyframe and video prompt files, regenerate per the new numbering.
5. **Step 6 execution plan**: regenerate.
6. **Step 0** (if enabled): add the rewrite decision to the research files; handle new source cards as needed.

## 3. Obsidian view layer

- `clean-view --dry-run` previews the projection files to be cleaned; `clean-view` only deletes generated files and preserves user notes (`04_个人笔记/`).
- **Incremental export does not delete old-numbered projections**: after renumbering, projections with old numbers stay in the vault as `orphaned`; run `clean-view` (or `rebuild-view`) before exporting again.
- `rebuild-view` rebuilds in four steps: sync → clean → export → verify-obsidian. If the project contains multiple research source cards, an old bug used to fail here on projection-name collisions (fixed; if it fails again, run `export-obsidian` + `verify-obsidian` first to isolate).
- A rewrite does not touch the `.codex/` runtime mirror (unless the pack itself changed); `rebuild-view` re-syncs the IDE runtime automatically first.

## 4. Acceptance after the rewrite

1. Full `verify` passes (Step 0~6 contracts; Step 7 when enabled).
2. `export-obsidian` + `verify-obsidian` pass, with no old-numbered leftovers in the view layer.
3. Re-check the semantic criteria (motif framing, color discipline, anti-confusion criteria) using the [impact analysis handbook](./impact-analysis.md).
4. Commit the new state and update the changelog.
