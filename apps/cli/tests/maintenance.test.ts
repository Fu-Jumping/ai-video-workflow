import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { createProject } from "../src/lib/init.js";
import {
  cleanInProjectObsidianView,
  rebuildInProjectObsidianView,
  renderCleanViewSummary,
  renderRebuildViewSummary
} from "../src/lib/maintenance.js";
import { exportObsidianVault } from "../src/lib/obsidian/export.js";
import { projectionManifestPath } from "../src/lib/obsidian/manifest.js";
import { resolveInProjectObsidianView } from "../src/lib/view-layer.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

function officialExampleRoot(): string {
  return path.resolve(__dirname, "..", "..", "..", "examples", "官方示例-云上早市");
}

async function seedProject(projectName = "demo-project"): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-maintenance-"));
  tempRoots.push(root);
  await createProject({
    targetRoot: root,
    projectName,
    pack: "official-ai-video",
    ide: "codex",
    imagePlatform: "openai",
    videoPlatform: "runway"
  });
  return path.join(root, projectName);
}

async function seedOfficialExampleProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-maintenance-example-"));
  tempRoots.push(root);
  const projectRoot = path.join(root, "官方示例-云上早市");
  await fs.copy(officialExampleRoot(), projectRoot);
  return projectRoot;
}

async function exportView(projectRoot: string) {
  const vaultRoot = resolveInProjectObsidianView(projectRoot);
  const result = await exportObsidianVault({
    projectRoot,
    outRoot: vaultRoot,
    force: false,
    includePluginRecipes: true,
    inProjectView: true
  });
  const storyProjection = result.files.find((file) => file.sourcePath === "01_概念策划/故事内核.md");
  expect(storyProjection).toBeDefined();
  return { vaultRoot, storyProjectionPath: storyProjection?.vaultPath ?? "" };
}

describe("cleanInProjectObsidianView", () => {
  test("removes manifest-tracked generated files while preserving user-authored notes", async () => {
    const projectRoot = await seedProject();
    const { vaultRoot, storyProjectionPath } = await exportView(projectRoot);
    const userNote = path.join(vaultRoot, "笔记", "manual-review.md");
    await fs.writeFile(userNote, "# 手写审阅\n\n这条笔记应该保留。\n", "utf8");

    const result = await cleanInProjectObsidianView({ projectRoot });

    expect(result.operations).toEqual(expect.arrayContaining([expect.objectContaining({ status: "removed", vaultPath: storyProjectionPath })]));
    expect(result.preservedUntrackedFiles).toContain("笔记/manual-review.md");
    await expect(fs.pathExists(path.join(vaultRoot, storyProjectionPath))).resolves.toBe(false);
    await expect(fs.pathExists(path.join(vaultRoot, projectionManifestPath))).resolves.toBe(false);
    await expect(fs.readFile(userNote, "utf8")).resolves.toContain("这条笔记应该保留");
    expect(renderCleanViewSummary(result)).toContain("preserved untracked files: 1");
  });

  test("dry-run reports generated files without deleting them", async () => {
    const projectRoot = await seedProject();
    const { vaultRoot, storyProjectionPath } = await exportView(projectRoot);

    const result = await cleanInProjectObsidianView({ projectRoot, dryRun: true });

    expect(result.operations).toEqual(expect.arrayContaining([expect.objectContaining({ status: "would-remove", vaultPath: storyProjectionPath })]));
    await expect(fs.pathExists(path.join(vaultRoot, storyProjectionPath))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(vaultRoot, projectionManifestPath))).resolves.toBe(true);
  });

  test("is a no-op when the in-project Obsidian view does not exist", async () => {
    const projectRoot = await seedProject();

    const result = await cleanInProjectObsidianView({ projectRoot });

    expect(result.noOpReason).toBe("Obsidian view does not exist");
    expect(result.operations).toEqual([]);
  });

  test("refuses to clean an existing view without a projection manifest", async () => {
    const projectRoot = await seedProject();
    const vaultRoot = resolveInProjectObsidianView(projectRoot);
    await fs.ensureDir(vaultRoot);
    await fs.writeFile(path.join(vaultRoot, "manual.md"), "# Manual vault\n", "utf8");

    await expect(cleanInProjectObsidianView({ projectRoot })).rejects.toThrow("without 投影清单.json");
    await expect(fs.readFile(path.join(vaultRoot, "manual.md"), "utf8")).resolves.toContain("Manual vault");
  });

  test("refuses to clean a view containing Git metadata", async () => {
    const projectRoot = await seedProject();
    const { vaultRoot } = await exportView(projectRoot);
    await fs.ensureDir(path.join(vaultRoot, ".git"));
    await fs.writeFile(path.join(vaultRoot, ".git", "config"), "[core]\n", "utf8");

    await expect(cleanInProjectObsidianView({ projectRoot })).rejects.toThrow("containing .git");
    await expect(fs.pathExists(path.join(vaultRoot, ".git", "config"))).resolves.toBe(true);
  });
});

