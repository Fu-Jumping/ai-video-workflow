import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { build } from "tsup";
import { afterEach, describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const tempRoots: string[] = [];
const stepDirs = ["01_概念策划", "02_世界设定", "03_分镜脚本", "04_图片提示词", "05_视频提示词", "06_执行计划"];

async function run(command: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return await execFileAsync(command, args, {
    cwd
  });
}

async function runExpectFailure(command: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  try {
    await run(command, args, cwd);
  } catch (error) {
    const failed = error as { code?: number | null; stdout?: string; stderr?: string };
    expect(failed.code).not.toBe(0);
    return {
      stdout: failed.stdout ?? "",
      stderr: failed.stderr ?? ""
    };
  }
  throw new Error("Expected command to fail");
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

async function buildCli(cliRoot: string): Promise<void> {
  await build({
    cwd: cliRoot,
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: false,
    clean: true,
    outDir: "dist",
    silent: true,
    target: "es2022",
    tsconfig: "tsconfig.json"
  });
}

async function seedWorkflowProject(projectRoot: string, ide = "codex"): Promise<void> {
  await fs.ensureDir(projectRoot);
  await fs.writeFile(
    path.join(projectRoot, "project.config.yaml"),
    [
      "pack: official-ai-video",
      `ide: ${ide}`,
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
  for (const stepDir of stepDirs) {
    await fs.ensureDir(path.join(projectRoot, stepDir));
  }
}

async function seedOfficialExampleProject(prefix: string): Promise<string> {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempRoots.push(tempRoot);
  const projectRoot = path.join(tempRoot, "官方示例-云上早市");
  await fs.copy(path.join(repoRoot, "examples", "官方示例-云上早市"), projectRoot);
  await fs.remove(path.join(projectRoot, "_views"));
  return projectRoot;
}

async function exportInProjectView(cliRoot: string, projectRoot: string): Promise<void> {
  const repoRoot = path.resolve(cliRoot, "..", "..");
  await run(process.execPath, [path.join(cliRoot, "dist", "index.js"), "export-obsidian", "--project", projectRoot, "--in-project-view"], repoRoot);
}

describe("built CLI", () => {
  test("sync resolves the official pack from the bundled ESM entry", async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-cli-sync-"));
    tempRoots.push(projectRoot);
    await seedWorkflowProject(projectRoot);

    await buildCli(cliRoot);
    await run(process.execPath, [path.join(cliRoot, "dist", "index.js"), "sync", "--project", projectRoot, "--ide", "codex"], cliRoot);

    await expect(fs.pathExists(path.join(projectRoot, ".codex", "ai-video-workflow", "WORKFLOW_OVERVIEW.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".codex", "skills", "film-workflow", "SKILL.md"))).resolves.toBe(true);
  });

  test("sync writes Cursor rules, skills, and runtime mirror from the bundled ESM entry", async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-cli-cursor-sync-"));
    tempRoots.push(projectRoot);
    await seedWorkflowProject(projectRoot, "cursor");

    await buildCli(cliRoot);
    await run(process.execPath, [path.join(cliRoot, "dist", "index.js"), "sync", "--project", projectRoot, "--ide", "cursor"], cliRoot);

    await expect(fs.pathExists(path.join(projectRoot, ".cursor", "skills", "film-workflow", "SKILL.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".cursor", "rules", "ai-video-workflow.mdc"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".cursor", "ai-video-workflow", "WORKFLOW_OVERVIEW.md"))).resolves.toBe(true);
  });

  test("sync writes Claude Code skills, command entry, and runtime mirror from the bundled ESM entry", async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-cli-claude-sync-"));
    tempRoots.push(projectRoot);
    await seedWorkflowProject(projectRoot, "claude-code");

    await buildCli(cliRoot);
    await run(process.execPath, [path.join(cliRoot, "dist", "index.js"), "sync", "--project", projectRoot, "--ide", "claude-code"], cliRoot);

    await expect(fs.pathExists(path.join(projectRoot, "CLAUDE.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".claude", "skills", "film-workflow", "SKILL.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".claude", "commands", "ai-video-workflow.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".claude", "ai-video-workflow", "WORKFLOW_OVERVIEW.md"))).resolves.toBe(true);
  });

  test("sync writes Trae skills, rules, specs, and documents from the bundled ESM entry", async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-cli-trae-sync-"));
    tempRoots.push(projectRoot);
    await seedWorkflowProject(projectRoot, "trae");

    await buildCli(cliRoot);
    await run(process.execPath, [path.join(cliRoot, "dist", "index.js"), "sync", "--project", projectRoot, "--ide", "trae"], cliRoot);

    await expect(fs.pathExists(path.join(projectRoot, "AGENTS.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, "CLAUDE.md"))).resolves.toBe(false);
    await expect(fs.pathExists(path.join(projectRoot, ".trae", "skills", "film-workflow", "SKILL.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".trae", "rules", "ai-video-workflow.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".trae", "specs", "ai-video-workflow", "indexes", "capability-index.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".trae", "documents", "ai-video-workflow", "WORKFLOW_OVERVIEW.md"))).resolves.toBe(true);
  });

  test("init accepts explicit options for scripted project creation", async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const targetRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-cli-init-"));
    tempRoots.push(targetRoot);

    await buildCli(cliRoot);
    const result = await run(
      process.execPath,
      [
        path.join(cliRoot, "dist", "index.js"),
        "init",
        "--name",
        "scripted-demo",
        "--ide",
        "codex",
        "--image",
        "openai",
        "--video",
        "runway"
      ],
      targetRoot
    );

    const projectRoot = path.join(targetRoot, "scripted-demo");
    await expect(fs.pathExists(path.join(projectRoot, "project.config.yaml"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".codex", "skills", "film-workflow", "SKILL.md"))).resolves.toBe(true);

    const config = await fs.readFile(path.join(projectRoot, "project.config.yaml"), "utf8");
    expect(config).toContain("ide: codex");
    expect(config).toContain("default: openai");
    expect(config).toContain("default: runway");
    expect(result.stdout).toContain("项目路径：");
    expect(result.stdout).toContain("请在智能体中打开这个目录");
    expect(result.stdout).toContain("01_概念策划/故事内核.md");
    expect(result.stdout).toContain("verify --project");
  });

  test("invalid CLI choices use readable errors without default stack traces", async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const targetRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-cli-invalid-choice-"));
    tempRoots.push(targetRoot);

    await buildCli(cliRoot);
    const result = await runExpectFailure(
      process.execPath,
      [path.join(cliRoot, "dist", "index.js"), "init", "--name", "demo", "--ide", "codx", "--image", "openai", "--video", "runway"],
      targetRoot
    );
    const output = `${result.stdout}\n${result.stderr}`;

    expect(output).toContain("Invalid AI IDE: codx");
    expect(output).toContain("Expected one of: codex, cursor, claude-code, trae");
    expect(output).toContain("Did you mean codex?");
    expect(output).not.toContain("TypeError");
    expect(output).not.toContain("node:internal");
    expect(output).not.toContain("at Command");
  });

  test("verify validates IDE choices before project verification", async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const targetRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-cli-invalid-verify-"));
    tempRoots.push(targetRoot);

    await buildCli(cliRoot);
    const result = await runExpectFailure(
      process.execPath,
      [path.join(cliRoot, "dist", "index.js"), "verify", "--project", targetRoot, "--ide", "codx"],
      targetRoot
    );
    const output = `${result.stdout}\n${result.stderr}`;

    expect(output).toContain("Invalid AI IDE: codx");
    expect(output).toContain("Did you mean codex?");
    expect(output).not.toContain("TypeError");
    expect(output).not.toContain("node:internal");
    expect(output).not.toContain("at Command");
  });

  test("export-obsidian creates a vault projection from the official example", async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const repoRoot = path.resolve(cliRoot, "..", "..");
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-cli-obsidian-"));
    tempRoots.push(outRoot);

    await buildCli(cliRoot);
    await run(
      process.execPath,
      [
        path.join(cliRoot, "dist", "index.js"),
        "export-obsidian",
        "--project",
        path.join(repoRoot, "examples", "官方示例-云上早市"),
        "--out",
        outRoot,
        "--force"
      ],
      repoRoot
    );

    await expect(fs.pathExists(path.join(outRoot, "00_项目首页.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(outRoot, "画布", "流程图.canvas"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(outRoot, "数据表", "镜头.base"))).resolves.toBe(true);
  });

  test("export-obsidian and verify-obsidian support in-project view targets", async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const repoRoot = path.resolve(cliRoot, "..", "..");
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-cli-obsidian-in-project-"));
    tempRoots.push(tempRoot);
    const projectRoot = path.join(tempRoot, "官方示例-云上早市");
    const otherVaultRoot = path.join(tempRoot, "external-vault");
    await fs.copy(path.join(repoRoot, "examples", "官方示例-云上早市"), projectRoot);

    await buildCli(cliRoot);
    const exportResult = await run(
      process.execPath,
      [path.join(cliRoot, "dist", "index.js"), "export-obsidian", "--project", projectRoot, "--in-project-view"],
      repoRoot
    );
    const verifyResult = await run(
      process.execPath,
      [path.join(cliRoot, "dist", "index.js"), "verify-obsidian", "--project", projectRoot, "--in-project-view"],
      repoRoot
    );

    expect(exportResult.stdout).toContain("_views");
    expect(exportResult.stdout).toContain("obsidian");
    expect(verifyResult.stdout).toContain("Obsidian projection verification passed");
    await expect(fs.pathExists(path.join(projectRoot, "_views", "obsidian", "00_项目首页.md"))).resolves.toBe(true);

    const conflictingTarget = await runExpectFailure(
      process.execPath,
      [
        path.join(cliRoot, "dist", "index.js"),
        "export-obsidian",
        "--project",
        projectRoot,
        "--out",
        otherVaultRoot,
        "--in-project-view"
      ],
      repoRoot
    );
    expect(`${conflictingTarget.stdout}\n${conflictingTarget.stderr}`).toContain("Use either --out or --in-project-view");

    const missingVaultTarget = await runExpectFailure(
      process.execPath,
      [path.join(cliRoot, "dist", "index.js"), "verify-obsidian", "--project", projectRoot],
      repoRoot
    );
    expect(`${missingVaultTarget.stdout}\n${missingVaultTarget.stderr}`).toContain("Missing --vault");
  }, 10000);

  test("clean-view dry-run reports in-project view cleanup without deleting files", async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const repoRoot = path.resolve(cliRoot, "..", "..");
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-cli-clean-view-"));
    tempRoots.push(tempRoot);
    const projectRoot = path.join(tempRoot, "官方示例-云上早市");
    const homePath = path.join(projectRoot, "_views", "obsidian", "00_项目首页.md");
    await fs.copy(path.join(repoRoot, "examples", "官方示例-云上早市"), projectRoot);
    await fs.remove(path.join(projectRoot, "_views"));

    await buildCli(cliRoot);
    await run(process.execPath, [path.join(cliRoot, "dist", "index.js"), "export-obsidian", "--project", projectRoot, "--in-project-view"], repoRoot);
    const { stdout } = await run(
      process.execPath,
      [path.join(cliRoot, "dist", "index.js"), "clean-view", "--project", projectRoot, "--dry-run"],
      repoRoot
    );

    expect(stdout).toContain("Obsidian view clean dry-run");
    expect(stdout).toContain("would remove generated files");
    expect(stdout).toContain("no files were deleted");
    await expect(fs.pathExists(homePath)).resolves.toBe(true);
  }, 10000);

  test("clean-view dry-run supports step filters without deleting files", async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const repoRoot = path.resolve(cliRoot, "..", "..");
    const projectRoot = await seedOfficialExampleProject("ai-video-workflow-cli-clean-view-step-");
    const stepFourProjection = path.join(projectRoot, "_views", "obsidian", "流程", "步骤四 - 图片提示词", "镜头 002 关键帧 - 图片提示词.md");

    await buildCli(cliRoot);
    await exportInProjectView(cliRoot, projectRoot);
    const { stdout } = await run(
      process.execPath,
      [path.join(cliRoot, "dist", "index.js"), "clean-view", "--project", projectRoot, "--step", "4", "--dry-run"],
      repoRoot
    );

    expect(stdout).toContain("Obsidian view clean dry-run");
    expect(stdout).toContain("- filters:");
    expect(stdout).toContain("  - step: 4");
    expect(stdout).toContain("would remove generated files");
    await expect(fs.pathExists(stepFourProjection)).resolves.toBe(true);
  }, 10000);

  test("rebuild-view refreshes the in-project view and preserves user notes", async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const repoRoot = path.resolve(cliRoot, "..", "..");
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-cli-rebuild-view-"));
    tempRoots.push(tempRoot);
    const projectRoot = path.join(tempRoot, "官方示例-云上早市");
    const vaultRoot = path.join(projectRoot, "_views", "obsidian");
    const storyProjection = path.join(vaultRoot, "流程", "步骤一 - 概念策划", "故事内核.md");
    const userNote = path.join(vaultRoot, "笔记", "manual-review.md");
    await fs.copy(path.join(repoRoot, "examples", "官方示例-云上早市"), projectRoot);
    await fs.remove(path.join(projectRoot, "_views"));

    await buildCli(cliRoot);
    await run(process.execPath, [path.join(cliRoot, "dist", "index.js"), "export-obsidian", "--project", projectRoot, "--in-project-view"], repoRoot);
    await fs.writeFile(userNote, "# 手写审阅\n\n保留这条笔记。\n", "utf8");
    await fs.appendFile(path.join(projectRoot, "01_概念策划", "故事内核.md"), "\nCLI 重建后应该进入观看层。\n", "utf8");
    const { stdout } = await run(process.execPath, [path.join(cliRoot, "dist", "index.js"), "rebuild-view", "--project", projectRoot], repoRoot);

    expect(stdout).toContain("Obsidian view rebuild:");
    expect(stdout).toContain("sync: ran");
    expect(stdout).toContain("verification: passed");
    await expect(fs.readFile(storyProjection, "utf8")).resolves.toContain("CLI 重建后应该进入观看层");
    await expect(fs.readFile(userNote, "utf8")).resolves.toContain("保留这条笔记");
  }, 10000);

  test("rebuild-view supports shot filters and preserves user notes", async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const repoRoot = path.resolve(cliRoot, "..", "..");
    const projectRoot = await seedOfficialExampleProject("ai-video-workflow-cli-rebuild-view-shot-");
    const vaultRoot = path.join(projectRoot, "_views", "obsidian");
    const shotTwoProjection = path.join(vaultRoot, "流程", "步骤四 - 图片提示词", "镜头 002 关键帧 - 图片提示词.md");
    const shotOneProjection = path.join(vaultRoot, "流程", "步骤四 - 图片提示词", "镜头 001 关键帧 - 图片提示词.md");
    const userNote = path.join(vaultRoot, "笔记", "manual-review.md");

    await buildCli(cliRoot);
    await exportInProjectView(cliRoot, projectRoot);
    const shotOneBefore = await fs.readFile(shotOneProjection, "utf8");
    await fs.writeFile(userNote, "# 手写审阅\n\n局部重建也应该保留。\n", "utf8");
    await fs.appendFile(path.join(projectRoot, "04_图片提示词", "镜头-002-关键帧.md"), "\nCLI 局部重建后应该进入镜头 002。\n", "utf8");
    const { stdout } = await run(
      process.execPath,
      [path.join(cliRoot, "dist", "index.js"), "rebuild-view", "--project", projectRoot, "--shot", "2"],
      repoRoot
    );

    expect(stdout).toContain("Obsidian view rebuild:");
    expect(stdout).toContain("  - shot: shot-002");
    expect(stdout).toContain("verification: passed");
    await expect(fs.readFile(shotTwoProjection, "utf8")).resolves.toContain("CLI 局部重建后应该进入镜头 002");
    await expect(fs.readFile(shotOneProjection, "utf8")).resolves.toBe(shotOneBefore);
    await expect(fs.readFile(userNote, "utf8")).resolves.toContain("局部重建也应该保留");
  }, 10000);

  test("clean-view rejects invalid filters without default stack traces", async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const projectRoot = await seedOfficialExampleProject("ai-video-workflow-cli-clean-view-invalid-filter-");

    await buildCli(cliRoot);
    await exportInProjectView(cliRoot, projectRoot);
    const result = await runExpectFailure(
      process.execPath,
      [path.join(cliRoot, "dist", "index.js"), "clean-view", "--project", projectRoot, "--kind", "unknown"],
      path.resolve(cliRoot, "..", "..")
    );
    const output = `${result.stdout}\n${result.stderr}`;

    expect(output).toContain("Invalid clean-view kind: unknown");
    expect(output).toContain("Expected one of: workflow-notes, shot-pages, canvas, base, dashboard, obsidian-ui");
    expect(output).not.toContain("node:internal");
    expect(output).not.toContain("at Command");
  }, 10000);

  test("export-obsidian rejects missing projects without creating a vault or printing stack traces", async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const repoRoot = path.resolve(cliRoot, "..", "..");
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-cli-obsidian-missing-project-"));
    tempRoots.push(tempRoot);
    const missingProject = path.join(tempRoot, "missing-project");
    const outRoot = path.join(tempRoot, "vault");

    await buildCli(cliRoot);
    const result = await runExpectFailure(
      process.execPath,
      [path.join(cliRoot, "dist", "index.js"), "export-obsidian", "--project", missingProject, "--out", outRoot],
      repoRoot
    );
    const output = `${result.stdout}\n${result.stderr}`;

    expect(output).toContain("Project root does not exist");
    expect(output).not.toContain("node:internal");
    expect(output).not.toContain("at Command");
    await expect(fs.pathExists(outRoot)).resolves.toBe(false);
  });

  test("verify-obsidian rejects file vault targets with readable errors", async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const repoRoot = path.resolve(cliRoot, "..", "..");
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-cli-obsidian-file-vault-"));
    tempRoots.push(tempRoot);
    const vaultPath = path.join(tempRoot, "vault.md");
    await fs.writeFile(vaultPath, "# Not a vault\n", "utf8");

    await buildCli(cliRoot);
    const result = await runExpectFailure(
      process.execPath,
      [
        path.join(cliRoot, "dist", "index.js"),
        "verify-obsidian",
        "--project",
        path.join(repoRoot, "examples", "官方示例-云上早市"),
        "--vault",
        vaultPath
      ],
      repoRoot
    );
    const output = `${result.stdout}\n${result.stderr}`;

    expect(output).toContain("obsidian-vault-not-directory");
    expect(output).not.toContain("node:internal");
    expect(output).not.toContain("at Command");
  });

  test("mcp-context rejects file project roots without printing stack traces", async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-cli-mcp-file-root-"));
    tempRoots.push(tempRoot);
    const projectPath = path.join(tempRoot, "project.md");
    await fs.writeFile(projectPath, "# Not a project\n", "utf8");

    await buildCli(cliRoot);
    const result = await runExpectFailure(
      process.execPath,
      [path.join(cliRoot, "dist", "index.js"), "mcp-context", "--project", projectPath],
      cliRoot
    );
    const output = `${result.stdout}\n${result.stderr}`;

    expect(output).toContain("Project root must be a directory");
    expect(output).not.toContain("node:internal");
    expect(output).not.toContain("at Command");
  });

  test("export-obsidian dry-run reports operations without writing files", async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const repoRoot = path.resolve(cliRoot, "..", "..");
    const parentRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-cli-obsidian-dry-run-"));
    tempRoots.push(parentRoot);
    const outRoot = path.join(parentRoot, "vault");

    await buildCli(cliRoot);
    const { stdout } = await run(
      process.execPath,
      [
        path.join(cliRoot, "dist", "index.js"),
        "export-obsidian",
        "--project",
        path.join(repoRoot, "examples", "官方示例-云上早市"),
        "--out",
        outRoot,
        "--dry-run"
      ],
      repoRoot
    );

    expect(stdout).toContain("Obsidian export operations:");
    expect(stdout).toContain("Dry run complete");
    await expect(fs.pathExists(path.join(outRoot, "00_项目首页.md"))).resolves.toBe(false);
  });

  test("export-obsidian can include optional Obsidian UI suggestions", async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const repoRoot = path.resolve(cliRoot, "..", "..");
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-cli-obsidian-ui-"));
    tempRoots.push(outRoot);

    await buildCli(cliRoot);
    await run(
      process.execPath,
      [
        path.join(cliRoot, "dist", "index.js"),
        "export-obsidian",
        "--project",
        path.join(repoRoot, "examples", "官方示例-云上早市"),
        "--out",
        outRoot,
        "--include-obsidian-ui"
      ],
      repoRoot
    );

    await expect(fs.pathExists(path.join(outRoot, ".obsidian", "bookmarks.json"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(outRoot, ".obsidian", "ai-video-workflow-suggested", "workspace.json"))).resolves.toBe(true);
  });

  test("export-obsidian dry-run with UI suggestions reports existing config without writing files", async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const repoRoot = path.resolve(cliRoot, "..", "..");
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-cli-obsidian-ui-existing-"));
    tempRoots.push(outRoot);
    const bookmarksPath = path.join(outRoot, ".obsidian", "bookmarks.json");
    await fs.ensureDir(path.dirname(bookmarksPath));
    await fs.writeFile(bookmarksPath, "{\"items\":[{\"title\":\"User Bookmark\"}]}\n", "utf8");

    await buildCli(cliRoot);
    const { stdout } = await run(
      process.execPath,
      [
        path.join(cliRoot, "dist", "index.js"),
        "export-obsidian",
        "--project",
        path.join(repoRoot, "examples", "官方示例-云上早市"),
        "--out",
        outRoot,
        "--dry-run",
        "--include-obsidian-ui"
      ],
      repoRoot
    );

    expect(stdout).toContain("skipped-user-config-existing");
    await expect(fs.pathExists(path.join(outRoot, ".obsidian", "ai-video-workflow-suggested", "bookmarks.json"))).resolves.toBe(false);
    await expect(fs.readFile(bookmarksPath, "utf8")).resolves.toContain("User Bookmark");
  });

  test("mcp-context prints read-only project context from the bundled ESM entry", async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const repoRoot = path.resolve(cliRoot, "..", "..");

    await buildCli(cliRoot);
    const { stdout } = await run(
      process.execPath,
      [
        path.join(cliRoot, "dist", "index.js"),
        "mcp-context",
        "--project",
        path.join(repoRoot, "examples", "官方示例-云上早市")
      ],
      repoRoot
    );

    expect(stdout).toContain("\"shots\"");
    expect(stdout).toContain("\"verificationCommands\"");
    expect(stdout).toContain("04_图片提示词/镜头-001-关键帧.md");
    expect(stdout).not.toMatch(/[A-Z]:\\\\|[A-Z]:\\\/|file:\/\/|vscode:\/\//);
  });

  test("help exposes the read-only MCP server command from the bundled ESM entry", async () => {
    const cliRoot = path.resolve(__dirname, "..");

    await buildCli(cliRoot);
    const { stdout } = await run(process.execPath, [path.join(cliRoot, "dist", "index.js"), "--help"], cliRoot);

    expect(stdout).toContain("mcp-context");
    expect(stdout).toContain("mcp-server");
    expect(stdout).toContain("clean-view");
    expect(stdout).toContain("rebuild-view");
  });
});
