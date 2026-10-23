import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { analyzeImpact, analyzeImageNodeImpact, renderImpactResult } from "../src/lib/impact.js";
import { createProject } from "../src/lib/init.js";
import { writeState } from "../src/lib/libtv/project-binding.js";
import type { LibTvState } from "../src/lib/libtv/types.js";
import { syncProject } from "../src/lib/sync.js";

const tempRoots: string[] = [];
const repoRoot = path.resolve(__dirname, "..", "..", "..");

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

async function createImpactProject(): Promise<string> {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-impact-"));
  tempRoots.push(projectRoot);
  for (const dir of ["01_概念策划", "02_世界设定", "03_分镜脚本", "04_图片提示词", "05_视频提示词"]) {
    await fs.ensureDir(path.join(projectRoot, dir));
  }
  await fs.ensureDir(path.join(projectRoot, "03_分镜脚本", "镜头组-001"));
  await fs.ensureDir(path.join(projectRoot, "04_图片提示词", "镜头组-001"));
  await fs.ensureDir(path.join(projectRoot, "05_视频提示词", "镜头组-001"));

  await fs.writeFile(
    path.join(projectRoot, "01_概念策划", "故事内核.md"),
    "# 故事内核\n\n主角荆轲在易水边告别。\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(projectRoot, "02_世界设定", "角色设定.md"),
    "## 荆轲\n\n- 主角色：是\n- 参考：@荆轲三视图\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(projectRoot, "03_分镜脚本", "镜头组-001", "镜头-001.md"),
    "# 镜头 001\n\n荆轲站在河边。\n\n- 对应图片提示词：[关键帧](../../04_图片提示词/镜头组-001/镜头-001-关键帧-01.md)\n- 对应视频提示词：[视频](../../05_视频提示词/镜头组-001/镜头-001.md)\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(projectRoot, "04_图片提示词", "镜头组-001", "镜头-001-关键帧-01.md"),
    "# 镜头 001 关键帧\n\n主体站在河边。\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(projectRoot, "05_视频提示词", "镜头组-001", "镜头-001.md"),
    "# 镜头 001 视频\n\n河边告别的镜头。\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(projectRoot, "03_分镜脚本", "镜头组-001", "镜头-002.md"),
    "# 镜头 002\n\n另一场无关戏。\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(projectRoot, "04_图片提示词", "镜头组-001", "镜头-002-关键帧-01.md"),
    "# 镜头 002 关键帧\n\n无关画面。\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(projectRoot, "05_视频提示词", "镜头组-001", "镜头-002.md"),
    "# 镜头 002 视频\n\n无关画面。\n",
    "utf8"
  );
  return projectRoot;
}

/**
 * 内容树项目夹具：声明 content.format_version=1，正文放在 内容/ 下。
 *
 * 旧格式的 01/03/04/05 目录由 createProject 一并建好，这里只补内容树的三层结构，
 * 用来验证影响分析在内容树模式下不会漏掉正文。
 */
async function createContentTreeImpactProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-impact-content-"));
  tempRoots.push(root);
  await createProject({
    targetRoot: root,
    projectName: "content-impact",
    pack: "official-ai-video",
    ide: "codex",
    imagePlatform: "openai",
    videoPlatform: "seedance"
  });
  const projectRoot = path.join(root, "content-impact");
  await syncProject({ repoRoot, projectRoot, ide: "codex", pack: "official-ai-video" });

  const shotDirectory = path.join(projectRoot, "内容", "场-001", "镜头组-001", "镜头-001");
  await fs.ensureDir(shotDirectory);
  await fs.writeFile(
    path.join(projectRoot, "内容", "场-001", "00_场总览.md"),
    "# 场-001 场总览\n\n## 这一场讲什么\n\n雾塔门前的清晨。\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(projectRoot, "内容", "场-001", "镜头组-001", "00_镜头组总览.md"),
    "# 镜头组-001 镜头组总览\n\n## 这一组讲什么\n\n雾塔门前的开场。\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(shotDirectory, "00_镜头-001.md"),
    "# 镜头 001：雾塔门前\n\n- 观看顺序：1\n- 目标时长：15 秒\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(shotDirectory, "分镜-01.md"),
    "# 分镜-01：停步抬头\n\n## 一、本段正文（画面与动作）\n\n- **景别与视角**：中景正面。\n\n阿岚在雾塔门前停步。\n",
    "utf8"
  );
  return projectRoot;
}

