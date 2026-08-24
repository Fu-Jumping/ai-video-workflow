import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { MockLibTvBackend } from "../src/lib/libtv/mock-backend.js";
import { readState, writeState } from "../src/lib/libtv/project-binding.js";
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

  test("runRefine uses the execution path and records progress fields", async () => {
    const projectRoot = await createStateProject();
    const backend = new MockLibTvBackend();
    await runRefine(projectRoot, backend, "group-001/shot-001/keyframe-01", {
      allowGeneration: true,
      base: "first",
      instruction: "只修手",
      pollIntervalMs: 1,
      timeoutMs: 5000
    });
    const state = await readState(projectRoot);
    const round = state?.keyframes[0]?.refineRounds?.[0];
    expect(round?.status).toBe("generated");
    expect(round?.taskId).toBeTruthy();
    expect(round?.progressPercent).toBe(100);
    expect(round?.attempts).toBe(1);
    expect(backend.getPollCount()).toBeGreaterThan(0);
  });

  test("runRefine inherits low/1K image settings from project config", async () => {
    const projectRoot = await createStateProject();
    await fs.writeFile(
      path.join(projectRoot, "project.config.yaml"),
      [
        "pack: official-ai-video",
        "ide: codex",
        "platforms:",
        "  image:",
        "    default: gpt-image-2",
        "  video:",
        "    default: seedance",
        "workflow:",
        "  enhanced_flow:",
        "    enabled: true",
        "libtv:",
        "  image_model: lib-image-2",
        "  image_settings:",
        "    settings:",
        "      quality: low",
        "      resolution: 1K",
        "      ratio: 16:9",
        ""
      ].join("\n"),
      "utf8"
    );
    const backend = new MockLibTvBackend();
    const result = await runRefine(projectRoot, backend, "group-001/shot-001/keyframe-01", {
      allowGeneration: true,
      base: "first",
      instruction: "只修手"
    });
    const remote = await backend.getNode("mock-project", result.refineNodeId);
    const params = (remote?.data?.params ?? {}) as Record<string, unknown>;
    expect(params.settings).toEqual({ quality: "low", resolution: "1K", ratio: "16:9" });
  });

  test("anchor refine is placed in the anchor material group", async () => {
    const projectRoot = await createStateProject();
    const backend = new MockLibTvBackend();
    const group = await backend.createGroup({ projectUuid: "mock-project", name: "锚点素材" });
    const result = await runRefine(projectRoot, backend, "@角色一三视图", {
      allowGeneration: true,
      base: "first",
      instruction: "只修手"
    });
    const detail = await backend.getProjectDetail("mock-project");
    const refineNode = detail.nodes.find((node) => node.id === result.refineNodeId);
    expect(refineNode).toBeTruthy();
    expect(detail.edges.some((edge) => edge.source === group.id && edge.target === result.refineNodeId)).toBe(true);
  });

  test("runRefine honors explicit x/y placement", async () => {
    const projectRoot = await createStateProject();
    const backend = new MockLibTvBackend();
    const result = await runRefine(projectRoot, backend, "group-001/shot-001/keyframe-01", {
      allowGeneration: true,
      base: "first",
      instruction: "只修手",
      x: 120,
      y: 40
    });
    const detail = await backend.getProjectDetail("mock-project");
    const refineNode = detail.nodes.find((node) => node.id === result.refineNodeId);
    expect(refineNode?.position).toEqual({ x: 120, y: 40 });
  });

  test("runRefine defaults new node next to original when base position exists", async () => {
    const projectRoot = await createStateProject();
    const backend = new MockLibTvBackend();
    const base = await backend.createNode({
      projectUuid: "mock-project",
      name: "group-001 shot-001 keyframe-01",
      type: "image",
      x: 100,
      y: 200,
      data: { url: ["http://example.com/base.png"] },
      params: { model: "lib-image-2" }
    });
    const state = await readState(projectRoot);
    state!.keyframes[0]!.nodeId = base.nodeKey;
    state!.keyframes[0]!.cdnUrl = "http://example.com/base.png";
    await writeState(projectRoot, state!);

    const result = await runRefine(projectRoot, backend, "group-001/shot-001/keyframe-01", {
      allowGeneration: true,
      base: "first",
      instruction: "只修手"
    });
    const detail = await backend.getProjectDetail("mock-project");
    const refineNode = detail.nodes.find((node) => node.id === result.refineNodeId);
    expect(refineNode?.position).toEqual({ x: 340, y: 200 });
    const round = (await readState(projectRoot))?.keyframes[0]?.refineRounds?.[0];
    expect(round?.baseNodeId).toBe(base.nodeKey);
  });

  test("runRefine retry reuses failed refine node and submits a new task", async () => {
    const projectRoot = await createStateProject();
    const backend = new MockLibTvBackend();
    backend.configureGeneration({ failNodeKeys: ["group-001 shot-001 keyframe-01 精修"], failAfterPolls: 1 });

    await expect(
      runRefine(projectRoot, backend, "group-001/shot-001/keyframe-01", {
        allowGeneration: true,
        base: "first",
        instruction: "只修手",
        pollIntervalMs: 1,
        timeoutMs: 5000
      })
    ).rejects.toThrow();

    const failedState = await readState(projectRoot);
    const failedRound = failedState?.keyframes[0]?.refineRounds?.[0];
    expect(failedRound?.status).toBe("failed");
    expect(failedRound?.refineNodeId).toBeTruthy();
    const failedNodeId = failedRound!.refineNodeId!;
    const callsAfterFailure = backend.getGenerationCallCount(failedNodeId);
    expect(callsAfterFailure).toBe(1);

    backend.configureGeneration({});
    const result = await runRefine(projectRoot, backend, "group-001/shot-001/keyframe-01", {
      allowGeneration: true,
      base: "first",
      instruction: "只修手",
      retry: true,
      pollIntervalMs: 1,
      timeoutMs: 5000
    });
    expect(result.refineNodeId).toBe(failedNodeId);
    const retriedState = await readState(projectRoot);
    expect(retriedState?.keyframes[0]?.refineRounds).toHaveLength(1);
    expect(retriedState?.keyframes[0]?.refineRounds?.[0]?.status).toBe("generated");
    expect(retriedState?.keyframes[0]?.refineRounds?.[0]?.attempts).toBe(2);
    expect(backend.getGenerationCallCount(failedNodeId)).toBe(callsAfterFailure + 1);
  });

  test("runRefine resumes an interrupted refining round without creating a new node", async () => {
    const projectRoot = await createStateProject();
    const backend = new MockLibTvBackend();
    const node = await backend.createNode({
      projectUuid: "mock-project",
      name: "group-001 shot-001 keyframe-01 精修",
      type: "image",
      x: 10,
      y: 20,
      params: { model: "lib-image-2", prompt: "参考已有首版/当前版本图片。\n只修手" }
    });
    const state = await readState(projectRoot);
    state!.keyframes[0]!.refineRounds = [{
      round: 1,
      base: "first",
      baseNodeId: "i-keyframe-1",
      instruction: "只修手",
      refineNodeId: node.nodeKey,
      status: "refining",
      taskId: `task-${node.nodeKey}`,
      attempts: 1
    }];
    await writeState(projectRoot, state!);

    const result = await runRefine(projectRoot, backend, "group-001/shot-001/keyframe-01", {
      allowGeneration: true,
      base: "first",
      instruction: "只修手",
      pollIntervalMs: 1,
      timeoutMs: 5000
    });
    expect(result.refineNodeId).toBe(node.nodeKey);
    expect(backend.getGenerationCallCount(node.nodeKey)).toBe(0);
    const resumed = await readState(projectRoot);
    expect(resumed?.keyframes[0]?.refineRounds).toHaveLength(1);
    expect(resumed?.keyframes[0]?.refineRounds?.[0]?.status).toBe("generated");
  });

});
