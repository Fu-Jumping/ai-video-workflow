import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { exportObsidianVault } from "../src/lib/obsidian/export.js";
import { toVaultPath } from "../src/lib/obsidian/paths.js";
import { scanProjectForObsidian } from "../src/lib/obsidian/scan.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

function officialExampleRoot(): string {
  return path.resolve(__dirname, "..", "..", "..", "examples", "official-mini-film");
}

describe("Obsidian export paths", () => {
  test("normalizes Windows paths to vault-relative POSIX paths", () => {
    expect(toVaultPath(path.join("Workflow", "Step 3 - Storyboard", "Shot 001.md"))).toBe(
      "Workflow/Step 3 - Storyboard/Shot 001.md"
    );
  });
});

describe("scanProjectForObsidian", () => {
  test("scans the official example into workflow source files", async () => {
    const files = await scanProjectForObsidian(officialExampleRoot());

    expect(files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceKind: "concept", step: 1 }),
        expect.objectContaining({ sourceKind: "storyboard", step: 3, shotId: "shot-001" }),
        expect.objectContaining({ sourceKind: "image-prompt", step: 4, shotId: "shot-001" }),
        expect.objectContaining({ sourceKind: "video-prompt", step: 5, shotId: "shot-001" }),
        expect.objectContaining({ sourceKind: "execution-plan", step: 6 })
      ])
    );
  });
});

describe("exportObsidianVault", () => {
  test("exports generated workflow notes with provenance frontmatter", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });

    const storyboard = await fs.readFile(path.join(outRoot, "Workflow", "Step 3 - Storyboard", "Shot 001 - Storyboard.md"), "utf8");
    expect(storyboard).toContain("projection_generated: true");
    expect(storyboard).toContain("source_path: 03_storyboard/shot-001.md");
    expect(storyboard).toContain("ai-video/step/03-storyboard");
  });

  test("exports Obsidian dashboards with embedded Bases and query blocks", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-dashboard-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });

    const home = await fs.readFile(path.join(outRoot, "00_Project_Home.md"), "utf8");
    expect(home).toContain("![[Bases/Workflow Files.base#Workflow Files]]");
    expect(home).toContain("![[Canvas/Workflow Map.canvas]]");
    expect(home).toContain("```query");
  });

  test("exports Obsidian Bases for workflow files and shots", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-bases-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });

    const shotsBase = await fs.readFile(path.join(outRoot, "Bases", "Shots.base"), "utf8");
    expect(shotsBase).toContain("file.hasTag(\"ai-video/shot\")");
    expect(shotsBase).toContain("type: table");
    expect(shotsBase).toContain("type: cards");
  });

  test("exports valid JSON Canvas maps", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-canvas-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });

    const workflowMap = await fs.readJson(path.join(outRoot, "Canvas", "Workflow Map.canvas"));
    expect(workflowMap.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ type: "group", label: "Step 3" })]));
    expect(workflowMap.edges.length).toBeGreaterThan(0);

    const shotPipeline = await fs.readJson(path.join(outRoot, "Canvas", "Shot Pipeline.canvas"));
    expect(shotPipeline.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ type: "file" })]));
  });
});
