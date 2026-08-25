import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { applyPlan } from "../src/lib/libtv/apply.js";
import { MockLibTvBackend } from "../src/lib/libtv/mock-backend.js";
import { readState, writeBinding, writeState } from "../src/lib/libtv/project-binding.js";
import type { LibTvState } from "../src/lib/libtv/types.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

async function makeProject(): Promise<string> {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "avw-libtv-apply-"));
  tempRoots.push(projectRoot);
  await fs.copy(path.join(repoRoot, "examples", "官方示例-云上早市"), projectRoot);
  await fs.appendFile(
    path.join(projectRoot, "project.config.yaml"),
    "\nlibtv:\n  image_model: mj-v8.2\n  video_model: star-video2\n",
    "utf8"
  );
  await writeBinding(projectRoot, { projectUuid: "mock-project" });

  const anchorFiles: Array<[string, string]> = [
    ["characters", "罗婆婆三视图"],
    ["characters", "沈安三视图"],
    ["characters", "小满三视图"],
    ["scenes", "小镇修伞铺场景图"],
    ["scenes", "云上早市场景图"],
    ["scenes", "镇口晨光场景图"]
  ];
  for (const [kind, name] of anchorFiles) {
    const file = path.join(projectRoot, "assets", "anchors", kind, `${name}.png`);
    await fs.ensureDir(path.dirname(file));
    await fs.writeFile(file, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  }
  return projectRoot;
}

async function uploadAnchors(projectRoot: string, backend: MockLibTvBackend): Promise<void> {
  await applyPlan(projectRoot, backend, { only: ["anchors"] });
}

async function approveAllKeyframes(projectRoot: string): Promise<void> {
  const state = await readState(projectRoot);
  expect(state).not.toBeNull();
  for (const item of state!.keyframes) {
    item.status = "approved";
    item.finalNodeId = item.nodeId;
  }
  await writeState(projectRoot, state!);
}

describe("libtv apply with mock backend", () => {
  test("default dry-run: keyframe/video generation requires --allow-generation", async () => {
    const projectRoot = await makeProject();
    const backend = new MockLibTvBackend();
    await uploadAnchors(projectRoot, backend);

    const result = await applyPlan(projectRoot, backend, { only: ["keyframes"] });
    expect(result.state.keyframes).toHaveLength(0);
    expect(result.actions.some((action) => action.includes("--allow-generation"))).toBe(true);
    expect(backend.getTotalGenerationCallCount()).toBe(0);
  });

  test("generates keyframes, blocks videos until approval, then generates videos without duplicates", async () => {
    const projectRoot = await makeProject();
    const backend = new MockLibTvBackend();
    await uploadAnchors(projectRoot, backend);

    const keyframes = await applyPlan(projectRoot, backend, {
      only: ["keyframes"],
      allowGeneration: true,
      pollIntervalMs: 1,
      timeoutMs: 5000
    });
    expect(keyframes.state.keyframes).toHaveLength(3);
    for (const item of keyframes.state.keyframes) {
      expect(item.status).toBe("pending-approval");
      expect(item.taskId).toBeTruthy();
      expect(item.progressPercent).toBe(100);
    }
    expect(backend.getPollCount()).toBeGreaterThan(0);

    const videosBefore = await applyPlan(projectRoot, backend, {
      only: ["videos"],
      allowGeneration: true
    });
    expect(videosBefore.state.videos).toHaveLength(0);
    expect(videosBefore.actions.some((action) => action.includes("关键帧未通过人工审核"))).toBe(true);

    // Legacy "generated" status must NOT pass the review gate.
    const state = await readState(projectRoot);
    for (const item of state!.keyframes) {
      item.status = "generated";
      item.finalNodeId = undefined;
    }
    await writeState(projectRoot, state!);
    const videosWithGenerated = await applyPlan(projectRoot, backend, {
      only: ["videos"],
      allowGeneration: true
    });
    expect(videosWithGenerated.state.videos).toHaveLength(0);
    expect(videosWithGenerated.actions.some((action) => action.includes("关键帧未通过人工审核"))).toBe(true);

    await approveAllKeyframes(projectRoot);

    const videosAfter = await applyPlan(projectRoot, backend, {
      only: ["videos"],
      allowGeneration: true,
      pollIntervalMs: 1,
      timeoutMs: 5000
    });
    expect(videosAfter.state.videos).toHaveLength(3);
    for (const video of videosAfter.state.videos) {
      expect(video.status).toBe("generated");
    }

    const callsAfterGenerate = backend.getTotalGenerationCallCount();
    const rerunKeyframes = await applyPlan(projectRoot, backend, {
      only: ["keyframes"],
      allowGeneration: true
    });
    expect(rerunKeyframes.state.keyframes).toHaveLength(3);
    const rerunVideos = await applyPlan(projectRoot, backend, {
      only: ["videos"],
      allowGeneration: true
    });
    expect(rerunVideos.state.videos).toHaveLength(3);
    expect(backend.getTotalGenerationCallCount()).toBe(callsAfterGenerate);
  });

  test("failure is recorded and only explicit --retry re-runs failed node", async () => {
    const projectRoot = await makeProject();
    const backend = new MockLibTvBackend();
    await uploadAnchors(projectRoot, backend);

    backend.configureGeneration({
      failNodeKeys: ["group-001 shot-001 keyframe-01"],
      failAfterPolls: 1
    });

    const first = await applyPlan(projectRoot, backend, {
      only: ["keyframes"],
      allowGeneration: true,
      pollIntervalMs: 1,
      timeoutMs: 5000
    });
    const failed = first.state.keyframes.find((item) => item.status === "failed");
    expect(failed).toBeDefined();
    expect(first.state.keyframes.filter((item) => item.status === "pending-approval")).toHaveLength(2);
    expect(first.summary.keyframes.failed).toBe(1);
    expect(first.summary.keyframes.failures[0]?.reason).toBe("generation-failed");
    const failedNodeId = failed!.nodeId;
    const callsAfterFailure = backend.getGenerationCallCount(failedNodeId);

    // Without explicit --retry, failed nodes are not retried.
    const second = await applyPlan(projectRoot, backend, { only: ["keyframes"], allowGeneration: true });
    expect(second.state.keyframes.find((item) => item.status === "failed")).toBeDefined();
    expect(backend.getGenerationCallCount(failedNodeId)).toBe(callsAfterFailure);

    // Clear failure and retry only the failed keyframe.
    backend.configureGeneration({});
    const retried = await applyPlan(projectRoot, backend, {
      only: ["keyframes"],
      allowGeneration: true,
      retryIds: ["group-001/shot-001/keyframe-01"],
      pollIntervalMs: 1,
      timeoutMs: 5000
    });
    expect(retried.state.keyframes.find((item) => item.status === "failed")).toBeUndefined();
    expect(backend.getGenerationCallCount(failedNodeId)).toBe(callsAfterFailure + 1);
  });

  test("timeout marks failed node and continues other nodes", async () => {
    const projectRoot = await makeProject();
    const backend = new MockLibTvBackend();
    await uploadAnchors(projectRoot, backend);

    backend.configureGeneration({
      timeoutNodeKeys: ["group-001 shot-002 keyframe-01"]
    });

    const result = await applyPlan(projectRoot, backend, {
      only: ["keyframes"],
      allowGeneration: true,
      pollIntervalMs: 1,
      timeoutMs: 30
    });
    const failed = result.state.keyframes.find((item) => item.status === "failed");
    expect(failed).toBeDefined();
    expect(failed?.generationError).toContain("超时");
    expect(result.state.keyframes.filter((item) => item.status === "pending-approval").length).toBeGreaterThanOrEqual(1);
    expect(result.summary.keyframes.failures.some((failure) => failure.reason === "timeout")).toBe(true);
  });
});

