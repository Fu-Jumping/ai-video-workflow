# Verifiable Example And Check Baseline Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Make the bundled `official-mini-film` example pass project verification and improve the first-run validation path for users.

**Architecture:** Keep `official-ai-video` as the only default workflow pack. Treat `examples/official-mini-film` as a generated-but-committed smoke example, with Step 6 file contracts and Codex runtime layers synced from the pack. Extend tests and docs around existing CLI surfaces instead of adding new commands.

**Tech Stack:** TypeScript, Node.js ESM, pnpm, Vitest, fs-extra, VitePress Markdown docs.

---

## Scope

This plan is for `v0.1.1` validation hardening. It deliberately does not add platform execution automation, a pack marketplace, a structured intermediate layer for Step 4, or a new workflow source of truth.

The work must respect the repository rules:

- Use `official-ai-video` as the default workflow pack.
- Keep Step 3 and Step 4 frame-aligned.
- Keep Step 4 file contracts intact.
- Default to enhanced flow unless a project explicitly disables it.
- Use relative links only.

## Current Baseline

Fresh checks before writing this plan:

- `pnpm test` passed with 6 test files and 6 tests.
- `pnpm build` passed for CLI and VitePress docs.
- `node apps/cli/dist/index.js verify --project examples/official-mini-film --ide codex` failed because the example is missing the three required Step 6 files and the Codex runtime layers.

## Acceptance Criteria

- `examples/official-mini-film` passes `verify` for `codex`.
- There is a test that fails when the bundled example is not verifiable.
- `doctor` gives useful remediation guidance for missing Codex runtime files.
- Chinese and English quickstart pages include build, init, verify, sync, and doctor commands.
- `pnpm test` and `pnpm build` pass after the changes.

---

### Task 1: Add A Regression Test For The Bundled Example

**Files:**
- Create: `apps/cli/tests/example-verify.test.ts`
- Read: `apps/cli/src/lib/verify.ts`
- Read: `examples/official-mini-film/project.config.yaml`

**Step 1: Write the failing test**

Create `apps/cli/tests/example-verify.test.ts`:

