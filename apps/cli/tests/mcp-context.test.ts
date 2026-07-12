import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { buildMcpContext } from "../src/lib/mcp/context.js";

const exampleRoot = path.resolve(__dirname, "..", "..", "..", "examples", "official-mini-film");
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

describe("MCP read-only context", () => {
  test("builds a deterministic project summary without absolute paths", async () => {
    const context = await buildMcpContext({
      projectRoot: exampleRoot,
      pack: "official-ai-video"
    });

    expect(context.project.pack).toBe("official-ai-video");
    expect(context.project.projectRoot).toBe(".");
    expect(context.steps.map((step) => step.step)).toEqual([1, 2, 3, 4, 5, 6]);
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
    expect(JSON.stringify(context)).not.toMatch(/[A-Z]:\\\\|[A-Z]:\\\/|file:\/\/|vscode:\/\//);
  });

  test("maps each shot to Step 3, Step 4, Step 5, and Step 6 source files", async () => {
    const context = await buildMcpContext({
      projectRoot: exampleRoot,
      pack: "official-ai-video"
    });

    expect(context.shots.map((shot) => shot.id)).toEqual(["shot-001", "shot-002", "shot-003"]);
    for (const shot of context.shots) {
      expect(shot.sourcePaths.storyboard).toMatch(/^03_storyboard\//);
      expect(shot.sourcePaths.imagePrompt).toMatch(new RegExp(`^04_image_prompts/${shot.id}-keyframe\\.md$`));
      expect(shot.sourcePaths.videoPrompt).toMatch(new RegExp(`^05_video_prompts/${shot.id}\\.md$`));
      expect(shot.sourcePaths.executionPlan).toEqual([
        "06_execution_plan/00_execution_plan.md",
        "06_execution_plan/01_image_execution_plan.md",
        "06_execution_plan/02_video_execution_plan.md"
      ]);
      expect(JSON.stringify(shot.sourcePaths)).not.toContain("_views");
    }
  });

  test("requires project config before building context", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-mcp-missing-config-"));
    tempRoots.push(projectRoot);
    await fs.ensureDir(path.join(projectRoot, "03_storyboard"));

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
    await fs.copy(path.join(exampleRoot, "project.config.yaml"), path.join(projectRoot, "project.config.yaml"));

    await expect(
      buildMcpContext({
        projectRoot,
        pack: "official-ai-video"
      })
    ).rejects.toThrow("missing Step directory: 01_concept");
  });
});