describe("rebuildInProjectObsidianView", () => {
  test("cleans, exports, verifies, and preserves untracked user notes", async () => {
    const projectRoot = await seedOfficialExampleProject();
    const { vaultRoot, storyProjectionPath } = await exportView(projectRoot);
    const userNote = path.join(vaultRoot, "笔记", "manual-review.md");
    await fs.writeFile(userNote, "# 手写审阅\n\n这条笔记应该保留。\n", "utf8");
    await fs.appendFile(path.join(projectRoot, "01_概念策划", "故事内核.md"), "\n重建后应该出现在观看层。\n", "utf8");

    const result = await rebuildInProjectObsidianView({
      repoRoot: path.resolve(__dirname, "../../.."),
      projectRoot
    });

    expect(result.syncRan).toBe(true);
    expect(result.verificationIssues).toEqual([]);
    expect(result.exportResult.operations).toEqual(expect.arrayContaining([expect.objectContaining({ status: "created", vaultPath: storyProjectionPath })]));
    await expect(fs.readFile(path.join(vaultRoot, storyProjectionPath), "utf8")).resolves.toContain("重建后应该出现在观看层");
    await expect(fs.readFile(userNote, "utf8")).resolves.toContain("这条笔记应该保留");
    expect(renderRebuildViewSummary(result)).toContain("verification: passed");
  });

  test("dry-run does not sync, clean, export, or verify on disk", async () => {
    const projectRoot = await seedOfficialExampleProject();
    const { vaultRoot, storyProjectionPath } = await exportView(projectRoot);
    const before = await fs.readFile(path.join(vaultRoot, storyProjectionPath), "utf8");

    const result = await rebuildInProjectObsidianView({
      repoRoot: path.resolve(__dirname, "../../.."),
      projectRoot,
      dryRun: true
    });

    expect(result.syncPlanned).toBe(true);
    expect(result.syncRan).toBe(false);
    expect(result.clean.operations.some((operation) => operation.status === "would-remove")).toBe(true);
    await expect(fs.readFile(path.join(vaultRoot, storyProjectionPath), "utf8")).resolves.toBe(before);
    await expect(fs.pathExists(path.join(projectRoot, ".codex", "repo-context.md"))).resolves.toBe(true);
  });

  test("skip-sync rebuilds the view without restoring missing IDE runtime files", async () => {
    const projectRoot = await seedOfficialExampleProject();
    await exportView(projectRoot);
    await fs.remove(path.join(projectRoot, ".codex"));

    await expect(
      rebuildInProjectObsidianView({
        repoRoot: path.resolve(__dirname, "../../.."),
        projectRoot,
        skipSync: true
      })
    ).rejects.toThrow("Project must pass verify");
    await expect(fs.pathExists(path.join(projectRoot, ".codex"))).resolves.toBe(false);
  });
});
