import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { exportObsidianVault } from "../src/lib/obsidian/export.js";
import { hashContent, projectionManifestPath, readProjectionManifest, renderProjectionManifest } from "../src/lib/obsidian/manifest.js";
import { toVaultPath } from "../src/lib/obsidian/paths.js";
import { scanProjectForObsidian } from "../src/lib/obsidian/scan.js";
import type { ObsidianProjectionManifest } from "../src/lib/obsidian/types.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

function officialExampleRoot(): string {
  return path.resolve(__dirname, "..", "..", "..", "examples", "官方示例-云上早市");
}

function baseViewOrder(baseContent: string, viewName: string): string[] {
  const lines = baseContent.split(/\r?\n/);
  const nameIndex = lines.findIndex((line) => line.trim() === `name: ${viewName}`);
  expect(nameIndex, `Base view ${viewName} exists`).toBeGreaterThanOrEqual(0);
  const orderIndex = lines.findIndex((line, index) => index > nameIndex && line.trim() === "order:");
  expect(orderIndex, `Base view ${viewName} has an order`).toBeGreaterThanOrEqual(0);

  const order: string[] = [];
  for (let index = orderIndex + 1; index < lines.length; index += 1) {
    const match = lines[index].match(/^ {6}- (.+)$/);
    if (match) {
      order.push(match[1].trim());
      continue;
    }
    if (/^ {2}- type:/.test(lines[index]) || /^ {4}\S/.test(lines[index]) || /^[^\s]/.test(lines[index])) {
      break;
    }
  }
  return order;
}

function expectOnlyDefaultVisibleColumns(baseContent: string, viewNames: string[]): void {
  const defaultVisibleColumns = new Set([
    "标题",
    "镜头标题",
    "源文件路径",
    "源文件类型",
    "步骤名称",
    "审阅状态",
    "执行状态",
    "镜头索引",
    "审阅画布",
    "审阅笔记",
    "file.mtime"
  ]);

  for (const viewName of viewNames) {
    const order = baseViewOrder(baseContent, viewName);
    expect(order.every((column) => defaultVisibleColumns.has(column)), `${viewName} only uses user-approved default columns`).toBe(true);
  }
}

describe("Obsidian export paths", () => {
  test("normalizes Windows paths to vault-relative POSIX paths", () => {
    expect(toVaultPath(path.join("流程", "步骤三 - 分镜脚本", "镜头 001.md"))).toBe(
      "流程/步骤三 - 分镜脚本/镜头 001.md"
    );
  });
});

describe("Obsidian projection manifests", () => {
  test("hashes content and round-trips manifest JSON", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-manifest-"));
    tempRoots.push(outRoot);
    const manifest: ObsidianProjectionManifest = {
      schemaVersion: 1,
      generator: "ai-video-workflow",
      generatedAt: "2026-07-09T00:00:00.000Z",
      projectName: "demo",
      projectRoot: "demo",
      files: [
        {
          vaultPath: "流程/步骤一 - 概念策划/故事内核.md",
          sourcePath: "01_概念策划/故事内核.md",
          contentHash: hashContent("story")
        }
      ]
    };

    await fs.writeFile(path.join(outRoot, projectionManifestPath), renderProjectionManifest(manifest), "utf8");

    expect(hashContent("story")).toHaveLength(64);
    await expect(readProjectionManifest(outRoot)).resolves.toEqual(manifest);
  });
});

describe("scanProjectForObsidian", () => {
  test("scans the official example into workflow source files", async () => {
    const files = await scanProjectForObsidian(officialExampleRoot());

    expect(files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceKind: "research", step: 0 }),
        expect.objectContaining({ sourceKind: "concept", step: 1 }),
        expect.objectContaining({ sourceKind: "storyboard", step: 3, shotId: "shot-001", title: "镜头 001", headingTitle: "镜头 001：清晨前的邀请" }),
        expect.objectContaining({ sourceKind: "image-prompt", step: 4, shotId: "shot-001" }),
        expect.objectContaining({ sourceKind: "video-prompt", step: 5, shotId: "shot-001" }),
        expect.objectContaining({ sourceKind: "execution-plan", step: 6 })
      ])
    );
  });
});

