import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { build } from "tsup";
import { afterEach, describe, expect, test } from "vitest";
import { writeState, writeBinding } from "../src/lib/libtv/project-binding.js";
import type { LibTvState } from "../src/lib/libtv/types.js";

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

  test("libtv review and refine work with mock backend", { timeout: 20000 }, async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const entry = await buildCliToTemp(cliRoot);
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-libtv-cli-refine-"));
    tempRoots.push(projectRoot);
    const state: LibTvState = {
      version: 1,
      projectUuid: "mock-project",
      anchors: [],
      keyframes: [
        {
          groupId: "group-001",
          shotId: "shot-001",
          keyframeId: "keyframe-01",
          sourcePath: "04_图片提示词/镜头组-001/镜头-001-关键帧-01.md",
          prompt: "中文提示词",
          referenceTokens: [],
          nodeId: "i-keyframe-1",
          status: "pending-approval"
        }
      ],
      videos: [],
      updatedAt: new Date().toISOString()
    };
    await writeState(projectRoot, state);
    for (const [dir, groupDir, file, content] of [
      ["03_分镜脚本", "镜头组-001", "镜头-001.md", "# 镜头 001\n"],
      ["04_图片提示词", "镜头组-001", "镜头-001-关键帧-01.md", "# 关键帧 01\n"],
      ["05_视频提示词", "镜头组-001", "镜头-001.md", "# 镜头 001 视频\n"]
    ]) {
      await fs.ensureDir(path.join(projectRoot, dir, groupDir));
      await fs.writeFile(path.join(projectRoot, dir, groupDir, file), content, "utf8");
    }

    const review = await runCli(entry, [
      "libtv", "--mock", "review", "group-001/shot-001/keyframe-01",
      "--project", projectRoot, "--decision", "refine", "--feedback", "手部需要调整"
    ]);
    expect(review.stdout).toContain("已记录");

    const refine = await runCli(entry, [
      "libtv", "--mock", "refine", "group-001/shot-001/keyframe-01",
      "--project", projectRoot, "--base", "first", "--instruction", "只修手", "--allow-generation"
    ]);
    expect(refine.stdout).toContain("已创建精修节点");

    const refine2 = await runCli(entry, [
      "libtv", "--mock", "refine", "group-001/shot-001/keyframe-01",
      "--project", projectRoot, "--base", "current", "--instruction", "继续修", "--allow-generation"
    ]);
    expect(refine2.stdout).toContain("已创建精修节点");

    const readState = await import("../src/lib/libtv/project-binding.js");
    const updated = await readState.readState(projectRoot);
    expect(updated?.keyframes[0]?.refineRounds).toHaveLength(2);
    const [r1, r2] = updated?.keyframes[0]?.refineRounds ?? [];
    expect(r1?.refineNodeId).toBeTruthy();
    expect(r2?.refineNodeId).toBeTruthy();
    expect(r1?.refineNodeId).not.toBe(r2?.refineNodeId);
    expect(r2?.baseNodeId).toBe(r1?.refineNodeId);

    const impact = await runCli(entry, [
      "impact", "--project", projectRoot, "--image", r2?.refineNodeId ?? ""
    ]);
    expect(impact.stdout).toContain("04_图片提示词/镜头组-001/镜头-001-关键帧-01.md");
    expect(impact.stdout).toContain("05_视频提示词/镜头组-001/镜头-001.md");
    expect(impact.stdout).not.toContain("undefined");
  });
  test("libtv apply requires --allow-generation for keyframe generation", { timeout: 30000 }, async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const entry = await buildCliToTemp(cliRoot);
    const repoRoot = path.resolve(cliRoot, "..", "..");
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-libtv-cli-apply-"));
    tempRoots.push(projectRoot);
    await fs.copy(path.join(repoRoot, "examples", "官方示例-云上早市"), projectRoot);
    await fs.appendFile(
      path.join(projectRoot, "project.config.yaml"),
      "\nlibtv:\n  image_model: mj-v8.2\n  video_model: star-video2\n",
      "utf8"
    );
    await writeBinding(projectRoot, { projectUuid: "mock-project" });

    const dry = await runCli(entry, [
      "libtv", "--mock", "apply", "--project", projectRoot, "--only", "keyframes"
    ]);
    expect(dry.stdout).toContain("--allow-generation");

    const executed = await runCli(entry, [
      "libtv", "--mock", "apply", "--project", projectRoot, "--only", "keyframes",
      "--allow-generation", "--poll-interval", "1", "--timeout", "5000"
    ]);
    expect(executed.stdout).toContain("生成关键帧");
    expect(executed.stdout).toContain("成功");
  });

});