describe("impact analysis", () => {
  test("finds direct keyword matches and same-shot downstream review candidates", async () => {
    const projectRoot = await createImpactProject();
    const result = await analyzeImpact(projectRoot, "荆轲");

    expect(result.matches.map((hit) => hit.relPath)).toEqual([
      "01_概念策划/故事内核.md",
      "02_世界设定/角色设定.md",
      "03_分镜脚本/镜头组-001/镜头-001.md"
    ]);
    expect(result.reviewCandidates.map((hit) => hit.relPath)).toEqual([
      "04_图片提示词/镜头组-001/镜头-001-关键帧-01.md",
      "05_视频提示词/镜头组-001/镜头-001.md"
    ]);
    expect(result.affectedShots).toContain("shot-001");
    expect(result.affectedShots).not.toContain("shot-002");
    expect(result.notes.length).toBeGreaterThan(0);
  });

  test("is case-insensitive for Latin keywords", async () => {
    const projectRoot = await createImpactProject();
    await fs.writeFile(path.join(projectRoot, "02_世界设定", "角色设定.md"), "## Hero\n\n- 主角色：是\n", "utf8");
    const result = await analyzeImpact(projectRoot, "hero");
    expect(result.matches.some((hit) => hit.relPath === "02_世界设定/角色设定.md")).toBe(true);
  });

  test("rejects an empty keyword", async () => {
    const projectRoot = await createImpactProject();
    await expect(analyzeImpact(projectRoot, "   ")).rejects.toThrow("Impact keyword must not be empty.");
  });

  test("traces a LibTV keyframe image node to downstream files", async () => {
    const projectRoot = await createImpactProject();
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
          status: "refined_generated",
          finalNodeId: "i-refine-1",
          refineRounds: [
            { round: 1, base: "first", baseNodeId: "i-keyframe-1", instruction: "只修手", refineNodeId: "i-refine-1", status: "generated" }
          ]
        }
      ],
      videos: [],
      updatedAt: new Date().toISOString()
    };
    await writeState(projectRoot, state);

    const result = await analyzeImageNodeImpact(projectRoot, "i-refine-1");
    expect(result.affectedShots).toEqual(["shot-001"]);
    expect(result.reviewCandidates.map((hit) => hit.relPath)).toEqual([
      "04_图片提示词/镜头组-001/镜头-001-关键帧-01.md",
      "05_视频提示词/镜头组-001/镜头-001.md"
    ]);
    expect(result.reviewCandidates.every((hit) => hit.step > 0 && hit.relPath.length > 0)).toBe(true);

    const rendered = renderImpactResult(result);
    expect(rendered).toContain("04_图片提示词/镜头组-001/镜头-001-关键帧-01.md");
    expect(rendered).toContain("05_视频提示词/镜头组-001/镜头-001.md");
    expect(rendered).not.toContain("undefined");
  });

  test("renders a readable summary", async () => {
    const projectRoot = await createImpactProject();
    const result = await analyzeImpact(projectRoot, "荆轲");
    const output = renderImpactResult(result);
    expect(output).toContain("Impact analysis for \"荆轲\"");
    expect(output).toContain("Direct matches (3)");
    expect(output).toContain("Additional review candidates (2)");
    expect(output).toContain("Affected shots (1)");
  });

  test("内容树模式下命中分镜文件并带出镜头身份", async () => {
    const projectRoot = await createContentTreeImpactProject();
    const result = await analyzeImpact(projectRoot, "雾塔");

    const storyboardHit = result.matches.find((hit) => hit.relPath === "内容/场-001/镜头组-001/镜头-001/分镜-01.md");
    expect(storyboardHit).toBeDefined();
    expect(storyboardHit?.step).toBe(3);
    expect(storyboardHit?.stepDir).toBe("内容");
    expect(storyboardHit?.groupId).toBe("group-001");
    // 分镜-01.md 的文件名推不出镜头编号，必须按所属目录 镜头-001 回退。
    expect(storyboardHit?.shotId).toBe("shot-001");
    expect(storyboardHit?.storyboardId).toBe("storyboard-01");
    expect(result.affectedShots).toContain("shot-001");

    // 内容树里的场总览、镜头组总览、镜头汇总同样要被扫到，不能只扫镜头文件。
    const matchedPaths = result.matches.map((hit) => hit.relPath);
    expect(matchedPaths).toContain("内容/场-001/00_场总览.md");
    expect(matchedPaths).toContain("内容/场-001/镜头组-001/00_镜头组总览.md");
    expect(matchedPaths).toContain("内容/场-001/镜头组-001/镜头-001/00_镜头-001.md");

    const rendered = renderImpactResult(result);
    expect(rendered).toContain("分镜-01.md");
    expect(rendered).toContain("storyboard-01");
    expect(rendered).not.toContain("undefined");
  });

  test("旧格式项目不受内容树扫描影响", async () => {
    const projectRoot = await createImpactProject();
    const result = await analyzeImpact(projectRoot, "荆轲");
    // 没有 content.format_version 时一行内容树结果都不该出现，形状与原来完全一致。
    expect(result.matches.every((hit) => !hit.relPath.startsWith("内容/"))).toBe(true);
    expect(result.matches.every((hit) => hit.storyboardId === undefined)).toBe(true);
    expect(result.matches.every((hit) => hit.stepLabel !== "内容")).toBe(true);
  });
});
