import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { exportObsidianVault } from "../src/lib/obsidian/export.js";
import { verifyObsidianVault } from "../src/lib/obsidian/verify.js";
import { syncProject } from "../src/lib/sync.js";
import { verifyProject } from "../src/lib/verify.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

describe("official example Obsidian projection", () => {
  test("exports and verifies", async () => {
    const projectRoot = path.resolve(__dirname, "..", "..", "..", "examples", "官方示例-云上早市");
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-official-obsidian-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot, outRoot, force: true, includePluginRecipes: true, inProjectView: true });
    const result = await verifyObsidianVault({ projectRoot, vaultRoot: outRoot });

    expect(result.ok).toBe(true);
    await expect(fs.pathExists(path.join(outRoot, "00_开始审阅", "00_项目首页.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(outRoot, "03_审阅工具", "数据看板", "镜头.base"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(outRoot, "03_审阅工具", "全局画布", "镜头流水线.canvas"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(outRoot, "02_按镜头联查", "单镜头", "shot-001.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(outRoot, "02_按镜头联查", "单镜头", "shot-002.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(outRoot, "02_按镜头联查", "单镜头", "shot-003.md"))).resolves.toBe(true);
  });

  test("exports and verifies the in-project Obsidian view layer", async () => {
    const repoRoot = path.resolve(__dirname, "..", "..", "..");
    const sourceProjectRoot = path.join(repoRoot, "examples", "官方示例-云上早市");
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-official-obsidian-in-project-"));
    tempRoots.push(tempRoot);
    const projectRoot = path.join(tempRoot, "官方示例-云上早市");
    const outRoot = path.join(projectRoot, "_views", "obsidian");
    await fs.copy(sourceProjectRoot, projectRoot);
    await syncProject({ repoRoot, projectRoot, pack: "official-ai-video", ide: "codex" });

    await exportObsidianVault({ projectRoot, outRoot, force: true, includePluginRecipes: true, inProjectView: true });
    const obsidianResult = await verifyObsidianVault({ projectRoot, vaultRoot: outRoot });
    const projectResult = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video" });

    expect(obsidianResult.ok).toBe(true);
    expect(projectResult.ok).toBe(true);
    await expect(fs.pathExists(path.join(outRoot, "00_开始审阅", "00_项目首页.md"))).resolves.toBe(true);

    const manualNote = path.join(outRoot, "04_个人笔记", "manual.md");
    await fs.writeFile(manualNote, "# Manual Note\n\nKeep this review observation.\n", "utf8");
    await exportObsidianVault({ projectRoot, outRoot, force: false, includePluginRecipes: true, inProjectView: true });

    await expect(fs.readFile(manualNote, "utf8")).resolves.toContain("Keep this review observation.");
  });
});
