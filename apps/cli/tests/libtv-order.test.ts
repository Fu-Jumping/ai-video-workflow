import { describe, expect, test } from "vitest";
import { normalizeRef, promptPlaceholders } from "../src/lib/libtv/order.js";

describe("libtv order helpers", () => {
  test("normalizeRef strips @ and separators", () => {
    expect(normalizeRef("@沈安三视图")).toBe("沈安三视图");
    expect(normalizeRef("镜头 001 关键帧 01")).toBe("shot001keyframe01");
  });

  test("promptPlaceholders extracts Image/Mixed indexes", () => {
    const prompt = "把 {{Image 1}} 作为主体，参考 {{Mixed 3}}";
    expect(promptPlaceholders(prompt)).toEqual([
      { kind: "Image", index: 1 },
      { kind: "Mixed", index: 3 }
    ]);
  });
});

import { displayNameForVideo, displayNameForKeyframe } from "../src/lib/libtv/order.js";

describe("libtv group-prefixed display names", () => {
  test("display names include group to avoid cross-group duplicates", () => {
    expect(displayNameForVideo("group-001", "shot-001")).toBe("group-001 shot-001 视频");
    expect(displayNameForKeyframe("group-002", "shot-001", "keyframe-01")).toBe("group-002 shot-001 keyframe-01");
  });
});
