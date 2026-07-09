import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { exportObsidianVault } from "../src/lib/obsidian/export.js";
import { verifyObsidianVault } from "../src/lib/obsidian/verify.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

describe("official example Obsidian projection", () => {
  test("exports and verifies", async () => {
    const projectRoot = path.resolve(__dirname, "..", "..", "..", "examples", "official-mini-film");
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-official-obsidian-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot, outRoot, force: true, includePluginRecipes: true });
    const result = await verifyObsidianVault({ projectRoot, vaultRoot: outRoot });

    expect(result.ok).toBe(true);
    await expect(fs.pathExists(path.join(outRoot, "00_Project_Home.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(outRoot, "Bases", "Shots.base"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(outRoot, "Canvas", "Shot Pipeline.canvas"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(outRoot, "Shots", "shot-001.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(outRoot, "Shots", "shot-002.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(outRoot, "Shots", "shot-003.md"))).resolves.toBe(true);
  });
});
