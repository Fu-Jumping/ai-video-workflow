# Step 6: Execution Plan

Step 6 uses:

- `00_execution_plan.md`
- `01_image_execution_plan.md`
- `02_video_execution_plan.md`

## Referencing files from other steps

- Prefer backtick relative path text, e.g. `` `../04_图片提示词/镜头组-001/镜头-001-关键帧-01.md` ``, which stays outside Markdown link resolution.
- If you use Markdown links, the target must resolve relative to the **referencing file's own directory** (e.g. `06_执行计划/00_执行计划.md` referencing Step 4 must use `../04_图片提示词/...`); `verify` checks whether relative link targets exist (`broken-relative-link`). Note the Obsidian view layer re-resolves links using vault paths, so a link valid in the source layer can still break in the projection; prefer backtick paths for cross-step references.

## Rough-Cut Delivery (roughcut)

Rough-cut delivery is handled by the `roughcut` CLI command family. It hands the selected media to JianYing in order for further editing and never rewrites creation content:

- `roughcut plan --project <project-path>`: creates or refreshes `00_粗剪顺序表.md` in this directory from the content tree and media records; the cut-order column may be edited by hand and `--check` validates only. Confirming order and selection in the plan counts as completing the rough-cut confirmation.
- `roughcut pack --project <project-path> --out <directory>`: exports a read-only media pack — per-cut-order segment folders plus a top-level manifest (source shot/storyboard, file version, dialogue/subtitle flags, missing items, check status per item); it copies originals and never overwrites or moves project files.
- `roughcut draft --project <project-path> [--name <draft-name>]`: generates a native JianYing 11.6 draft directly (fresh ids, offline encryption, draft index backed up before registration). Safety rails: refuses to write while JianYing is running (tray process included), verifies the `videoeditor.dll` fingerprint and errors out on version mismatch, and refuses to overwrite an existing draft directory. Always open JianYing and check the generated draft manually.

Constraints: the plan table is not shared with the future desktop app's ordering; the media pack is a standalone snapshot of the moment the order was confirmed and is not rewritten when selections change later; rough-cut outputs are treated as undecided material — Step 7 (publishing) neither reads nor checks them. When JianYing upgrades and the fingerprint no longer matches, re-adapt per `apps/cli/vendor/README.md`.
