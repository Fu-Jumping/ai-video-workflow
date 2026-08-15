import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { createProject } from "../src/lib/init.js";
import {
  cleanInProjectObsidianView,
  parseCleanViewFilter,
  rebuildInProjectObsidianView,
  renderCleanViewSummary,
  renderRebuildViewSummary
} from "../src/lib/maintenance.js";
import { exportObsidianVault } from "../src/lib/obsidian/export.js";
import { projectionManifestPath, readProjectionManifest } from "../src/lib/obsidian/manifest.js";
import { verifyObsidianVault } from "../src/lib/obsidian/verify.js";
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

function operationPaths(result: Awaited<ReturnType<typeof cleanInProjectObsidianView>>): string[] {
  return result.operations.map((operation) => operation.vaultPath).sort((left, right) => left.localeCompare(right));
}

describe("parseCleanViewFilter", () => {
  test("normalizes comma-separated and repeated filter values", () => {
    expect(
      parseCleanViewFilter({
        kinds: ["canvas,base", "dashboard"],
        steps: ["0", "4", "5"],
        shots: ["2", "shot-003", "镜头 002"],
      dirs: ["01_阶段审核/04_图片提示词/"],
        properties: ["源文件类型=图片提示词", "审阅状态=镜头审阅"]
      })
    ).toEqual({
      kinds: ["base", "canvas", "dashboard"],
      steps: [0, 4, 5],
      shots: ["shot-002", "shot-003"],
      dirs: ["01_阶段审核/04_图片提示词"],
      properties: [
        { key: "源文件类型", value: "图片提示词" },
        { key: "审阅状态", value: "镜头审阅" }
      ]
    });
  });

  test("rejects invalid filter values with readable errors", () => {
    expect(() => parseCleanViewFilter({ kinds: ["unknown"] })).toThrow("Invalid clean-view kind");
    expect(() => parseCleanViewFilter({ steps: ["7"] })).toThrow("Invalid clean-view step");
    expect(() => parseCleanViewFilter({ shots: ["shot-zero"] })).toThrow("Invalid clean-view shot");
    expect(() => parseCleanViewFilter({ dirs: ["../流程"] })).toThrow("Invalid clean-view dir");
    expect(() => parseCleanViewFilter({ dirs: ["流程\\步骤四"] })).toThrow("Invalid clean-view dir");
    expect(() => parseCleanViewFilter({ properties: ["源文件类型"] })).toThrow("Invalid clean-view property filter");
  });
});

