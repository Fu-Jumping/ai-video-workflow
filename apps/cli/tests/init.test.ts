import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { createProject } from "../src/lib/init.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

describe("createProject", () => {
  test.each([
    "",
    "   ",
    ".",
    "..",
    "../escape",
    "..\\escape",
    "nested/demo",
    "nested\\demo",
    "C:\\escape",
    "\\\\server\\share",
    "CON",
    "con.txt",
    "trailing-dot.",
    "trailing-space "
  ])("rejects unsafe project directory name %j", async (projectName) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-init-name-"));
    tempRoots.push(root);
    const possibleTarget = path.resolve(root, projectName);
    if (possibleTarget !== root && possibleTarget.startsWith(`${root}${path.sep}`)) {
      tempRoots.push(possibleTarget);
    }

    await expect(
      createProject({
        targetRoot: root,
        projectName,
        pack: "official-ai-video",
        ide: "codex",
        imagePlatform: "openai",
        videoPlatform: "runway"
      })
    ).rejects.toThrow();

    await expect(fs.pathExists(path.join(root, "project.config.yaml"))).resolves.toBe(false);
  });

  test("accepts readable Chinese names with internal spaces", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-init-readable-name-"));
    tempRoots.push(root);

    await createProject({
      targetRoot: root,
      projectName: "中文 项目",
      pack: "official-ai-video",
      ide: "codex",
      imagePlatform: "openai",
      videoPlatform: "runway"
    });

    await expect(fs.pathExists(path.join(root, "中文 项目", "project.config.yaml"))).resolves.toBe(true);
  });

  test("creates the default project skeleton, config, and codex runtime layers", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-init-"));
    tempRoots.push(root);

    await createProject({
      targetRoot: root,
      projectName: "demo-project",
      pack: "official-ai-video",
      ide: "codex",
      imagePlatform: "openai",
      videoPlatform: "runway"
    });

    const projectRoot = path.join(root, "demo-project");
    await expect(fs.pathExists(path.join(projectRoot, "project.config.yaml"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, "01_concept"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, "06_execution_plan", "00_execution_plan.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".codex", "ai-video-workflow", "WORKFLOW_OVERVIEW.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".codex", "skills", "film-workflow", "SKILL.md"))).resolves.toBe(true);

    const config = await fs.readFile(path.join(projectRoot, "project.config.yaml"), "utf8");
    expect(config).toContain("pack: official-ai-video");
    expect(config).toContain("ide: codex");
    expect(config).toContain("default: openai");
    expect(config).toContain("default: runway");
    expect(config).toContain("enabled: true");

    const gitignore = await fs.readFile(path.join(projectRoot, ".gitignore"), "utf8");
    expect(gitignore).toContain("ai-video-workflow generated and local surfaces");
    expect(gitignore).toContain("_views/");
  });
});
