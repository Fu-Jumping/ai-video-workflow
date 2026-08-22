import fs from "fs-extra";
import path from "node:path";
import { describe, expect, test } from "vitest";

const packsRoot = path.resolve(__dirname, "..", "..", "..", "packs", "official-ai-video", "templates");

describe("LibTV template guidance", () => {
  test("Step 4 template requires shot-001 keyframe ID format", async () => {
    const content = await fs.readFile(path.join(packsRoot, "04_图片提示词", "图片提示词.md"), "utf8");
    expect(content).toContain("镜头编号必须写 `shot-001`");
    expect(content).toContain("invalid-keyframe-mapping");
  });

  test("Step 3 template requires Markdown relative links for downstream files", async () => {
    const content = await fs.readFile(path.join(packsRoot, "03_分镜脚本", "分镜卡.md"), "utf8");
    expect(content).toContain("Markdown 相对链接");
    expect(content).toContain("missing-step3-step4-link");
  });

  test("Step 5 template includes a shot-specific negative constraint example", async () => {
    const content = await fs.readFile(path.join(packsRoot, "05_视频提示词", "视频提示词.md"), "utf8");
    expect(content).toContain("不得让本镜的");
    expect(content).toContain("必须按当前镜头改写为具体约束");
  });
});