describe("cleanInProjectObsidianView", () => {
  test("removes manifest-tracked generated files while preserving user-authored notes", async () => {
    const projectRoot = await seedProject();
    const { vaultRoot, storyProjectionPath } = await exportView(projectRoot);
    const userNote = path.join(vaultRoot, "04_个人笔记", "manual-review.md");
    await fs.writeFile(userNote, "# 手写审阅\n\n这条笔记应该保留。\n", "utf8");

    const result = await cleanInProjectObsidianView({ projectRoot });

    expect(result.operations).toEqual(expect.arrayContaining([expect.objectContaining({ status: "removed", vaultPath: storyProjectionPath })]));
    expect(result.preservedUntrackedFiles).toContain("04_个人笔记/manual-review.md");
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

  test("dry-run can be scoped to generated canvas files", async () => {
    const projectRoot = await seedOfficialExampleProject();
    const { vaultRoot } = await exportView(projectRoot);

    const result = await cleanInProjectObsidianView({
      projectRoot,
      dryRun: true,
      filter: parseCleanViewFilter({ kinds: ["canvas"] })
    });

    const paths = operationPaths(result);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths).toEqual(expect.arrayContaining(["03_审阅工具/全局画布/流程图.canvas", "02_按镜头联查/逐镜头审阅画布/shot-002.canvas"]));
    expect(paths.every((vaultPath) => vaultPath.endsWith(".canvas"))).toBe(true);
    expect(paths).not.toContain("00_开始审阅/00_项目首页.md");
    const summary = renderCleanViewSummary(result);
    expect(summary).toContain("cleanup risk: low");
    expect(summary).toContain("matched generated files by type:");
    expect(summary).toContain("canvas:");
    expect(summary).toContain("03_审阅工具/全局画布/流程图.canvas");
    expect(summary).not.toContain("00_开始审阅/00_项目首页.md");
    await expect(fs.pathExists(path.join(vaultRoot, "03_审阅工具", "全局画布", "流程图.canvas"))).resolves.toBe(true);
  });

  test("dry-run can be scoped by workflow step", async () => {
    const projectRoot = await seedOfficialExampleProject();
    await exportView(projectRoot);

    const result = await cleanInProjectObsidianView({
      projectRoot,
      dryRun: true,
      filter: parseCleanViewFilter({ steps: ["4"] })
    });

    const paths = operationPaths(result);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every((vaultPath) => vaultPath.startsWith("01_阶段审核/04_图片提示词/"))).toBe(true);
    expect(paths).not.toEqual(expect.arrayContaining([expect.stringContaining("03_分镜脚本")]));
    const summary = renderCleanViewSummary(result);
    expect(summary).toContain("cleanup risk: low");
    expect(summary).toContain("matched generated files by type:");
    expect(summary).toContain("workflow-notes: 4");
    expect(summary).toContain("01_阶段审核/04_图片提示词/镜头组-001/镜头 002 关键帧 01 - 图片提示词.md");
    expect(summary).toContain("next command:");
    expect(summary).toContain("clean-view --project");
    expect(summary).toContain("--step 4");
  });

  test("dry-run can be scoped to Step 0 research files", async () => {
    const projectRoot = await seedProject();
    await exportView(projectRoot);

    const result = await cleanInProjectObsidianView({
      projectRoot,
      dryRun: true,
      filter: parseCleanViewFilter({ steps: ["0"] })
    });

    const paths = operationPaths(result);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every((vaultPath) => vaultPath.startsWith("01_阶段审核/00_前期研究/"))).toBe(true);
    expect(renderCleanViewSummary(result)).toContain("  - step: 0");
  });

  test("dry-run can be scoped by shot id", async () => {
    const projectRoot = await seedOfficialExampleProject();
    await exportView(projectRoot);

    const result = await cleanInProjectObsidianView({
      projectRoot,
      dryRun: true,
      filter: parseCleanViewFilter({ shots: ["2"] })
    });

    const paths = operationPaths(result);
    expect(paths).toEqual(
      expect.arrayContaining([
        "02_按镜头联查/单镜头/shot-002.md",
        "02_按镜头联查/逐镜头审阅画布/shot-002.canvas",
        "01_阶段审核/03_分镜脚本/镜头组-001/镜头 002 - 分镜脚本.md",
        "01_阶段审核/04_图片提示词/镜头组-001/镜头 002 关键帧 01 - 图片提示词.md"
      ])
    );
    expect(paths).not.toEqual(expect.arrayContaining(["02_按镜头联查/单镜头/shot-001.md", "02_按镜头联查/逐镜头审阅画布/shot-001.canvas"]));
  });

  test("dry-run can be scoped by vault directory", async () => {
    const projectRoot = await seedOfficialExampleProject();
    await exportView(projectRoot);

    const result = await cleanInProjectObsidianView({
      projectRoot,
      dryRun: true,
      filter: parseCleanViewFilter({ dirs: ["01_阶段审核/04_图片提示词"] })
    });

    const paths = operationPaths(result);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every((vaultPath) => vaultPath.startsWith("01_阶段审核/04_图片提示词/"))).toBe(true);
  });

  test("dry-run can be scoped by generated Markdown property", async () => {
    const projectRoot = await seedOfficialExampleProject();
    await exportView(projectRoot);

    const result = await cleanInProjectObsidianView({
      projectRoot,
      dryRun: true,
      filter: parseCleanViewFilter({ properties: ["源文件类型=图片提示词"] })
    });

    const paths = operationPaths(result);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every((vaultPath) => vaultPath.startsWith("01_阶段审核/04_图片提示词/") && vaultPath.endsWith(".md"))).toBe(true);
    expect(paths).not.toContain("02_按镜头联查/单镜头/shot-002.md");
  });

  test("filtered clean updates the manifest and preserves untracked notes", async () => {
    const projectRoot = await seedOfficialExampleProject();
    const { vaultRoot } = await exportView(projectRoot);
    const userNote = path.join(vaultRoot, "04_个人笔记", "manual-review.md");
    await fs.writeFile(userNote, "# 手写审阅\n\n局部清理也应该保留。\n", "utf8");

    const result = await cleanInProjectObsidianView({
      projectRoot,
      filter: parseCleanViewFilter({ shots: ["shot-002"] })
    });

    const removedPaths = operationPaths(result).filter((vaultPath) => vaultPath.includes("shot-002") || vaultPath.includes("镜头-002"));
    const manifest = await readProjectionManifest(vaultRoot);
    expect(result.manifestUpdated).toBe(true);
    expect(removedPaths.length).toBeGreaterThan(0);
    expect(manifest?.files.map((entry) => entry.vaultPath)).not.toEqual(expect.arrayContaining(removedPaths));
    await expect(fs.pathExists(path.join(vaultRoot, projectionManifestPath))).resolves.toBe(true);
    await expect(fs.readFile(userNote, "utf8")).resolves.toContain("局部清理也应该保留");
    await expect(fs.pathExists(path.join(projectRoot, "04_图片提示词", "镜头组-001", "镜头-002-关键帧-01.md"))).resolves.toBe(true);
  });

  test("filtered clean is a no-op when generated files do not match", async () => {
    const projectRoot = await seedOfficialExampleProject();
    await exportView(projectRoot);

    const result = await cleanInProjectObsidianView({
      projectRoot,
      filter: parseCleanViewFilter({ properties: ["源文件类型=不存在"] })
    });

    expect(result.noOpReason).toBe("No generated files matched the clean filters");
    expect(result.operations).toEqual([]);
  });

  test("refuses unsafe paths recorded in the projection manifest", async () => {
    const projectRoot = await seedProject();
    const { vaultRoot } = await exportView(projectRoot);
    const outsideFile = path.join(vaultRoot, "..", "escape.md");
    const manifest = await readProjectionManifest(vaultRoot);
    await fs.writeFile(outsideFile, "# must remain\n", "utf8");
    await fs.writeJson(
      path.join(vaultRoot, projectionManifestPath),
      {
        ...manifest,
        files: [
          ...(manifest?.files ?? []),
          {
            vaultPath: "../escape.md",
            contentHash: "unsafe"
          }
        ]
      },
      { spaces: 2 }
    );

    await expect(cleanInProjectObsidianView({ projectRoot })).rejects.toThrow("Invalid Obsidian projection manifest entry path");
    await expect(fs.readFile(outsideFile, "utf8")).resolves.toContain("must remain");
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
    const userNote = path.join(vaultRoot, "04_个人笔记", "manual-review.md");
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

  test("filtered rebuild recreates only the matched missing projection files and verifies", async () => {
    const projectRoot = await seedOfficialExampleProject();
    const { vaultRoot } = await exportView(projectRoot);
    const shotTwoSource = path.join(projectRoot, "04_图片提示词", "镜头组-001", "镜头-002-关键帧-01.md");
    await fs.appendFile(shotTwoSource, "\n局部重建后应该出现在镜头 002 图片提示词观看层。\n", "utf8");

    const result = await rebuildInProjectObsidianView({
      repoRoot: path.resolve(__dirname, "../../.."),
      projectRoot,
      filter: parseCleanViewFilter({ shots: ["shot-002"] })
    });
    const updatedProjectionPath = result.exportResult.operations.find(
      (operation) => operation.status === "created" && operation.vaultPath.includes("镜头 002") && operation.vaultPath.includes("图片提示词")
    )?.vaultPath;

    expect(updatedProjectionPath).toBeDefined();
    await expect(fs.readFile(path.join(vaultRoot, ...(updatedProjectionPath ?? "").split("/")), "utf8")).resolves.toContain(
      "局部重建后应该出现在镜头 002 图片提示词观看层"
    );
    await expect(verifyObsidianVault({ projectRoot, vaultRoot })).resolves.toEqual({ ok: true, issues: [] });
  });
});
