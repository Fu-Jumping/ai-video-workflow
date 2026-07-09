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

function officialExampleRoot(): string {
  return path.resolve(__dirname, "..", "..", "..", "examples", "official-mini-film");
}

describe("verifyObsidianVault", () => {
  test("passes for exported official example", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-verify-"));
    tempRoots.push(outRoot);
    const projectRoot = officialExampleRoot();
    await exportObsidianVault({ projectRoot, outRoot, force: true, includePluginRecipes: true });

    const result = await verifyObsidianVault({ projectRoot, vaultRoot: outRoot });
    expect(result.ok).toBe(true);
  });
});
