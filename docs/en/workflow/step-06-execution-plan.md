# Step 6: Execution Plan

Step 6 uses:

- `00_execution_plan.md`
- `01_image_execution_plan.md`
- `02_video_execution_plan.md`

## Referencing files from other steps

- Prefer backtick relative path text, e.g. `` `../04_图片提示词/镜头组-001/镜头-001-关键帧-01.md` ``, which stays outside Markdown link resolution.
- If you use Markdown links, the target must resolve relative to the **referencing file's own directory** (e.g. `06_执行计划/00_执行计划.md` referencing Step 4 must use `../04_图片提示词/...`); `verify` checks whether relative link targets exist (`broken-relative-link`). Note the Obsidian view layer re-resolves links using vault paths, so a link valid in the source layer can still break in the projection; prefer backtick paths for cross-step references.
