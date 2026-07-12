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

  test("rejects an existing file target without writing project files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-init-file-target-"));
    tempRoots.push(root);
    await fs.writeFile(path.join(root, "demo"), "user file\n", "utf8");

    await expect(
      createProject({
        targetRoot: root,
        projectName: "demo",
        pack: "official-ai-video",
        ide: "codex",
        imagePlatform: "openai",
        videoPlatform: "runway"
      })
    ).rejects.toThrow("not a directory");

    await expect(fs.readFile(path.join(root, "demo"), "utf8")).resolves.toBe("user file\n");
  });

  test("rejects a non-empty target directory without overwriting user files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-init-nonempty-target-"));
    tempRoots.push(root);
    const projectRoot = path.join(root, "demo");
    await fs.ensureDir(projectRoot);
    await fs.writeFile(path.join(projectRoot, "README.md"), "# User Draft\n", "utf8");

    await expect(
      createProject({
        targetRoot: root,
        projectName: "demo",
        pack: "official-ai-video",
        ide: "codex",
        imagePlatform: "openai",
        videoPlatform: "runway"
      })
    ).rejects.toThrow("not empty");

    await expect(fs.readFile(path.join(projectRoot, "README.md"), "utf8")).resolves.toBe("# User Draft\n");
    await expect(fs.pathExists(path.join(projectRoot, "project.config.yaml"))).resolves.toBe(false);
  });

  test("rejects a target directory that already contains Git metadata", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-init-git-target-"));
    tempRoots.push(root);
    const projectRoot = path.join(root, "demo");
    await fs.ensureDir(path.join(projectRoot, ".git"));
    await fs.writeFile(path.join(projectRoot, ".git", "config"), "[core]\n", "utf8");

    await expect(
      createProject({
        targetRoot: root,
        projectName: "demo",
        pack: "official-ai-video",
        ide: "codex",
        imagePlatform: "openai",
        videoPlatform: "runway"
      })
    ).rejects.toThrow("contains .git");

    await expect(fs.readFile(path.join(projectRoot, ".git", "config"), "utf8")).resolves.toBe("[core]\n");
    await expect(fs.pathExists(path.join(projectRoot, "project.config.yaml"))).resolves.toBe(false);
  });

  test("rejects repeat initialization of an existing project", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-init-repeat-"));
    tempRoots.push(root);

    await createProject({
      targetRoot: root,
      projectName: "demo",
      pack: "official-ai-video",
      ide: "codex",
      imagePlatform: "openai",
      videoPlatform: "runway"
    });
    const originalConfig = await fs.readFile(path.join(root, "demo", "project.config.yaml"), "utf8");

    await expect(
      createProject({
        targetRoot: root,
        projectName: "demo",
        pack: "official-ai-video",
        ide: "cursor",
        imagePlatform: "luma",
        videoPlatform: "minimax"
      })
    ).rejects.toThrow("already an ai-video-workflow project");

    await expect(fs.readFile(path.join(root, "demo", "project.config.yaml"), "utf8")).resolves.toBe(originalConfig);
  });

  test("rejects nested project creation inside an existing project", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-init-nested-"));
    tempRoots.push(root);

    await createProject({
      targetRoot: root,
      projectName: "parent",
      pack: "official-ai-video",
      ide: "codex",
      imagePlatform: "openai",
      videoPlatform: "runway"
    });

    await expect(
      createProject({
        targetRoot: path.join(root, "parent"),
        projectName: "child",
        pack: "official-ai-video",
        ide: "codex",
        imagePlatform: "openai",
        videoPlatform: "runway"
      })
    ).rejects.toThrow("nested project");

    await expect(fs.pathExists(path.join(root, "parent", "child"))).resolves.toBe(false);
  });

  test("allows initialization into an existing empty directory", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-init-empty-target-"));
    tempRoots.push(root);
    await fs.ensureDir(path.join(root, "demo"));

    await createProject({
      targetRoot: root,
      projectName: "demo",
      pack: "official-ai-video",
      ide: "codex",
      imagePlatform: "openai",
      videoPlatform: "runway"
    });

    await expect(fs.pathExists(path.join(root, "demo", "project.config.yaml"))).resolves.toBe(true);
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
