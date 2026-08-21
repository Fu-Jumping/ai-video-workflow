import path from "node:path";
import { describe, expect, test } from "vitest";
import { buildLibTvPlan } from "../src/lib/libtv/assets.js";

const exampleRoot = path.resolve(__dirname, "..", "..", "..", "examples", "官方示例-云上早市");

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
