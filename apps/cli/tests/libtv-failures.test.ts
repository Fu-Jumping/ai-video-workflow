import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { applyPlan, redownloadLibTvOutputs, renderApplySummary, renderRedownloadSummary } from "../src/lib/libtv/apply.js";
import { MockLibTvBackend } from "../src/lib/libtv/mock-backend.js";
import { readState, writeBinding, writeState } from "../src/lib/libtv/project-binding.js";
import type { LibTvFetchLike, LibTvState } from "../src/lib/libtv/types.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

const MEDIA_URL = "https://example.invalid/mock/keyframe.png";

/** 下载永远失败的假 fetch：用来制造「生成成功但本地保存失败」。 */
const failingFetch: LibTvFetchLike = async () => {
  throw new Error("socket hang up");
};

/** 下载成功的假 fetch：用来验证补下载。 */
function succeedingFetch(bytes: number[] = [0x89, 0x50, 0x4e, 0x47]): LibTvFetchLike {
  return async () => ({
    ok: true,
    status: 200,
    async arrayBuffer() {
      return new Uint8Array(bytes).buffer;
    }
  });
}

async function makeProject(): Promise<string> {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "avw-libtv-failures-"));
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
    const file = path.join(projectRoot, "assets", "anchors", kind, name + ".png");
    await fs.ensureDir(path.dirname(file));
    await fs.writeFile(file, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  }
  return projectRoot;
}

async function uploadAnchors(projectRoot: string, backend: MockLibTvBackend): Promise<void> {
  await applyPlan(projectRoot, backend, { only: ["anchors"] });
}

