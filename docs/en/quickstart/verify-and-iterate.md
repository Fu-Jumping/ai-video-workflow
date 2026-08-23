# Verify, Review, and Iterate

This page explains how to use `verify` in a "pass each step before moving on" daily rhythm, and what to watch for when editing mid-project, editing after completion, or rewriting wholesale.

## Step-by-step verification (--step)

`verify` checks the whole project by default. To confirm only "the steps completed so far" (skipping checks that depend on later outputs), add `--step`:

```powershell
ai-video-workflow verify --project <project-path> --ide <ide> --step 3
```

- `--step N` means "the project is currently only at step N": it verifies the contracts of Step 0~N and skips checks that need artifacts from Step N+1 onward.
- **Expected intermediate state for Step 3**: a Step 3 shot card must link to existing Step 4 keyframe files, so right after Step 3 is done — before Step 4 exists — the full `verify` reports `invalid-keyframe-mapping` / `broken-step3-step4-link`. That is an expected intermediate state, not an error: verify with `--step 3`; the full check clears automatically once Step 4 files exist.
- The full check without `--step` is unchanged; always run the full check before final delivery.

## Content review expectations (important)

The machine checks in `verify` cover **structural contracts** (section existence, cross-step links, reference-asset inheritance, numbering and shot-segment continuity) plus a few rule-based content checks (Step 4 duplicate `避免:` prefixes, quick-read meta-language words, the Step 5 per-shot negative-constraint baseline).

**`verify` passing ≠ content meeting the bar.** Quality gates such as psychological wording, director explanations, context dependence, lazy inheritance, or a shrunken copyable prompt (see `packs/official-ai-video/workflow/quality-gates.md` §4.5) are currently reviewed by humans/agents. Recommended rhythm:

1. Finish a step → run the matching `--step` check;
2. Give content-level improvement feedback from a reviewer's perspective (character differentiation, structural anchors, aesthetic execution, shot language, prompt quality);
3. Edit → re-verify → only move on after it passes.

## What init seeds

`init` seeds: the five Step 0 research files (research mode), `01_概念策划/故事内核.md`, `02_世界设定/角色设定.md` and `场景设定.md`, `03_分镜脚本/镜头组-001/00_镜头组说明.md`, `04_图片提示词/镜头组-001/图片提示词.md` and `05_视频提示词/镜头组-001/视频提示词.md` (the latter two are "copy-and-comply" template references — a fresh project passes `verify` out of the box), and the three Step 6 execution plans.

- Step 2 character/scene settings are **filled in place**: each character/scene must be its own `## <name>` section declaring `主角色：是` + `@<name>三视图` (same for scenes), with the name matching the title exactly.
- The Step 4/5 template files are reference copies; for formal delivery, copy them per shot as `镜头-NNN-关键帧-NN.md` / `镜头-NNN.md`.

## Impact surface when editing

The tooling currently offers two kinds of support for "an upstream change's downstream impact": structural contract checks (`verify` catches broken @-asset inheritance, broken cross-step links, numbering conflicts) and incremental Obsidian export (only affected projections update; `updated/unchanged/orphaned` at a glance). The **semantic layer** (character selection, color discipline, action fingerprints, gaze direction, duration-value consistency) has no machine check — walk the [impact analysis handbook](../workflow/impact-analysis.md) manually.

For wholesale rewrites, read the [source-layer rewrite handbook](../workflow/rewrite-handbook.md).

If certain shots/projects genuinely should not follow the standard flow, register the deviation explicitly via [supported deviations: deviations.yaml](../workflow/supported-deviations.md) instead of silently skipping or hand-bypassing checks.
