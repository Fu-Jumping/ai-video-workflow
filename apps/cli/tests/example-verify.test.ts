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

    // 内容树模式：03 只放索引，正文一份都不复制（规范 §9.3.2）。
    const step3Dir = path.join(projectRoot, "03_分镜脚本");
    expect((await fs.readdir(step3Dir)).sort()).toEqual(["00_内容树索引.md"]);
    const contentIndex = await fs.readFile(path.join(step3Dir, "00_内容树索引.md"), "utf8");
    expect(contentIndex).toContain("正文唯一事实源在「内容/」");
    expect(contentIndex).toContain("[镜头总表](../内容/00_镜头总表.md)");

    // 镜头到 04 关键帧的链接由 05 执行文件承接，逐镜都要在。
    for (const file of ["镜头-001.md", "镜头-002.md", "镜头-003.md"]) {
      const videoPrompt = await fs.readFile(path.join(projectRoot, "05_视频提示词", "镜头组-001", file), "utf8");
      expect(videoPrompt).toContain("../../04_图片提示词/镜头组-001/");
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
