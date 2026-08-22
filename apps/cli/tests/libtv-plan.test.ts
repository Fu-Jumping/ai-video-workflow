import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { buildLibTvPlan } from "../src/lib/libtv/assets.js";

const exampleRoot = path.resolve(__dirname, "..", "..", "..", "examples", "官方示例-云上早市");
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

describe("libtv plan from official example", () => {
  test("discovers anchors, keyframes, videos, and groups", async () => {
    const plan = await buildLibTvPlan(exampleRoot);
    expect(plan.anchors.map((anchor) => anchor.token)).toEqual([
      "@罗婆婆三视图",
      "@沈安三视图",
      "@小满三视图",
      "@小镇修伞铺场景图",
      "@云上早市场景图",
      "@镇口晨光场景图"
    ]);
    expect(plan.keyframes).toHaveLength(3);
    expect(plan.videos).toHaveLength(3);
    expect(plan.groups).toEqual(["group-001"]);
    for (const keyframe of plan.keyframes) {
      expect(keyframe.prompt.length).toBeGreaterThan(0);
    }
    for (const video of plan.videos) {
      expect(video.prompt.length).toBeGreaterThan(0);
    }
  });
});

describe("libtv model mapping", () => {
  test("official example maps seedance video to star-video2", async () => {
    const plan = await buildLibTvPlan(exampleRoot);
    expect(plan.videos.every((video) => video.modelKey === "star-video2")).toBe(true);
  });

  test("project libtv config overrides image model", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "avw-libtv-model-"));
    tempRoots.push(projectRoot);
    await fs.copy(exampleRoot, projectRoot);
    await fs.writeFile(
      path.join(projectRoot, "project.config.yaml"),
      [
        "pack: official-ai-video",
        "ide: codex",
        "platforms:",
        "  image:",
        "    default: midjourney",
        "  video:",
        "    default: seedance",
        "workflow:",
        "  enhanced_flow:",
        "    enabled: true",
        "libtv:",
        "  image_model: mj-v8.2",
        "  video_model: star-video2"
      ].join("\n"),
      "utf8"
    );
    const plan = await buildLibTvPlan(projectRoot);
    expect(plan.keyframes.every((item) => item.modelKey === "mj-v8.2")).toBe(true);
    expect(plan.videos.every((item) => item.modelKey === "star-video2")).toBe(true);
  });
});

describe("libtv order tokens", () => {
  test("official example video refs include upload order tokens", async () => {
    const plan = await buildLibTvPlan(exampleRoot);
    expect(plan.videos[0].orderTokens).toBeDefined();
    expect(plan.videos[0].orderTokens!.length).toBeGreaterThanOrEqual(4);
  });
});