describe("exportObsidianVault", () => {
  test("rejects missing, file, and incomplete projects before writing a vault", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-bad-projects-"));
    tempRoots.push(root);
    const missingProject = path.join(root, "missing");
    const fileProject = path.join(root, "project.md");
    const incompleteProject = path.join(root, "incomplete");
    const outRoot = path.join(root, "vault");
    await fs.writeFile(fileProject, "# Not a project\n", "utf8");
    await fs.ensureDir(incompleteProject);
    await fs.writeFile(path.join(incompleteProject, "project.config.yaml"), "pack: official-ai-video\n", "utf8");

    await expect(exportObsidianVault({ projectRoot: missingProject, outRoot, force: false, includePluginRecipes: true })).rejects.toThrow("does not exist");
    await expect(exportObsidianVault({ projectRoot: fileProject, outRoot, force: false, includePluginRecipes: true })).rejects.toThrow("must be a directory");
    await expect(exportObsidianVault({ projectRoot: incompleteProject, outRoot, force: false, includePluginRecipes: true })).rejects.toThrow("project.config.yaml");
    await expect(fs.pathExists(outRoot)).resolves.toBe(false);
  });

  test("rejects empty Step projects before writing a vault", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-empty-source-"));
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-empty-vault-"));
    tempRoots.push(projectRoot, outRoot);
    await fs.copy(officialExampleRoot(), projectRoot);
    for (const stepDir of ["01_概念策划", "02_世界设定", "03_分镜脚本", "04_图片提示词", "05_视频提示词", "06_执行计划"]) {
      await fs.emptyDir(path.join(projectRoot, stepDir));
    }

    await expect(exportObsidianVault({ projectRoot, outRoot, force: false, includePluginRecipes: true })).rejects.toThrow("Project must pass verify");
  });

  test("rejects output paths that are files or ordinary project-internal directories", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-output-safety-"));
    tempRoots.push(projectRoot);
    await fs.copy(officialExampleRoot(), projectRoot);
    const fileOut = path.join(path.dirname(projectRoot), "vault.md");
    const internalOut = path.join(projectRoot, "notes-vault");
    const inProjectPathAsOut = path.join(projectRoot, "_views", "obsidian");
    await fs.writeFile(fileOut, "# Not a vault\n", "utf8");
    tempRoots.push(fileOut);

    await expect(exportObsidianVault({ projectRoot, outRoot: fileOut, force: false, includePluginRecipes: true })).rejects.toThrow("must be a directory");
    await expect(exportObsidianVault({ projectRoot, outRoot: internalOut, force: false, includePluginRecipes: true })).rejects.toThrow("--in-project-view");
    await expect(exportObsidianVault({ projectRoot, outRoot: inProjectPathAsOut, force: false, includePluginRecipes: true })).rejects.toThrow("--in-project-view");
    if (process.platform === "win32") {
      const parentOut = path.dirname(projectRoot);
      const differentlyCasedParentOut = parentOut.toUpperCase() === parentOut ? parentOut.toLowerCase() : parentOut.toUpperCase();
      await expect(exportObsidianVault({ projectRoot, outRoot: differentlyCasedParentOut, force: false, includePluginRecipes: true })).rejects.toThrow(
        "project parent"
      );
    }
  });

  test("force dry-run reports nested Git risk and force rejects non-manifest directories", async () => {
    const gitVault = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-force-git-dry-"));
    const plainVault = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-force-plain-"));
    tempRoots.push(gitVault, plainVault);
    await fs.ensureDir(path.join(gitVault, ".git"));
    await fs.writeFile(path.join(gitVault, ".git", "config"), "[core]\n", "utf8");
    await fs.writeFile(path.join(plainVault, "manual.md"), "# Manual\n", "utf8");

    await expect(
      exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot: gitVault, force: true, includePluginRecipes: true, dryRun: true })
    ).rejects.toThrow("containing .git");
    await expect(
      exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot: plainVault, force: true, includePluginRecipes: true })
    ).rejects.toThrow("without 投影清单.json");
    await expect(fs.pathExists(path.join(gitVault, ".git", "config"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(plainVault, "manual.md"))).resolves.toBe(true);
  });

  test("writes a privacy-safe schema v2 manifest for in-project view exports", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-in-project-manifest-"));
    tempRoots.push(projectRoot);
    await fs.copy(officialExampleRoot(), projectRoot);
    const outRoot = path.join(projectRoot, "_views", "obsidian");

    await exportObsidianVault({ projectRoot, outRoot, force: true, includePluginRecipes: true, inProjectView: true });

    const manifest = await readProjectionManifest(outRoot);
    const manifestJson = JSON.stringify(manifest);
    expect(manifest).toEqual(
      expect.objectContaining({
        schemaVersion: 2,
        viewMode: "in-project-view",
        projectRoot: ".",
        projectRootRelativePath: "../.."
      })
    );
    expect(manifest?.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          vaultPath: "流程/步骤三 - 分镜脚本/镜头 001 - 分镜脚本.md",
          sourcePath: "03_分镜脚本/镜头-001.md",
          sourceContentHash: expect.any(String)
        })
      ])
    );
    expect(manifestJson).not.toMatch(/(^|[^A-Za-z])[A-Za-z]:[\\/]|file:\/\/|vscode:\/\//i);
  });

  test("writes a privacy-safe schema v2 manifest for external vault exports", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-external-manifest-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });

    const manifest = await readProjectionManifest(outRoot);
    const manifestJson = JSON.stringify(manifest);
    expect(manifest).toEqual(
      expect.objectContaining({
        schemaVersion: 2,
        viewMode: "external-vault",
        projectRoot: "."
      })
    );
    expect(manifest?.projectRootRelativePath).toBeUndefined();
    expect(manifestJson).not.toMatch(/(^|[^A-Za-z])[A-Za-z]:[\\/]|file:\/\/|vscode:\/\//i);
  });

  test("exports generated workflow notes with provenance frontmatter", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });

    const storyboard = await fs.readFile(path.join(outRoot, "流程", "步骤三 - 分镜脚本", "镜头 001 - 分镜脚本.md"), "utf8");
    expect(storyboard).toContain("投影生成: 是");
    expect(storyboard).toContain("工作流包: official-ai-video");
    expect(storyboard).toContain('标题: "镜头 001：清晨前的邀请"');
    expect(storyboard).toContain('镜头标题: "镜头 001：清晨前的邀请"');
    expect(storyboard).toContain("下一步: 审阅镜头画面");
    expect(storyboard).toContain("源文件路径: 03_分镜脚本/镜头-001.md");
    expect(storyboard).toContain("源文件类型: 分镜脚本");
    expect(storyboard).toContain('参考资产: "@沈安三视图、@小满三视图、@小镇修伞铺场景图"');
    expect(storyboard).toContain("阶段: 镜头审阅");
    expect(storyboard).toContain("审阅状态: 镜头审阅");
    expect(storyboard).toContain("执行状态: 不适用");
    expect(storyboard).toContain("需要关注: 否");
    expect(storyboard).toContain("镜头顺序: 1");
    expect(storyboard).toContain('镜头索引: "[[镜头/shot-001|镜头 001：清晨前的邀请]]"');
    expect(storyboard).toContain("> 源文件：`03_分镜脚本/镜头-001.md`");
    expect(storyboard).toContain("镜头：[[镜头/shot-001|镜头 001：清晨前的邀请]]");
    expect(storyboard).toContain("对应步骤四：[[流程/步骤四 - 图片提示词/镜头 001 关键帧 - 图片提示词|镜头 001 关键帧图片提示词]]");
    expect(storyboard).not.toContain("流程/步骤四 - 图片提示词/镜头 001 关键帧 - 图片提示词.md|镜头 001 关键帧图片提示词");
    expect(storyboard).not.toContain("](../04_图片提示词/镜头-001-关键帧.md)");
    expect(storyboard).not.toContain('镜头索引: "[[shot-001]]"');
    expect(storyboard).not.toContain("- 镜头索引：[[shot-001]]");
    expect(storyboard).not.toContain("## Obsidian 导航");
    expect(storyboard).not.toContain("projection_generated:");
    expect(storyboard).not.toContain("source_path:");
    expect(storyboard).not.toContain("review_status:");
    expect(storyboard).toContain("ai-video/step/03-storyboard");
    expect(storyboard).toContain("tags:");
    expect(storyboard).toContain("[[01_审阅总览|审阅总览]]");
    const imagePrompt = await fs.readFile(path.join(outRoot, "流程", "步骤四 - 图片提示词", "镜头 001 关键帧 - 图片提示词.md"), "utf8");
    expect(imagePrompt).toContain("[[流程/步骤三 - 分镜脚本/镜头 001 - 分镜脚本]]");
    expect(imagePrompt).not.toContain("[[../03_分镜脚本/镜头-001.md]]");
    const researchBrief = await fs.readFile(path.join(outRoot, "流程", "步骤零 - 前期研究", "04 创作简报.md"), "utf8");
    expect(researchBrief).toContain("源文件类型: 前期研究");
    expect(researchBrief).toContain("源文件路径: 00_前期研究/04_创作简报.md");
    expect(researchBrief).toContain("ai-video/step/00-research");
    await expect(fs.pathExists(path.join(outRoot, projectionManifestPath))).resolves.toBe(true);
  });

  test("exports Obsidian dashboards with numbered sections and embedded Bases", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-dashboard-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });

    const home = await fs.readFile(path.join(outRoot, "00_项目首页.md"), "utf8");
    expect(home).toContain("## 1. 打开路线");
    expect(home).toContain("看项目状态");
    expect(home).toContain("逐镜头检查");
    expect(home).toContain("需要智能体修改");
    expect(home).toContain("## 2. 审阅入口");
    expect(home).toContain("## 3. 镜头入口");
    expect(home).toContain("[[04_智能体交接|智能体交接]]");
    expect(home).toContain("## 4. 项目状态");
    expect(home).toContain("### 4.1 审阅队列");
    expect(home).toContain("### 4.2 镜头进度");
    expect(home).toContain("### 4.3 执行就绪");
    expect(home).toContain("## 5. 画布与数据");
    expect(home).toContain("### 5.1 画布导航");
    expect(home).toContain("### 5.2 数据表入口");
    expect(home).toContain("![[数据表/流程文件.base#流程文件]]");
    expect(home).toContain("![[数据表/流程文件.base#审阅队列]]");
    expect(home).toContain("![[画布/流程图.canvas]]");
    expect(home).toContain("[[画布/审阅地图.canvas|审阅地图]]");
    expect(home).toContain("[[笔记/说明|用户笔记]]");
    expect(home).not.toContain("笔记/README");
    expect(home).not.toContain("生成文件冲突检查");
    expect(home).not.toContain("## 打开观看层后的流程");
    expect(home).not.toContain("## 审阅总控");
    expect(home).not.toContain("## 项目健康");
    expect(home).not.toContain("```query");
    expect(home).not.toContain("skipped-user-modified");

    const reviewDashboard = await fs.readFile(path.join(outRoot, "01_审阅总览.md"), "utf8");
    expect(reviewDashboard).toContain("## 1. 需要关注");
    expect(reviewDashboard).toContain("## 2. 执行就绪");
    expect(reviewDashboard).toContain("## 3. 审阅地图");
    expect(reviewDashboard).toContain("## 4. 镜头审阅画布");
    expect(reviewDashboard).not.toContain("生成文件冲突");
    expect(reviewDashboard).not.toContain("verify-obsidian");
    expect(reviewDashboard).not.toContain("智能体交接");

    const shotIndex = await fs.readFile(path.join(outRoot, "02_镜头索引.md"), "utf8");
    expect(shotIndex).toContain("## 1. 镜头入口");
    expect(shotIndex).toContain("## 2. 镜头表");
    expect(shotIndex).toContain("## 3. 镜头进度");
    expect(shotIndex).toContain("## 4. 沉浸式审阅表");

    const productionBoard = await fs.readFile(path.join(outRoot, "03_制作看板.md"), "utf8");
    expect(productionBoard).toContain("## 1. 执行就绪");
    expect(productionBoard).toContain("## 2. 制作状态");
    expect(productionBoard).toContain("## 3. 镜头进度");
    expect(productionBoard).toContain("## 4. 导航");

    const reviewTemplate = await fs.readFile(path.join(outRoot, "模板", "审阅笔记模板.md"), "utf8");
    expect(reviewTemplate).toContain("## 1. 发现");
    expect(reviewTemplate).toContain("## 2. 源文件链接");
    expect(reviewTemplate).toContain("## 3. 后续动作");

    const shotTemplate = await fs.readFile(path.join(outRoot, "模板", "镜头跟进模板.md"), "utf8");
    expect(shotTemplate).toContain("## 1. 镜头");
    expect(shotTemplate).toContain("## 2. 问题");
    expect(shotTemplate).toContain("## 3. 下一步");

    const pluginRecipes = await fs.readFile(path.join(outRoot, "社区插件配方.md"), "utf8");
    expect(pluginRecipes).toContain("## 1. Dataview");
    expect(pluginRecipes).toContain("## 2. Tasks");
    expect(pluginRecipes).toContain("## 3. Kanban");
    expect(pluginRecipes).toContain("## 4. Excalidraw");
  });

  test("exports a generated README with an open-vault path", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-readme-path-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });

    const readme = await fs.readFile(path.join(outRoot, "说明.md"), "utf8");
    expect(readme).toContain("[[00_项目首页]]");
    expect(readme).toContain("[[02_镜头索引]]");
    expect(readme).toContain("[[04_智能体交接]]");
    expect(readme).toContain("[[03_制作看板]]");
    expect(readme).toContain("[[笔记/说明]]");
    expect(readme).not.toContain("不要把生成的观看层文件当作事实源");
  });

  test("exports project-level agent handoff guidance", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-agent-handoff-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });

    const handoff = await fs.readFile(path.join(outRoot, "04_智能体交接.md"), "utf8");
    expect(handoff).toContain("# 智能体交接");
    expect(handoff).toContain("## 1. 导航");
    expect(handoff).toContain("## 2. 单镜头交接");
    expect(handoff).toContain("## 3. 源文件编辑边界");
    expect(handoff).toContain("## 4. 可复制提示词");
    expect(handoff).toContain("## 5. 验证命令");
    expect(handoff).toContain("### 2.1 [[镜头/shot-001|镜头 001：清晨前的邀请]]");
    expect(handoff).toContain("### 4.1 单镜头检查");
    expect(handoff).toContain("只编辑步骤源文件");
    expect(handoff).toContain("不要编辑生成的 Obsidian 观看层文件");
    expect(handoff).toContain("node apps/cli/dist/index.js verify --project <project-path> --ide codex");
    expect(handoff).toContain("[[镜头/shot-001|镜头 001：清晨前的邀请]]");
    expect(handoff).toContain("分镜脚本源文件：`03_分镜脚本/镜头-001.md`");
    expect(handoff).toContain("步骤四图片提示词源文件：`04_图片提示词/镜头-001-关键帧.md`");
    expect(handoff).toContain("步骤五视频提示词源文件：`05_视频提示词/镜头-001.md`");
    expect(handoff).toContain("必带参考资产：@沈安三视图、@小满三视图、@小镇修伞铺场景图");
    expect(handoff).toContain("检查 Step 4 是否携带单镜头交接中的全部 `@xx三视图` / `@xx场景图`。");
    expect(handoff).toContain("检查 Step 5 是否延续单镜头交接中的全部 `@xx三视图` / `@xx场景图`。");
    expect(handoff).toContain("检查 Step 5 是否写清默认视频平台、输入方式、开场参考、时长上限、画幅和负面约束。");
    expect(handoff).not.toContain("[[镜头/shot-001|shot-001]]");
  });

  test("exports immersive single-shot review pages", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-shot-review-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });

    const shotReview = await fs.readFile(path.join(outRoot, "镜头", "shot-001.md"), "utf8");
    expect(shotReview).toContain('标题: "镜头 001：清晨前的邀请"');
    expect(shotReview).toContain('镜头标题: "镜头 001：清晨前的邀请"');
    expect(shotReview).toContain("下一步: 检查镜头对齐");
    expect(shotReview).toContain("审阅模式: 沉浸式");
    expect(shotReview).toContain('审阅画布: "[[画布/镜头审阅/shot-001.canvas]]"');
    expect(shotReview).toContain('审阅笔记: "[[笔记/镜头审阅/shot-001]]"');
    expect(shotReview).toContain("有分镜脚本: 是");
    expect(shotReview).toContain("有图片提示词: 是");
    expect(shotReview).toContain("有视频提示词: 是");
    expect(shotReview).toContain('智能体交接: "[[04_智能体交接#2. 单镜头交接|智能体交接]]"');
    expect(shotReview).not.toContain("review_mode:");
    expect(shotReview).not.toContain("review_note:");
    expect(shotReview).not.toContain("has_storyboard:");
    expect(shotReview).not.toContain("agent_handoff:");
    expect(shotReview).toContain("## 1. 快速审阅");
    expect(shotReview).toContain("## 2. 审阅路径");
    expect(shotReview).toContain("## 3. 参考资产");
    expect(shotReview).toContain("必带参考资产：@沈安三视图、@小满三视图、@小镇修伞铺场景图");
    expect(shotReview).toContain("## 4. 源文件序列");
    expect(shotReview).toContain("## 5. 画面连续性");
    expect(shotReview).toContain("## 6. 视频提示词");
    expect(shotReview).toContain("## 7. 执行检查");
    expect(shotReview).toContain("Step 5 已延续同镜头 Step 4 的角色三视图和场景图。");
    expect(shotReview).toContain("Step 5 已写清默认视频平台、输入方式、开场参考、时长上限、画幅和负面约束。");
    expect(shotReview).toContain("## 8. 修改入口");
    expect(shotReview).toContain("## 9. 数据视图");
    expect(shotReview).toContain("### 9.1 镜头记录");
    expect(shotReview).toContain("### 9.2 进度视图");
    expect(shotReview).toContain("[[04_智能体交接#2. 单镜头交接|智能体交接]]");
    expect(shotReview).not.toContain("## 沉浸式审阅");
    expect(shotReview).not.toContain("## 智能体交接");
    expect(shotReview).not.toContain("可复制提示词");
    expect(shotReview).not.toContain("验证命令");
    expect(shotReview).toContain("## 10. 审阅画布");
    expect(shotReview).toContain("![[流程/步骤三 - 分镜脚本/镜头 001 - 分镜脚本]]");
    expect(shotReview).toContain("![[流程/步骤四 - 图片提示词/镜头 001 关键帧 - 图片提示词]]");
    expect(shotReview).toContain("![[流程/步骤五 - 视频提示词/镜头 001 - 视频提示词]]");
    expect(shotReview).toContain("# 镜头 001：清晨前的邀请");
    expect(shotReview).toContain("[[笔记/镜头审阅/shot-001|镜头 001：清晨前的邀请 审阅笔记]]");
    expect(shotReview).not.toContain("[[笔记/镜头审阅/shot-001|笔记/镜头审阅/shot-001]]");
    expect(shotReview).toContain("03_分镜脚本/镜头-001.md");
    expect(shotReview).not.toContain("04_图片提示词/镜头-001-关键帧.md");
    expect(shotReview).not.toContain("05_视频提示词/镜头-001.md");
    expect(shotReview).not.toContain("不要编辑生成的 Obsidian 观看层文件");
  });

  test("exports Obsidian Bases for workflow files and shots", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-bases-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });

    const shotsBase = await fs.readFile(path.join(outRoot, "数据表", "镜头.base"), "utf8");
    expect(shotsBase).toContain("file.hasTag(\"ai-video/shot\")");
    expect(shotsBase).toContain("type: table");
    expect(shotsBase).toContain("type: cards");
    expect(shotsBase).toContain("镜头进度");
    expect(shotsBase).toContain("沉浸式审阅");
    expect(shotsBase).toContain("智能体交接");
    expect(shotsBase).toContain("标题:");
    expect(shotsBase).toContain("镜头标题:");
    expect(shotsBase).toContain("下一步:");
    expect(shotsBase).toContain("镜头ID:");
    expect(shotsBase).toContain("智能体交接:");
    expect(shotsBase).toContain("审阅画布:");
    expect(shotsBase).toContain("审阅笔记:");
    expect(shotsBase).toContain("参考资产:");
    expect(shotsBase).toContain("file.mtime:");
    expect(shotsBase).toContain("displayName: 最近修改时间");
    expect(shotsBase).toContain("property: 镜头标题");
    expect(baseViewOrder(shotsBase, "镜头表")).toEqual([
      "标题",
      "镜头标题",
      "源文件路径",
      "源文件类型",
      "步骤名称",
      "审阅状态",
      "执行状态",
      "镜头索引",
      "审阅画布",
      "审阅笔记",
      "file.mtime"
    ]);
    expect(baseViewOrder(shotsBase, "镜头卡片")).toEqual(["镜头标题", "标题", "审阅状态", "执行状态", "审阅画布", "审阅笔记", "file.mtime"]);
    expectOnlyDefaultVisibleColumns(shotsBase, ["镜头表", "镜头卡片", "镜头进度", "沉浸式审阅", "智能体交接"]);
    expect(shotsBase).not.toContain("shot_id:");
    expect(shotsBase).not.toContain("agent_handoff");

    const workflowBase = await fs.readFile(path.join(outRoot, "数据表", "流程文件.base"), "utf8");
    expect(workflowBase).toContain("标题:");
    expect(workflowBase).toContain("镜头标题:");
    expect(workflowBase).toContain("下一步:");
    expect(workflowBase).toContain("审阅队列");
    expect(workflowBase).toContain("已改动生成文件");
    expect(workflowBase).toContain("property: 审阅状态");
    expect(workflowBase).toContain("file.mtime:");
    expect(workflowBase).toContain("displayName: 最近修改时间");
    expect(baseViewOrder(workflowBase, "流程文件")).toEqual([
      "标题",
      "镜头标题",
      "源文件路径",
      "源文件类型",
      "步骤名称",
      "审阅状态",
      "执行状态",
      "镜头索引",
      "file.mtime"
    ]);
    expect(baseViewOrder(workflowBase, "审阅列表")).toEqual(["标题", "审阅状态", "执行状态"]);
    expectOnlyDefaultVisibleColumns(workflowBase, ["流程文件", "审阅列表", "审阅队列", "已改动生成文件"]);
    expect(workflowBase).toContain("'投影生成 == \"是\"'");
    expect(workflowBase).not.toContain("projection_generated");

    const productionBase = await fs.readFile(path.join(outRoot, "数据表", "制作状态.base"), "utf8");
    expect(productionBase).toContain("标题:");
    expect(productionBase).toContain("镜头标题:");
    expect(productionBase).toContain("下一步:");
    expect(productionBase).toContain("执行就绪");
    expect(productionBase).toContain("property: 执行状态");
    expect(productionBase).toContain("file.mtime:");
    expect(productionBase).toContain("displayName: 最近修改时间");
    expect(baseViewOrder(productionBase, "制作状态")).toEqual([
      "标题",
      "镜头标题",
      "源文件路径",
      "源文件类型",
      "步骤名称",
      "审阅状态",
      "执行状态",
      "镜头索引",
      "审阅画布",
      "审阅笔记",
      "file.mtime"
    ]);
    expect(baseViewOrder(productionBase, "执行就绪")).toEqual([
      "标题",
      "镜头标题",
      "源文件路径",
      "源文件类型",
      "步骤名称",
      "执行状态",
      "审阅状态",
      "镜头索引",
      "审阅画布",
      "审阅笔记",
      "file.mtime"
    ]);
    expectOnlyDefaultVisibleColumns(productionBase, ["制作状态", "执行就绪"]);
  });

  test("exports valid JSON Canvas maps", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-canvas-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });

    const workflowMap = await fs.readJson(path.join(outRoot, "画布", "流程图.canvas"));
    expect(workflowMap.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ type: "group", label: "步骤 3" })]));
    expect(workflowMap.edges.length).toBeGreaterThan(0);
    const workflowStep3Group = workflowMap.nodes.find((node: { label?: string }) => node.label === "步骤 3");
    expect(workflowStep3Group.width).toBeGreaterThanOrEqual(560);
    expect(workflowStep3Group.height).toBeGreaterThanOrEqual(900);
    const workflowStoryboard = workflowMap.nodes.find((node: { file?: string }) => node.file === "流程/步骤三 - 分镜脚本/镜头 001 - 分镜脚本.md");
    expect(workflowStoryboard.width).toBeGreaterThanOrEqual(480);
    expect(workflowStoryboard.height).toBeGreaterThanOrEqual(170);

    const shotPipeline = await fs.readJson(path.join(outRoot, "画布", "镜头流水线.canvas"));
    expect(shotPipeline.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ type: "file" })]));
    expect(shotPipeline.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ type: "group", label: "镜头 001：清晨前的邀请" })]));
    const shotPipelineGroup = shotPipeline.nodes.find((node: { label?: string }) => node.label === "镜头 001：清晨前的邀请");
    expect(shotPipelineGroup.width).toBeGreaterThanOrEqual(2000);
    expect(shotPipelineGroup.height).toBeGreaterThanOrEqual(520);
    const pipelineStoryboard = shotPipeline.nodes.find((node: { file?: string }) => node.file === "流程/步骤三 - 分镜脚本/镜头 001 - 分镜脚本.md");
    const pipelineImagePrompt = shotPipeline.nodes.find((node: { file?: string }) => node.file === "流程/步骤四 - 图片提示词/镜头 001 关键帧 - 图片提示词.md");
    expect(pipelineStoryboard.width).toBeGreaterThanOrEqual(520);
    expect(pipelineStoryboard.height).toBeGreaterThanOrEqual(200);
    expect(pipelineImagePrompt.x - pipelineStoryboard.x).toBeGreaterThanOrEqual(640);

    const reviewMap = await fs.readJson(path.join(outRoot, "画布", "审阅地图.canvas"));
    expect(reviewMap.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ type: "file", file: "00_项目首页.md" })]));
    expect(reviewMap.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ type: "file", file: "数据表/流程文件.base" })]));
    expect(reviewMap.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ type: "file", file: "04_智能体交接.md" })]));
    expect(reviewMap.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ type: "file", file: "笔记/说明.md" })]));
    expect(reviewMap.edges.length).toBeGreaterThan(0);
    const reviewHome = reviewMap.nodes.find((node: { file?: string }) => node.file === "00_项目首页.md");
    const reviewShotIndex = reviewMap.nodes.find((node: { file?: string }) => node.file === "02_镜头索引.md");
    expect(reviewHome.width).toBeGreaterThanOrEqual(460);
    expect(reviewHome.height).toBeGreaterThanOrEqual(170);
    expect(reviewShotIndex.x - reviewHome.x).toBeGreaterThanOrEqual(700);

    const shotReview = await fs.readJson(path.join(outRoot, "画布", "镜头审阅", "shot-001.canvas"));
    expect(shotReview.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ type: "file", file: "镜头/shot-001.md" })]));
    expect(shotReview.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ type: "file", file: "03_制作看板.md" })]));
    expect(shotReview.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ type: "file", file: "笔记/说明.md" })]));
    expect(shotReview.nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "file", file: "流程/步骤三 - 分镜脚本/镜头 001 - 分镜脚本.md" })])
    );
    expect(shotReview.nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "file", file: "流程/步骤四 - 图片提示词/镜头 001 关键帧 - 图片提示词.md" })])
    );
    expect(shotReview.nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "file", file: "流程/步骤五 - 视频提示词/镜头 001 - 视频提示词.md" })])
    );
    expect(shotReview.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ type: "text", text: expect.stringContaining("@沈安三视图") })]));
    expect(
      shotReview.nodes
        .filter((node: { type?: string }) => node.type === "file")
        .every((node: { file?: string }) => node.file && !path.isAbsolute(node.file) && !node.file.includes(":\\") && !node.file.includes(":/"))
    ).toBe(true);
    const shotReviewHub = shotReview.nodes.find((node: { id?: string }) => node.id === "shot-review");
    const shotReviewStoryboard = shotReview.nodes.find((node: { id?: string }) => node.id === "storyboard");
    const shotReviewImagePrompt = shotReview.nodes.find((node: { id?: string }) => node.id === "image-prompt");
    const shotReviewNotes = shotReview.nodes.find((node: { id?: string }) => node.id === "notes");
    const shotReviewReferenceAssets = shotReview.nodes.find((node: { id?: string }) => node.id === "reference-assets");
    expect(shotReviewHub.width).toBeGreaterThanOrEqual(500);
    expect(shotReviewHub.height).toBeGreaterThanOrEqual(200);
    expect(shotReviewStoryboard.width).toBeGreaterThanOrEqual(520);
    expect(shotReviewStoryboard.height).toBeGreaterThanOrEqual(240);
    expect(shotReviewStoryboard.x - (shotReviewHub.x + shotReviewHub.width)).toBeGreaterThanOrEqual(280);
    expect(shotReviewImagePrompt.x - (shotReviewStoryboard.x + shotReviewStoryboard.width)).toBeGreaterThanOrEqual(260);
    expect(shotReviewNotes.y - (shotReviewHub.y + shotReviewHub.height)).toBeGreaterThanOrEqual(100);
    expect(shotReviewReferenceAssets.width).toBeGreaterThanOrEqual(680);
    expect(shotReviewReferenceAssets.y - (shotReviewHub.y + shotReviewHub.height)).toBeGreaterThanOrEqual(100);
    expect(shotReview.edges).toEqual(expect.arrayContaining([expect.objectContaining({ label: "审阅起点 / 画面" })]));
    expect(shotReview.edges).toEqual(expect.arrayContaining([expect.objectContaining({ label: "参考资产" })]));
  });

  test("preserves user-authored notes during incremental export", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-incremental-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });
    const userNote = path.join(outRoot, "笔记", "manual-review.md");
    await fs.writeFile(userNote, "# Manual Review\n\nKeep this note.\n", "utf8");
    const result = await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: false, includePluginRecipes: true });

    await expect(fs.readFile(userNote, "utf8")).resolves.toContain("Keep this note.");
    expect(result.operations).toEqual(expect.arrayContaining([expect.objectContaining({ status: "unchanged", vaultPath: "00_项目首页.md" })]));
  });

  test("skips user-modified generated files by default", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-conflict-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });
    const generatedFile = path.join(outRoot, "流程", "步骤三 - 分镜脚本", "镜头 001 - 分镜脚本.md");
    await fs.appendFile(generatedFile, "\nUser edit inside Obsidian.\n", "utf8");
    const result = await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: false, includePluginRecipes: true });

    expect(result.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "skipped-user-modified",
          vaultPath: "流程/步骤三 - 分镜脚本/镜头 001 - 分镜脚本.md"
        })
      ])
    );
    await expect(fs.readFile(generatedFile, "utf8")).resolves.toContain("User edit inside Obsidian.");
  });

  test("updates generated files when source files change and generated files are untouched", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-project-"));
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-update-"));
    tempRoots.push(projectRoot, outRoot);
    await fs.copy(officialExampleRoot(), projectRoot);

    await exportObsidianVault({ projectRoot, outRoot, force: true, includePluginRecipes: true });
    await fs.appendFile(path.join(projectRoot, "03_分镜脚本", "镜头-001.md"), "\nUpdated source beat.\n", "utf8");
    const result = await exportObsidianVault({ projectRoot, outRoot, force: false, includePluginRecipes: true });
    const generatedFile = path.join(outRoot, "流程", "步骤三 - 分镜脚本", "镜头 001 - 分镜脚本.md");

    expect(result.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "updated",
          vaultPath: "流程/步骤三 - 分镜脚本/镜头 001 - 分镜脚本.md"
        })
      ])
    );
    await expect(fs.readFile(generatedFile, "utf8")).resolves.toContain("Updated source beat.");
  });

  test("force export rebuilds the vault projection", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-force-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });
    const userNote = path.join(outRoot, "笔记", "manual-review.md");
    await fs.writeFile(userNote, "# Manual Review\n", "utf8");
    const result = await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });

    await expect(fs.pathExists(userNote)).resolves.toBe(false);
    expect(result.operations.every((operation) => operation.status === "created")).toBe(true);
  });

  test("force export refuses to remove an output directory containing .git", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-force-git-"));
    tempRoots.push(outRoot);
    await fs.ensureDir(path.join(outRoot, ".git"));
    await fs.writeFile(path.join(outRoot, ".git", "config"), "[core]\n", "utf8");

    await expect(
      exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true })
    ).rejects.toThrow("Refusing to force-remove an Obsidian output directory containing .git");
    await expect(fs.pathExists(path.join(outRoot, ".git", "config"))).resolves.toBe(true);
  });

  test("dry-run reports operations without writing files", async () => {
    const parentRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-dry-run-"));
    tempRoots.push(parentRoot);
    const outRoot = path.join(parentRoot, "vault");

    const result = await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: false, includePluginRecipes: true, dryRun: true });

    expect(result.operations).toEqual(expect.arrayContaining([expect.objectContaining({ status: "created", vaultPath: "00_项目首页.md" })]));
    await expect(fs.pathExists(outRoot)).resolves.toBe(false);
  });

  test("does not write Obsidian UI config by default", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-ui-default-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });

    await expect(fs.pathExists(path.join(outRoot, ".obsidian"))).resolves.toBe(false);
  });

  test("writes opt-in Obsidian UI suggestion config", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-ui-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true, includeObsidianUi: true });

    await expect(fs.pathExists(path.join(outRoot, ".obsidian", "bookmarks.json"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(outRoot, ".obsidian", "workspace.json"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(outRoot, ".obsidian", "core-plugins.json"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(outRoot, ".obsidian", "appearance.json"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(outRoot, ".obsidian", "ai-video-workflow-suggested", "bookmarks.json"))).resolves.toBe(true);

    const bookmarks = await fs.readJson(path.join(outRoot, ".obsidian", "bookmarks.json"));
    expect(JSON.stringify(bookmarks)).toContain("00_项目首页.md");
    expect(JSON.stringify(bookmarks)).toContain("04_智能体交接.md");
    expect(JSON.stringify(bookmarks)).toContain("02_镜头索引.md");
    expect(JSON.stringify(bookmarks)).toContain("03_制作看板.md");
    expect(JSON.stringify(bookmarks)).toContain("画布/审阅地图.canvas");
    expect(JSON.stringify(bookmarks)).toContain("画布/镜头流水线.canvas");
    expect(JSON.stringify(bookmarks)).toContain("笔记/说明.md");
    expect(JSON.stringify(bookmarks)).not.toContain("笔记/README.md");

    const suggestedBookmarks = await fs.readJson(path.join(outRoot, ".obsidian", "ai-video-workflow-suggested", "bookmarks.json"));
    expect(JSON.stringify(suggestedBookmarks)).toContain("00_项目首页.md");
    expect(JSON.stringify(suggestedBookmarks)).toContain("04_智能体交接.md");
    expect(JSON.stringify(suggestedBookmarks)).toContain("02_镜头索引.md");
    expect(JSON.stringify(suggestedBookmarks)).toContain("03_制作看板.md");
    expect(JSON.stringify(suggestedBookmarks)).toContain("画布/审阅地图.canvas");
    expect(JSON.stringify(suggestedBookmarks)).toContain("画布/镜头流水线.canvas");
    expect(JSON.stringify(suggestedBookmarks)).toContain("笔记/说明.md");
    expect(JSON.stringify(suggestedBookmarks)).not.toContain("笔记/README.md");

    const workspace = await fs.readJson(path.join(outRoot, ".obsidian", "workspace.json"));
    expect(JSON.stringify(workspace)).toContain("00_项目首页.md");
    expect(JSON.stringify(workspace)).toContain("01_审阅总览.md");
    expect(JSON.stringify(workspace)).not.toContain("04_智能体交接.md");
    expect(JSON.stringify(workspace)).toContain("画布/审阅地图.canvas");
    expect(
      JSON.stringify(workspace).includes(":\\") || JSON.stringify(workspace).includes("file://") || JSON.stringify(workspace).includes("vscode://")
    ).toBe(false);
  });

  test("does not overwrite existing Obsidian UI config", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-ui-existing-"));
    tempRoots.push(outRoot);
    const bookmarksPath = path.join(outRoot, ".obsidian", "bookmarks.json");
    await fs.ensureDir(path.dirname(bookmarksPath));
    await fs.writeFile(bookmarksPath, "{\"items\":[{\"title\":\"User Bookmark\"}]}\n", "utf8");

    const result = await exportObsidianVault({
      projectRoot: officialExampleRoot(),
      outRoot,
      force: false,
      includePluginRecipes: true,
      includeObsidianUi: true
    });

    await expect(fs.readFile(bookmarksPath, "utf8")).resolves.toContain("User Bookmark");
    await expect(fs.pathExists(path.join(outRoot, ".obsidian", "ai-video-workflow-suggested", "bookmarks.json"))).resolves.toBe(true);
    expect(result.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "skipped-user-config-existing",
          vaultPath: ".obsidian/bookmarks.json"
        })
      ])
    );
  });

  test("dry-run with Obsidian UI suggestions writes nothing", async () => {
    const parentRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-ui-dry-run-"));
    tempRoots.push(parentRoot);
    const outRoot = path.join(parentRoot, "vault");

    const result = await exportObsidianVault({
      projectRoot: officialExampleRoot(),
      outRoot,
      force: false,
      includePluginRecipes: true,
      includeObsidianUi: true,
      dryRun: true
    });

    expect(result.operations).toEqual(expect.arrayContaining([expect.objectContaining({ status: "created", vaultPath: ".obsidian/bookmarks.json" })]));
    await expect(fs.pathExists(outRoot)).resolves.toBe(false);
  });
});
