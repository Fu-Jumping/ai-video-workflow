import fs from "fs-extra";
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
  });
});
