import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { syncProject } from "../src/lib/sync.js";
import { verifyProject } from "../src/lib/verify.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

describe("official example", () => {
  test("官方示例-云上早市 passes codex verification", async () => {
    const repoRoot = path.resolve(__dirname, "..", "..", "..");
    const sourceProjectRoot = path.join(repoRoot, "examples", "官方示例-云上早市");
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-official-example-"));
    tempRoots.push(tempRoot);
    const projectRoot = path.join(tempRoot, "官方示例-云上早市");
    await fs.copy(sourceProjectRoot, projectRoot, { filter: (filePath) => !filePath.includes(`${path.sep}.codex${path.sep}`) && !filePath.includes(`${path.sep}_views${path.sep}`) });
    await syncProject({ repoRoot, projectRoot, pack: "official-ai-video", ide: "codex" });

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result).toEqual({ ok: true, issues: [] });

    const shotFiles = ["镜头-001.md", "镜头-002.md", "镜头-003.md"];
    for (const file of shotFiles) {
      const storyboard = await fs.readFile(path.join(projectRoot, "03_分镜脚本", "镜头组-001", file), "utf8");
      expect(storyboard).toContain("../../04_图片提示词/镜头组-001/");
    }

    for (const file of ["镜头-001-关键帧-01.md", "镜头-002-关键帧-01.md", "镜头-003-关键帧-01.md"]) {
      const prompt = await fs.readFile(path.join(projectRoot, "04_图片提示词", "镜头组-001", file), "utf8");
      expect(prompt).toContain("快速导读");
      expect(prompt).toContain("中文完整版本");
      expect(prompt).toContain("可复制提示词");
      expect(prompt).toMatch(/避免[:：]/);
    }
  });
});
