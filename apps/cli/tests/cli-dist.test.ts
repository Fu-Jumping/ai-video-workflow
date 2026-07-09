import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { build } from "tsup";
import { afterEach, describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const tempRoots: string[] = [];

async function run(command: string, args: string[], cwd: string): Promise<void> {
  await execFileAsync(command, args, {
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
});
