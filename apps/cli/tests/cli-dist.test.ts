import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { build } from "tsup";
import { afterEach, describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const tempRoots: string[] = [];

async function run(command: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return await execFileAsync(command, args, {
    cwd
  });
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

describe("built CLI", () => {
  test("sync resolves the official pack from the bundled ESM entry", async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-cli-sync-"));
    tempRoots.push(projectRoot);

    await buildCli(cliRoot);
    await run(process.execPath, [path.join(cliRoot, "dist", "index.js"), "sync", "--project", projectRoot, "--ide", "codex"], cliRoot);

    await expect(fs.pathExists(path.join(projectRoot, ".codex", "ai-video-workflow", "WORKFLOW_OVERVIEW.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".codex", "skills", "film-workflow", "SKILL.md"))).resolves.toBe(true);
  });

  test("sync writes Cursor rules, skills, and runtime mirror from the bundled ESM entry", async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-cli-cursor-sync-"));
    tempRoots.push(projectRoot);

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
    await run(
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
        path.join(repoRoot, "examples", "official-mini-film"),
        "--out",
        outRoot,
        "--force"
      ],
      repoRoot
    );

    await expect(fs.pathExists(path.join(outRoot, "00_Project_Home.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(outRoot, "Canvas", "Workflow Map.canvas"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(outRoot, "Bases", "Shots.base"))).resolves.toBe(true);
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
        path.join(repoRoot, "examples", "official-mini-film"),
        "--out",
        outRoot,
        "--dry-run"
      ],
      repoRoot
    );

    expect(stdout).toContain("Obsidian export operations:");
    expect(stdout).toContain("Dry run complete");
    await expect(fs.pathExists(path.join(outRoot, "00_Project_Home.md"))).resolves.toBe(false);
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
        path.join(repoRoot, "examples", "official-mini-film"),
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
        path.join(repoRoot, "examples", "official-mini-film"),
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
        path.join(repoRoot, "examples", "official-mini-film")
      ],
      repoRoot
    );

    expect(stdout).toContain("\"shots\"");
    expect(stdout).toContain("\"verificationCommands\"");
    expect(stdout).toContain("04_image_prompts/shot-001-keyframe.md");
    expect(stdout).not.toMatch(/[A-Z]:\\\\|[A-Z]:\\\/|file:\/\/|vscode:\/\//);
  });

  test("help exposes the read-only MCP server command from the bundled ESM entry", async () => {
    const cliRoot = path.resolve(__dirname, "..");

    await buildCli(cliRoot);
    const { stdout } = await run(process.execPath, [path.join(cliRoot, "dist", "index.js"), "--help"], cliRoot);

    expect(stdout).toContain("mcp-context");
    expect(stdout).toContain("mcp-server");
  });
});
