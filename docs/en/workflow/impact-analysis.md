# Impact Analysis Handbook

When content in an already-completed step is modified, an impact analysis is required by default, and the findings must be reported back to the conversation first (see `packs/official-ai-video/workflow/quality-gates.md` §1 global gates). This handbook turns "impact analysis" into an executable process.

> Current state: structural impact (@-asset inheritance, cross-step links, unique shot numbering, shot-segment continuity) is checked automatically by `verify`. Semantic impact (character selection, color discipline, action fingerprints, gaze direction, duration consistency, motif framing) has no machine check — the process below is executed by humans/agents.

> CLI helper: `ai-video-workflow impact <keyword> --project <path>` performs text matching and same-shot downstream hints to quickly locate candidate files. Semantic impact (character selection, color discipline, action fingerprints, gaze direction, duration consistency, motif framing) still requires the manual pass in this handbook. `impact --image <node>` traces a LibTV image node back to affected Step 4/5 files.

## 1. Inheritance chain

Content is inherited along a fixed chain, and analysis walks the same chain:

```text
Step 0 research (SRC source cards) → Step 1 story core → Step 2 character/scene settings → Step 3 storyboard
→ Step 4 image prompts → Step 5 video prompts → Step 6 execution plan
```

- The Step 1 asset list (characters/scenes/structural anchors/color discipline/anti-confusion criteria) is the "master switch" for everything downstream.
- Step 2's `@character-name-tri-view` / `@scene-name-scene-image` are the inheritance tokens for Step 3 → 4 → 5.
- The Step 4 keyframes linked by a Step 3 shot card are "selected downstream facts" that Step 5 must keep consuming.

## 2. Analysis steps

1. **Locate the change surface**: `grep -rln "<keyword>" <project>` to find all matching files (e.g. search the person's name + scene name when swapping a character).
2. **Filter false hits along the chain**: a keyword may hit many unrelated files (e.g. "15 seconds" hits every shot file); filter manually by "which step the file belongs to + whether it is on that shot's inheritance chain".
3. **Propagate layer by layer**:
   - Change Step 1 (character/scene/structural anchor) → check the corresponding Step 2 sections, affected Step 3 shots, the Step 4/5 files, and Step 6 execution rows.
   - Change Step 2 (character/scene settings) → check Step 3 shot cards and their reference-asset requirements, and the @-references and written facts in Step 4/5.
   - Change Step 3 (storyboard) → check Step 4 key moments/composition and Step 5 segment count and duration split.
   - Change Step 4 (keyframe) → check Step 5 inherited facts and negative constraints.
   - Change Step 5 (video prompt) → check Step 6 execution rows.
4. **Check semantic criteria** (what `verify` does not check):
   - whether color discipline (e.g. "the only warm highlight in the whole film") is broken by the change;
   - whether action/posture fingerprints (anti-isomorphism) conflict with the new content;
   - gaze direction and secondary gaze declarations (Step 2 scene settings ↔ Step 3 storyboard ↔ Step 5 prompts);
   - consistency of numeric values (duration/aspect) across Step 3/4/5/6, and drift between the Step 0 research baseline (e.g. "15 seconds per shot") and final delivery specs;
   - whether motif or structural-anchor wording stays in sync between Step 1 and the shot-group notes.
5. **Verify and project**: after editing, run the full `verify`; if an Obsidian view layer exists, re-run `export-obsidian` (incremental mode updates only affected projections), then `verify-obsidian`.

## 3. Common scenario quick reference

| Scenario | Typical impact surface |
| --- | --- |
| Swap a selected character | Step 0 source cards (add/archive), Step 1 asset list and candidate pool, Step 2 character/scene settings, Step 3 affected shots and group notes, the Step 4/5 files, both Step 6 execution plans |
| Change a shot's duration | Step 3 shot card, Step 4 key moment, Step 5 metadata and per-segment duration split, Step 6 execution plan |
| Change color discipline | Step 1 visual engineering baseline, Step 2 scene light/color sections, affected Step 4/5 files |
| Change a scene setting | Step 2 scene section, Step 3 shots referencing that scene, spatial facts and negative constraints in Step 4/5 |
