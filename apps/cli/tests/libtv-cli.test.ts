import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { build } from "tsup";
import { afterEach, describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

async function buildCliToTemp(cliRoot: string): Promise<string> {
  const outDir = path.join(cliRoot, "dist-libtv-test");
  await fs.remove(outDir);
  tempRoots.push(outDir);
  await build({
    cwd: cliRoot,
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: false,
    clean: true,
    outDir,
    silent: true,
    target: "es2022",
    tsconfig: "tsconfig.json"
  } as any);
  return path.join(outDir, "index.js");
}

async function runCli(entry: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(process.execPath, [entry, ...args]);
}

describe("libtv CLI", () => {
  test("--version is exposed", { timeout: 20000 }, async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const entry = await buildCliToTemp(cliRoot);
    const result = await runCli(entry, ["--version"]);
    expect(result.stdout.trim()).toBe("0.1.0");
  });

  test("libtv plan prints official example asset plan", { timeout: 20000 }, async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const repoRoot = path.resolve(cliRoot, "..", "..");
    const exampleRoot = path.join(repoRoot, "examples", "官方示例-云上早市");
    const entry = await buildCliToTemp(cliRoot);
    const result = await runCli(entry, ["libtv", "--mock", "plan", "--project", exampleRoot]);
    expect(result.stdout).toContain("锚点素材：6");
    expect(result.stdout).toContain("关键帧图片：3");
    expect(result.stdout).toContain("视频：3");
  });
});
