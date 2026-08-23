import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { MockLibTvBackend } from "../src/lib/libtv/mock-backend.js";
import { writeState } from "../src/lib/libtv/project-binding.js";
import { recordReview, runRefine, buildRefinePrompt } from "../src/lib/libtv/refine.js";
import type { LibTvState } from "../src/lib/libtv/types.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

async function createStateProject(overrides: Partial<LibTvState> = {}): Promise<string> {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-libtv-refine-"));
  tempRoots.push(projectRoot);
  const state: LibTvState = {
    version: 1,
    projectUuid: "mock-project",
    anchors: [
      {
        token: "@角色一三视图",
        name: "角色一",
        kind: "character-triview",
        localPath: "a.png",
        nodeId: "i-anchor-1",
        fileSha256: "sha",
        uploadedAt: new Date().toISOString()
      }
    ],
    keyframes: [
      {
        groupId: "group-001",
        shotId: "shot-001",
        keyframeId: "keyframe-01",
        sourcePath: "04_图片提示词/镜头组-001/镜头-001-关键帧-01.md",
        prompt: "中文提示词",
        referenceTokens: ["@角色一三视图"],
        nodeId: "i-keyframe-1",
        status: "pending-approval"
      }
    ],
    videos: [],
    updatedAt: new Date().toISOString(),
    ...overrides
  };
  await writeState(projectRoot, state);
  return projectRoot;
}

describe("LibTV refine review state", () => {
  test("recordReview direct marks the image as final", async () => {
    const projectRoot = await createStateProject();
    const result = await recordReview(projectRoot, "group-001/shot-001/keyframe-01", {
      decision: "direct"
    });
    expect(result.target.item.finalNodeId).toBe("i-keyframe-1");
    expect(result.target.item.status).toBe("approved");
  });

  test("recordReview refine stores feedback and clears final", async () => {
    const projectRoot = await createStateProject();
    await recordReview(projectRoot, "@角色一三视图", {
      decision: "refine",
      feedback: "左手手指多了一根"
    });
    const target = (await import("../src/lib/libtv/project-binding.js")).readState;
    const state = await target(projectRoot);
    expect(state?.anchors[0]?.reviewDecision).toBe("refine");
    expect(state?.anchors[0]?.feedback).toBe("左手手指多了一根");
    expect(state?.anchors[0]?.finalNodeId).toBeUndefined();
  });

  test("buildRefinePrompt includes the default protection rule", () => {
    const prompt = buildRefinePrompt("只修左手手指和服装纹理", []);
    expect(prompt).toContain("只修左手手指和服装纹理");
    expect(prompt).toContain("不得改动除用户指定修改点之外的任何画面区域");
    expect(prompt).toContain("保持不变：除上述修改点外");
  });

  test("runRefine requires explicit generation permission", async () => {
    const projectRoot = await createStateProject();
    const backend = new MockLibTvBackend();
    await expect(
      runRefine(projectRoot, backend, "group-001/shot-001/keyframe-01", {
        allowGeneration: false,
        base: "first",
        instruction: "只修手"
      })
    ).rejects.toThrow("--allow-generation");
  });

  test("runRefine creates a lib-image-2 refine node beside the original", async () => {
    const projectRoot = await createStateProject();
    const backend = new MockLibTvBackend();
    const result = await runRefine(projectRoot, backend, "group-001/shot-001/keyframe-01", {
      allowGeneration: true,
      base: "first",
      instruction: "只修手"
    });
    expect(result.refineNodeId).toMatch(/^i-/);
    expect(result.round).toBe(1);
    const state = await (await import("../src/lib/libtv/project-binding.js")).readState(projectRoot);
    expect(state?.keyframes[0]?.refineRounds).toHaveLength(1);
    expect(state?.keyframes[0]?.refineRounds?.[0]?.baseNodeId).toBe("i-keyframe-1");
    expect(state?.keyframes[0]?.status).toBe("refined_generated");
    const remote = await backend.getNode("mock-project", result.refineNodeId);
    expect(remote?.nodeType).toBe("image");
    expect((remote?.data?.params as Record<string, unknown>)?.model).toBe("lib-image-2");
  });
});