```ts
import path from "node:path";
import { describe, expect, test } from "vitest";

import { verifyProject } from "../src/lib/verify.js";

describe("official example", () => {
  test("official-mini-film passes codex verification", async () => {
    const projectRoot = path.resolve(__dirname, "../../../examples/official-mini-film");

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result).toEqual({ ok: true, issues: [] });
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```powershell
pnpm --filter ai-video-workflow test -- example-verify.test.ts
```

Expected: FAIL. The failure should report `missing-step6-file` and `missing-ide-runtime` issues from `examples/official-mini-film`.

**Step 3: Do not change production code in this task**

This task only establishes the regression test.

**Step 4: Commit**

```powershell
git add apps/cli/tests/example-verify.test.ts
git commit -m "test: cover bundled example verification"
```

---

### Task 2: Make The Official Example Verifiable

**Files:**
- Modify: `examples/official-mini-film/06_execution_plan/00_execution_plan.md`
- Modify: `examples/official-mini-film/06_execution_plan/01_image_execution_plan.md`
- Modify: `examples/official-mini-film/06_execution_plan/02_video_execution_plan.md`
- Create: `examples/official-mini-film/.codex/README.md`
- Create: `examples/official-mini-film/.codex/agent-rules.md`
- Create: `examples/official-mini-film/.codex/repo-context.md`
- Create: `examples/official-mini-film/.codex/ai-video-workflow/**`
- Create: `examples/official-mini-film/.codex/skills/**`

**Step 1: Generate the missing runtime and Step 6 files**

Run:

```powershell
node apps/cli/dist/index.js sync --project examples/official-mini-film --ide codex
```

This creates the Codex runtime mirror and skill entrypoints from `packs/official-ai-video`.

Then copy the three Step 6 templates into the example:

```powershell
Copy-Item packs/official-ai-video/templates/06_execution_plan/00_execution_plan.md examples/official-mini-film/06_execution_plan/00_execution_plan.md
Copy-Item packs/official-ai-video/templates/06_execution_plan/01_image_execution_plan.md examples/official-mini-film/06_execution_plan/01_image_execution_plan.md
Copy-Item packs/official-ai-video/templates/06_execution_plan/02_video_execution_plan.md examples/official-mini-film/06_execution_plan/02_video_execution_plan.md
```

**Step 2: Run the focused test**

Run:

```powershell
pnpm --filter ai-video-workflow test -- example-verify.test.ts
```

Expected: PASS.

**Step 3: Verify the example through the built CLI**

Run:

```powershell
node apps/cli/dist/index.js verify --project examples/official-mini-film --ide codex
```

Expected: exit code 0 and output:

```text
Verification passed
```

**Step 4: Inspect generated files before committing**

Run:

```powershell
git status --short
```

Expected: changes are limited to the new example runtime files, Step 6 files, and the test from Task 1. If `docs/.vitepress/dist`, `docs/.vitepress/.temp`, `apps/cli/dist`, or `node_modules` appear, do not add them.

**Step 5: Commit**

```powershell
git add examples/official-mini-film apps/cli/tests/example-verify.test.ts
git commit -m "test: make official example verifiable"
```

---

### Task 3: Improve Doctor Guidance For Missing Runtime Layers

**Files:**
- Modify: `apps/cli/tests/doctor.test.ts`
- Modify: `apps/cli/src/lib/doctor.ts`

**Step 1: Write the failing test**

Extend `apps/cli/tests/doctor.test.ts` with a second test:

```ts
test("suggests sync when codex runtime layers are missing", async () => {
  const output = await diagnoseProject({
    issues: [
      {
        code: "missing-ide-runtime",
        message: "Missing Codex runtime mirror",
        path: ".codex/ai-video-workflow"
      },
      {
        code: "missing-ide-runtime",
        message: "Missing Codex runtime skills",
        path: ".codex/skills"
      }
    ]
  });

  expect(output).toContain("IDE Runtime");
  expect(output).toContain("ai-video-workflow sync --project <path> --ide codex");
  expect(output).toContain(".codex/ai-video-workflow");
  expect(output).toContain(".codex/skills");
});
```

**Step 2: Run test to verify it fails**

Run:

```powershell
pnpm --filter ai-video-workflow test -- doctor.test.ts
```

Expected: FAIL because `doctor` does not yet suggest the sync command for missing runtime layers.

**Step 3: Implement minimal doctor guidance**

In `apps/cli/src/lib/doctor.ts`, add remediation text inside the existing issue loop:

```ts
if (issue.code === "missing-ide-runtime") {
  lines.push("  Run `ai-video-workflow sync --project <path> --ide codex` to restore the IDE runtime files.");
}
```

Keep the current grouping behavior. Do not add auto-fix behavior.

**Step 4: Run focused test**

Run:

```powershell
pnpm --filter ai-video-workflow test -- doctor.test.ts
```

Expected: PASS.

**Step 5: Commit**

```powershell
git add apps/cli/tests/doctor.test.ts apps/cli/src/lib/doctor.ts
git commit -m "feat: improve missing runtime doctor guidance"
```

---

### Task 4: Document The Verifiable First-Run Path

**Files:**
- Modify: `docs/en/quickstart/index.md`
- Modify: `docs/zh/quickstart/index.md`

**Step 1: Update English quickstart**

Replace `docs/en/quickstart/index.md` with:

```md
# Quickstart

1. Run `pnpm install`.
2. Run `pnpm build`.
3. Run `node apps/cli/dist/index.js init`.
4. Choose the IDE, default image platform, and default video platform.
5. Run `node apps/cli/dist/index.js verify --project <project-path> --ide <ide>`.
6. If verification fails, run `node apps/cli/dist/index.js doctor --project <project-path> --ide <ide>`.
7. If IDE runtime files are missing, run `node apps/cli/dist/index.js sync --project <project-path> --ide <ide>`.
8. Start working from `01_concept/`.

The default pack is `official-ai-video`, and enhanced flow is enabled unless the project explicitly disables it.
```

**Step 2: Update Chinese quickstart**

Replace `docs/zh/quickstart/index.md` with:

```md
# 快速开始

1. 运行 `pnpm install`。
2. 运行 `pnpm build`。
3. 运行 `node apps/cli/dist/index.js init`。
4. 选择 IDE、默认生图平台和默认生视频平台。
5. 运行 `node apps/cli/dist/index.js verify --project <project-path> --ide <ide>`。
6. 如果校验失败，运行 `node apps/cli/dist/index.js doctor --project <project-path> --ide <ide>`。
7. 如果缺少 IDE 运行文件，运行 `node apps/cli/dist/index.js sync --project <project-path> --ide <ide>`。
8. 从 `01_concept/` 开始推进项目。

默认 pack 是 `official-ai-video`。除非项目显式关闭，否则默认启用增强流程。
```

**Step 3: Build docs**

Run:

```powershell
pnpm docs:build
```

Expected: PASS.

**Step 4: Commit**

```powershell
git add docs/en/quickstart/index.md docs/zh/quickstart/index.md
git commit -m "docs: document verifiable quickstart path"
```

---

### Task 5: Add A Root-Level Example Verification Script

**Files:**
- Modify: `package.json`
- Test: `apps/cli/tests/example-verify.test.ts`

**Step 1: Add a failing expectation manually**

Before editing `package.json`, run:

```powershell
pnpm example:verify
```

Expected: FAIL because the script does not exist.

**Step 2: Add the script**

Modify `package.json` scripts:

```json
{
  "scripts": {
    "build": "pnpm --filter ai-video-workflow build && pnpm docs:build",
    "docs:dev": "vitepress dev docs",
    "docs:build": "vitepress build docs",
    "example:verify": "node apps/cli/dist/index.js verify --project examples/official-mini-film --ide codex",
    "test": "pnpm --filter ai-video-workflow test"
  }
}
```

Keep the existing scripts. Only add `example:verify`.

**Step 3: Run the script**

Run:

```powershell
pnpm example:verify
```

Expected: PASS with `Verification passed`.

**Step 4: Commit**

```powershell
git add package.json
git commit -m "chore: add example verification script"
```

---

### Task 6: Final Verification

**Files:**
- Read: `package.json`
- Read: `apps/cli/tests/example-verify.test.ts`
- Read: `docs/en/quickstart/index.md`
- Read: `docs/zh/quickstart/index.md`

**Step 1: Run full tests**

Run:

```powershell
pnpm test
```

Expected: PASS. Confirm all test files and all tests pass.

**Step 2: Run full build**

Run:

```powershell
pnpm build
```

Expected: PASS. Confirm CLI build and VitePress docs build complete.

**Step 3: Run example verification**

Run:

```powershell
pnpm example:verify
```

Expected: PASS with:

```text
Verification passed
```

**Step 4: Check worktree**

Run:

```powershell
git status --short
```

Expected: only intended source, docs, example, and test changes should be present. Build outputs ignored by `.gitignore` should not be staged.

**Step 5: Update changelog if this is being prepared as a release**

If the branch is intended for release, add a short entry to `CHANGELOG.md`:

```md
## 0.1.1

- Made the bundled `official-mini-film` example verifiable.
- Added a root `example:verify` script.
- Improved doctor guidance for missing IDE runtime layers.
- Expanded quickstart verification steps in English and Chinese docs.
```

Then commit:

```powershell
git add CHANGELOG.md
git commit -m "docs: update changelog for v0.1.1"
```

Skip this step if the release version is not being cut yet.

---

## Execution Notes

- Do not change Step 4 file contracts.
- Do not add JSON or YAML as the default source layer for Step 4 prompts.
- Do not make `examples/official-mini-film` depend on private project names, private scripts, real assets, or absolute paths.
- Generated Codex runtime files in the example are acceptable because this example is meant to prove the public runtime layout, but do not commit `docs/.vitepress/dist`, `docs/.vitepress/.temp`, or `apps/cli/dist` unless a separate release policy explicitly requires it.

## Completion Checklist

- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm example:verify`
- [ ] `node apps/cli/dist/index.js verify --project examples/official-mini-film --ide codex`
- [ ] Quickstart pages mention `verify`, `doctor`, and `sync`
- [ ] All links and paths added in docs are relative or placeholder CLI arguments, not absolute machine paths
