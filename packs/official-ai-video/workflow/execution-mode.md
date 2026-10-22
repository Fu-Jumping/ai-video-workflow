# Execution Mode

- Step 6 is an execution plan system, not a loose checklist.
- `00_execution_plan.md` is the human control surface.
- `01_image_execution_plan.md` and `02_video_execution_plan.md` are execution tables for image and video work.
- All links in execution files must use relative paths.
- Execution state lives in the project `素材记录/` records: platform status, download status, review status and selection are four separate fields, never merged into one "done".
- A platform-completed item is not an accepted item. Only a human writes review status and selection.
- Failures are classified before any retry: remote status unknown (query the original task first), remote failure (re-authorize before resubmitting), and generated-but-not-saved (re-download only, never regenerate).
- Retries keep the original version and candidate numbers; a failed round is never recycled and an existing file is never overwritten.