test("video generation references finalNodeId when keyframe is final_approved", async () => {
  const projectRoot = await makeProject();
  const backend = new MockLibTvBackend();
  await uploadAnchors(projectRoot, backend);

  await applyPlan(projectRoot, backend, {
    only: ["keyframes"],
    allowGeneration: true,
    pollIntervalMs: 1,
    timeoutMs: 5000
  });

  const state = await readState(projectRoot);
  const first = state!.keyframes.find((item) => item.shotId === "shot-001")!;
  first.status = "final_approved";
  first.finalNodeId = "i-refine-final";
  for (const item of state!.keyframes) {
    if (item !== first) {
      item.status = "approved";
      item.finalNodeId = item.nodeId;
    }
  }
  await writeState(projectRoot, state!);

  const videos = await applyPlan(projectRoot, backend, {
    only: ["videos"],
    allowGeneration: true,
    pollIntervalMs: 1,
    timeoutMs: 5000
  });
  expect(videos.state.videos).toHaveLength(3);

  const detail = await backend.getProjectDetail("mock-project");
  const videoNode = detail.nodes.find((node) => node.name === "group-001 shot-001 视频");
  expect(videoNode).toBeDefined();
  const sources = detail.edges.filter((edge) => edge.target === videoNode!.id).map((edge) => edge.source);
  expect(sources).toContain("i-refine-final");
});

test("resumes an in-flight generation using existing taskId without submitting a new task", async () => {
  const projectRoot = await makeProject();
  const backend = new MockLibTvBackend();
  await uploadAnchors(projectRoot, backend);

  const nodes: Array<{ shotId: string; nodeKey: string }> = [];
  for (const shotId of ["shot-001", "shot-002", "shot-003"]) {
    const node = await backend.createNode({
      projectUuid: "mock-project",
      name: `group-001 ${shotId} keyframe-01`,
      type: "image",
      prompt: "test prompt",
      params: { model: "mj-v8.2" },
      groupNodeKey: "group-001",
      run: false
    });
    nodes.push({ shotId, nodeKey: node.nodeKey });
  }

  const state: LibTvState = {
    version: 1,
    projectUuid: "mock-project",
    anchors: [],
    keyframes: nodes.map(({ shotId, nodeKey }) => ({
      groupId: "group-001",
      shotId,
      keyframeId: "keyframe-01",
      sourcePath: `04_图片提示词/镜头组-001/镜头-${shotId.replace("shot-", "")}-关键帧-01.md`,
      prompt: "test prompt",
      referenceTokens: [],
      modelKey: "mj-v8.2",
      nodeId: nodeKey,
      status: "generating" as const,
      taskId: `task-${nodeKey}`,
      attempts: 1
    })),
    videos: [],
    updatedAt: new Date().toISOString()
  };
  await writeState(projectRoot, state);

  const result = await applyPlan(projectRoot, backend, {
    only: ["keyframes"],
    allowGeneration: true,
    pollIntervalMs: 1,
    timeoutMs: 5000
  });

  expect(backend.getTotalGenerationCallCount()).toBe(0);
  expect(result.state.keyframes[0]?.status).toBe("pending-approval");
  expect(result.state.keyframes[0]?.taskId).toBe(`task-${nodes[0]!.nodeKey}`);
});
