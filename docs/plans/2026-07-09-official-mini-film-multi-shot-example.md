# Official Mini Film Multi-Shot Example Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Expand `examples/official-mini-film` from a one-shot demo into a compact three-shot project that better demonstrates Step 3 to Step 6 traceability, Obsidian projection value, and production-status browsing.

**Architecture:** Keep the example as plain Markdown under the existing Step 1 to Step 6 folders. Add two additional storyboard/image/video prompt pairs, update Step 6 execution tables, and keep all links relative. Do not add generated media, platform execution, Obsidian-only files, or a second source format.

**Tech Stack:** Markdown, existing official example folder structure, TypeScript CLI verification, Vitest, Obsidian export/verify commands.

---

## Scope

This plan expands only the committed public example project at `examples/official-mini-film`.

It should demonstrate:

- a small three-shot narrative sequence
- one character and one main location with a subtle progression through space
- Step 3 storyboard cards for each shot
- Step 4 image prompt files for each shot
- Step 5 video prompt files for each shot
- Step 6 execution tables that reference every shot, image prompt, and video prompt
- Obsidian export output with multiple shot hubs, Base rows, Canvas nodes, and Graph/Backlink relationships

It deliberately does not add:

- generated image or video assets
- direct generation-platform execution
- LibTV execution projection
- MCP runtime
- new source directories
- non-relative links
- Obsidian `.obsidian/` local state

## Story Shape

Keep the current premise: a lone night courier carries a sealed data card along a wet riverside walkway.

Expand it to three shots:

1. **Shot 001:** The courier enters the empty riverside walkway with the data card visible.
2. **Shot 002:** The courier pauses under a flickering streetlight beside the railing and checks the sealed card.
3. **Shot 003:** The courier approaches a small service door beneath the riverside overpass before sunrise glow reaches the horizon.

Each shot should remain visually self-contained. Step 4 prompts must not depend on "previous shot" wording.

## Task 1: Add Multi-Shot Test Coverage

**Files:**

- Modify: `apps/cli/tests/example-verify.test.ts`
- Read: `apps/cli/tests/obsidian-example.test.ts`

**Step 1: Extend official example test**

Add assertions after the existing verification result check:

```ts
const shotFiles = ["shot-001.md", "shot-002.md", "shot-003.md"];
for (const file of shotFiles) {
  const storyboard = await fs.readFile(path.join(projectRoot, "03_storyboard", file), "utf8");
  expect(storyboard).toContain("../04_image_prompts/");
  expect(storyboard).toContain("../05_video_prompts/");
}

for (const file of ["shot-001-keyframe.md", "shot-002-keyframe.md", "shot-003-keyframe.md"]) {
  const prompt = await fs.readFile(path.join(projectRoot, "04_image_prompts", file), "utf8");
  expect(prompt).toContain("快速导读");
  expect(prompt).toContain("中文完整版本");
  expect(prompt).toContain("English Version (Copy Ready)");
  expect(prompt).toContain("避免:");
  expect(prompt).toContain("Avoid:");
}
```

Add `fs` import from `fs-extra`.

**Step 2: Run failing test**

Run:

```powershell
pnpm --filter ai-video-workflow test -- example-verify.test.ts
```

Expected: FAIL because Shot 002 and Shot 003 files do not exist yet.

## Task 2: Update Step 1 and Step 2 Baselines

**Files:**

- Modify: `examples/official-mini-film/README.md`
- Modify: `examples/official-mini-film/01_concept/story-kernel.md`
- Modify: `examples/official-mini-film/02_setting/character-profile.md`
- Modify: `examples/official-mini-film/02_setting/scene-profile.md`

**Step 1: Update README scope**

Change the README from "smallest one-shot demo" to "compact three-shot demo".

Required README bullets:

- three Step 3 storyboard cards
- three Step 4 image prompt files
- three Step 5 video prompt files
- Step 6 execution mapping for every shot
- Obsidian vault projection coverage

**Step 2: Update story kernel**

Change the format from one-shot to three-shot mini film demo. Update constraints:

- Use one character.
- Use one primary location with three connected positions.
- Keep the demo to three storyboard shots.
- Do not depend on generated media files.

**Step 3: Update character and scene details**

Add stable details needed across all shots:

- courier keeps the hood up
- sealed card remains small, pale, and rectangular
- service door under overpass appears in final shot
- walkway has railing, wet pavement, flickering streetlight, and overpass endpoint

## Task 3: Add Step 3 Storyboard Cards

**Files:**

- Modify: `examples/official-mini-film/03_storyboard/shot-001.md`
- Create: `examples/official-mini-film/03_storyboard/shot-002.md`
- Create: `examples/official-mini-film/03_storyboard/shot-003.md`

**Step 1: Keep Shot 001 and add sequence context**

Preserve the current visual description, but make it clear Shot 001 is the entrance beat.

**Step 2: Add Shot 002**

Shot 002 must show:

- courier stopped under a flickering streetlight
- right hand holding sealed data card near chest
- low railing and dark river still visible
- wet pavement and small reflected light
- links to `../04_image_prompts/shot-002-keyframe.md` and `../05_video_prompts/shot-002.md`

