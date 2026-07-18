import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { buildMcpContext } from "../src/lib/mcp/context.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

async function createChineseMcpProject(): Promise<string> {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-mcp-cn-"));
  tempRoots.push(projectRoot);
  await fs.writeFile(
    path.join(projectRoot, "project.config.yaml"),
    [
      "pack: official-ai-video",
      "ide: codex",
      "platforms:",
      "  image:",
      "    default: openai",
      "  video:",
      "    default: runway",
      "workflow:",
      "  enhanced_flow:",
      "    enabled: true"
    ].join("\n"),
    "utf8"
  );

  for (const dir of ["01_概念策划", "02_世界设定", "03_分镜脚本", "04_图片提示词", "05_视频提示词", "06_执行计划"]) {
    await fs.ensureDir(path.join(projectRoot, dir));
  }

  for (const shotNumber of ["001", "002", "003"]) {
    await fs.writeFile(
      path.join(projectRoot, "03_分镜脚本", `镜头-${shotNumber}.md`),
      [
        `# 镜头 ${shotNumber}`,
        "",
        `- 图片提示词：[镜头-${shotNumber}-关键帧](../04_图片提示词/镜头-${shotNumber}-关键帧.md)`,
        `- 视频提示词：[镜头-${shotNumber}](../05_视频提示词/镜头-${shotNumber}.md)`
      ].join("\n"),
      "utf8"
    );
    await fs.writeFile(path.join(projectRoot, "04_图片提示词", `镜头-${shotNumber}-关键帧.md`), `# 镜头 ${shotNumber} 关键帧\n`, "utf8");
    await fs.writeFile(path.join(projectRoot, "05_视频提示词", `镜头-${shotNumber}.md`), `# 镜头 ${shotNumber} 视频\n`, "utf8");
  }

  return projectRoot;
}

describe("MCP read-only context", () => {
  test("builds a deterministic project summary without absolute paths", async () => {
    const projectRoot = await createChineseMcpProject();
    const context = await buildMcpContext({
      projectRoot,
      pack: "official-ai-video"
    });

    expect(context.project.pack).toBe("official-ai-video");
    expect(context.project.projectRoot).toBe(".");
    expect(context.steps.map((step) => step.step)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(context.steps.map((step) => step.directory)).toEqual([
      "01_概念策划",
      "02_世界设定",
      "03_分镜脚本",
      "04_图片提示词",
      "05_视频提示词",
      "06_执行计划"
    ]);
    expect(context.verificationCommands).toEqual(
      expect.arrayContaining([
        "ai-video-workflow verify --project <path> --ide codex",
        "ai-video-workflow export-obsidian --project <path> --in-project-view",
        "ai-video-workflow verify-obsidian --project <path> --in-project-view",
        "ai-video-workflow mcp-context --project <path>"
      ])
    );
    expect(context.viewLayers.obsidian).toEqual({
      defaultVaultPath: "_views/obsidian",
      sourceOfTruth: false,
      refreshCommand: "ai-video-workflow export-obsidian --project <path> --in-project-view"
    });
    expect(context.editBoundaries.generated).toContain("_views/obsidian");
    expect(context.editBoundaries.story).toContain("步骤三分镜脚本");
    expect(JSON.stringify(context)).not.toMatch(/[A-Z]:\\|[A-Z]:\/|file:\/\/|vscode:\/\//);
  });

  test("maps each shot to Step 3, Step 4, Step 5, and Step 6 source files", async () => {
    const projectRoot = await createChineseMcpProject();
    const context = await buildMcpContext({
      projectRoot,
      pack: "official-ai-video"
    });

    expect(context.shots.map((shot) => shot.id)).toEqual(["shot-001", "shot-002", "shot-003"]);
    for (const shot of context.shots) {
      const number = shot.id.replace("shot-", "");
      expect(shot.sourcePaths.storyboard).toBe(`03_分镜脚本/镜头-${number}.md`);
      expect(shot.sourcePaths.imagePrompt).toBe(`04_图片提示词/镜头-${number}-关键帧.md`);
      expect(shot.sourcePaths.videoPrompt).toBe(`05_视频提示词/镜头-${number}.md`);
      expect(shot.sourcePaths.executionPlan).toEqual([
        "06_执行计划/00_执行计划.md",
        "06_执行计划/01_图片执行计划.md",
        "06_执行计划/02_视频执行计划.md"
      ]);
      expect(JSON.stringify(shot.sourcePaths)).not.toContain("_views");
    }
  });

  test("requires project config before building context", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-mcp-missing-config-"));
    tempRoots.push(projectRoot);
    await fs.ensureDir(path.join(projectRoot, "03_分镜脚本"));

    await expect(
      buildMcpContext({
        projectRoot,
        pack: "official-ai-video"
      })
    ).rejects.toThrow("Missing project.config.yaml");
  });

  test("requires a directory project root before building context", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-mcp-file-root-"));
    tempRoots.push(root);
    const projectRoot = path.join(root, "project.md");
    await fs.writeFile(projectRoot, "# Not a project\n", "utf8");

    await expect(
      buildMcpContext({
        projectRoot,
        pack: "official-ai-video"
      })
    ).rejects.toThrow("must be a directory");
  });

  test("requires all Step directories before building context", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-mcp-missing-step-"));
    tempRoots.push(projectRoot);
    await fs.writeFile(
      path.join(projectRoot, "project.config.yaml"),
      [
        "pack: official-ai-video",
        "ide: codex",
        "platforms:",
        "  image:",
        "    default: openai",
        "  video:",
        "    default: runway",
        "workflow:",
        "  enhanced_flow:",
        "    enabled: true"
      ].join("\n"),
      "utf8"
    );

    await expect(
      buildMcpContext({
        projectRoot,
        pack: "official-ai-video"
      })
    ).rejects.toThrow("missing Step directory: 01_概念策划");
  });
});