describe("libtv 失败三态", () => {
  test("远端状态未知：写 unknown，不写 failed，也不计失败数", async () => {
    const projectRoot = await makeProject();
    const backend = new MockLibTvBackend();
    await uploadAnchors(projectRoot, backend);
    backend.configureGeneration({ timeoutNodeKeys: ["镜头组-001"] });

    const result = await applyPlan(projectRoot, backend, {
      only: ["keyframes"],
      allowGeneration: true,
      pollIntervalMs: 1,
      timeoutMs: 5
    });

    expect(result.summary!.keyframes.unknown).toBeGreaterThan(0);
    expect(result.summary!.keyframes.failed).toBe(0);
    const state = await readState(projectRoot);
    const unknown = state!.keyframes.filter((item) => item.status === "unknown");
    expect(unknown.length).toBeGreaterThan(0);
    expect(unknown[0]!.failureClass).toBe("remote-unknown");
    expect(unknown.every((item) => item.status !== "failed")).toBe(true);
    expect(renderApplySummary(result)).toContain("状态未知");
  });

  test("远端明确失败：写 failed 与 remote-failed", async () => {
    const projectRoot = await makeProject();
    const backend = new MockLibTvBackend();
    await uploadAnchors(projectRoot, backend);
    const plan = await applyPlan(projectRoot, backend, { only: ["keyframes"], allowGeneration: true, pollIntervalMs: 1, timeoutMs: 5000 });
    expect(plan.summary!.keyframes.generated).toBeGreaterThan(0);

    // 清掉已有结果，制造「平台明确返回失败」。
    const state = await readState(projectRoot);
    for (const item of state!.keyframes) {
      item.status = "queued";
      item.localOutput = undefined;
    }
    await writeState(projectRoot, state!);
    backend.configureGeneration({ failNodeKeys: state!.keyframes.map((item) => item.nodeId) });

    const failed = await applyPlan(projectRoot, backend, {
      only: ["keyframes"],
      allowGeneration: true,
      pollIntervalMs: 1,
      timeoutMs: 5000,
      retryIds: state!.keyframes.map((item) => item.groupId + "-" + item.shotId + "-" + item.keyframeId)
    });

    expect(failed.summary!.keyframes.failed).toBeGreaterThan(0);
    expect(failed.summary!.keyframes.unknown).toBe(0);
    const after = await readState(projectRoot);
    const failedItems = after!.keyframes.filter((item) => item.status === "failed");
    expect(failedItems.length).toBeGreaterThan(0);
    expect(failedItems[0]!.failureClass).toBe("remote-failed");
  });

  test("生成成功但本地保存失败：平台状态不降级，taskId 与 cdnUrl 保留", async () => {
    const projectRoot = await makeProject();
    const backend = new MockLibTvBackend();
    await uploadAnchors(projectRoot, backend);
    backend.configureGeneration({ outputUrl: MEDIA_URL });

    const result = await applyPlan(projectRoot, backend, {
      only: ["keyframes"],
      allowGeneration: true,
      pollIntervalMs: 1,
      timeoutMs: 5000,
      fetchImpl: failingFetch
    });

    const state = await readState(projectRoot);
    const item = state!.keyframes[0]!;
    expect(item.status).toBe("pending-approval");
    expect(item.failureClass).toBe("local-save-failed");
    expect(item.downloadError).toContain("socket hang up");
    expect(item.generationError).toBeUndefined();
    expect(item.localOutput).toBeUndefined();
    expect(item.taskId).toBeTruthy();
    expect(item.cdnUrl).toBe(MEDIA_URL);
    expect(result.summary!.keyframes.failed).toBe(0);
    expect(result.summary!.keyframes.generated).toBeGreaterThan(0);
  });

  test("补下载：只落盘不重新生成，generationCalls 恒为 0", async () => {
    const projectRoot = await makeProject();
    const backend = new MockLibTvBackend();
    await uploadAnchors(projectRoot, backend);
    backend.configureGeneration({ outputUrl: MEDIA_URL });
    await applyPlan(projectRoot, backend, {
      only: ["keyframes"],
      allowGeneration: true,
      pollIntervalMs: 1,
      timeoutMs: 5000,
      fetchImpl: failingFetch
    });
    const callsBefore = backend.getTotalGenerationCallCount();

    const summary = await redownloadLibTvOutputs(projectRoot, { only: ["keyframes"], fetchImpl: succeedingFetch() });

    expect(summary.generationCalls).toBe(0);
    expect(summary.saved).toBeGreaterThan(0);
    expect(summary.failed).toBe(0);
    expect(backend.getTotalGenerationCallCount()).toBe(callsBefore);

    const state = await readState(projectRoot);
    const item = state!.keyframes[0]!;
    expect(item.localOutput).toBeTruthy();
    expect(await fs.pathExists(item.localOutput!)).toBe(true);
    expect(item.downloadError).toBeUndefined();
    expect(item.failureClass).toBeUndefined();
    expect(item.taskId).toBeTruthy();
    expect(renderRedownloadSummary(summary)).toContain("本次生成调用 0 次");
  });

  test("补下载不会覆盖已存在的本地文件", async () => {
    const projectRoot = await makeProject();
    const backend = new MockLibTvBackend();
    await uploadAnchors(projectRoot, backend);
    backend.configureGeneration({ outputUrl: MEDIA_URL });
    await applyPlan(projectRoot, backend, {
      only: ["keyframes"],
      allowGeneration: true,
      pollIntervalMs: 1,
      timeoutMs: 5000,
      fetchImpl: succeedingFetch([1, 2, 3])
    });

    const summary = await redownloadLibTvOutputs(projectRoot, { only: ["keyframes"], fetchImpl: succeedingFetch([9, 9, 9]) });
    expect(summary.saved).toBe(0);
    expect(summary.skipped).toBeGreaterThan(0);

    const state = await readState(projectRoot);
    const bytes = await fs.readFile(state!.keyframes[0]!.localOutput!);
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  test("状态未知的节点：不传 --retry 时不会被重新提交", async () => {
    const projectRoot = await makeProject();
    const backend = new MockLibTvBackend();
    await uploadAnchors(projectRoot, backend);
    backend.configureGeneration({ timeoutNodeKeys: ["镜头组-001"] });
    await applyPlan(projectRoot, backend, { only: ["keyframes"], allowGeneration: true, pollIntervalMs: 1, timeoutMs: 5 });

    const callsAfterFirst = backend.getTotalGenerationCallCount();
    const second = await applyPlan(projectRoot, backend, { only: ["keyframes"], allowGeneration: true, pollIntervalMs: 1, timeoutMs: 5 });

    expect(second.actions.some((action) => action.includes("状态未知"))).toBe(true);
    expect(backend.getTotalGenerationCallCount()).toBe(callsAfterFirst);
  });

  test("没有媒体地址时算未下载，不算失败", async () => {
    const projectRoot = await makeProject();
    const backend = new MockLibTvBackend();
    await uploadAnchors(projectRoot, backend);
    // 不设 outputUrl：节点上没有 data.url。
    const result = await applyPlan(projectRoot, backend, { only: ["keyframes"], allowGeneration: true, pollIntervalMs: 1, timeoutMs: 5000 });

    const state = await readState(projectRoot);
    expect(state!.keyframes[0]!.status).toBe("pending-approval");
    expect(state!.keyframes[0]!.failureClass).toBeUndefined();
    expect(result.actions.some((action) => action.includes("没有媒体地址"))).toBe(true);

    const summary = await redownloadLibTvOutputs(projectRoot, { only: ["keyframes"], fetchImpl: succeedingFetch() });
    expect(summary.saved).toBe(0);
    expect(summary.failed).toBe(0);
  });
});