**Step 3: Add Shot 003**

Shot 003 must show:

- courier near a service door under an overpass
- sealed data card lifted toward the door reader
- first faint pre-sunrise glow on the horizon
- damp concrete, metal door, and river edge still readable
- links to `../04_image_prompts/shot-003-keyframe.md` and `../05_video_prompts/shot-003.md`

## Task 4: Add Step 4 Image Prompts

**Files:**

- Modify: `examples/official-mini-film/04_image_prompts/shot-001-keyframe.md`
- Create: `examples/official-mini-film/04_image_prompts/shot-002-keyframe.md`
- Create: `examples/official-mini-film/04_image_prompts/shot-003-keyframe.md`

**Rules:**

- Every file must include `快速导读`, `中文完整版本`, `English Version (Copy Ready)`, `避免:`, and `Avoid:`.
- Prompts must be self-contained and not use "same as previous", "继续", "参考前文", or equivalent inherited wording.
- Each prompt must describe one stable keyframe only.
- Use visual facts: subject, pose, prop, foreground, midground, background, lighting, material, and exclusions.

**Step 1: Lightly update Shot 001 prompt**

Keep content stable, but avoid implying it is the only shot.

**Step 2: Write Shot 002 prompt**

Make the flickering streetlight, pause, card check, railing, and reflections clear.

**Step 3: Write Shot 003 prompt**

Make the service door, card near reader, overpass, damp concrete, and pre-sunrise edge light clear.

## Task 5: Add Step 5 Video Prompts

**Files:**

- Modify: `examples/official-mini-film/05_video_prompts/shot-001.md`
- Create: `examples/official-mini-film/05_video_prompts/shot-002.md`
- Create: `examples/official-mini-film/05_video_prompts/shot-003.md`

**Rules:**

- Each prompt describes one continuous video segment.
- Motion must match the corresponding Step 4 keyframe.
- Do not introduce new characters or locations.
- Do not rely on generated media assets.

## Task 6: Update Step 6 Execution Tables

**Files:**

- Modify: `examples/official-mini-film/06_execution_plan/00_execution_plan.md`
- Modify: `examples/official-mini-film/06_execution_plan/01_image_execution_plan.md`
- Modify: `examples/official-mini-film/06_execution_plan/02_video_execution_plan.md`

**Step 1: Update execution scope**

State that the demo contains three shots and three keyframes.

**Step 2: Add all shots to master table**

The master table must include Shot 001, Shot 002, and Shot 003, each linking to Step 3, Step 4, and Step 5.

**Step 3: Add all keyframes to image plan**

The image table must include all three keyframe prompt files.

**Step 4: Add all videos to video plan**

The video table must include all three video prompt files and image input notes.

## Task 7: Verify Multi-Shot Example and Obsidian Projection

**Files:**

- No source edits unless tests reveal defects

**Step 1: Run targeted example test**

Run:

```powershell
pnpm --filter ai-video-workflow test -- example-verify.test.ts obsidian-example.test.ts obsidian-export.test.ts
```

Expected: PASS.

**Step 2: Build docs and CLI**

Run:

```powershell
pnpm build
```

Expected: PASS.

**Step 3: Verify official example**

Run:

```powershell
pnpm example:verify
```

Expected: `Verification passed`.

**Step 4: Verify Obsidian export**

Run:

```powershell
pnpm example:obsidian
```

Expected: `Obsidian projection verification passed`.

**Step 5: Run v0.2 regression gate**

Run:

```powershell
pnpm verify:v0.2
```

Expected: PASS.

## Acceptance Checklist

- [ ] Plan document exists for the multi-shot example expansion.
- [ ] Official example README describes three shots.
- [ ] Story kernel says this is a three-shot demo.
- [ ] Step 3 contains `shot-001.md`, `shot-002.md`, and `shot-003.md`.
- [ ] Each Step 3 file links to its Step 4 image prompt and Step 5 video prompt.
- [ ] Step 4 contains `shot-001-keyframe.md`, `shot-002-keyframe.md`, and `shot-003-keyframe.md`.
- [ ] Each Step 4 file satisfies the fixed section contract.
- [ ] Step 5 contains `shot-001.md`, `shot-002.md`, and `shot-003.md`.
- [ ] Step 6 master, image, and video execution tables include all three shots.
- [ ] `pnpm example:verify` passes.
- [ ] `pnpm example:obsidian` passes and exports multiple shot nodes.
- [ ] `pnpm verify:v0.2` passes.
- [ ] All new links are relative.

## Suggested Commit Slice

```powershell
git add examples/official-mini-film apps/cli/tests/example-verify.test.ts docs/plans/2026-07-09-official-mini-film-multi-shot-example.md
git commit -m "docs: 扩展官方多镜头示例计划" -m "- 将官方示例扩展为三镜头演示" -m "- 补充 Step 3 到 Step 6 的多镜头追踪" -m "- 增加示例校验覆盖"
```
