import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { analyzeImpact, analyzeImageNodeImpact, renderImpactResult } from "../src/lib/impact.js";
import { writeState } from "../src/lib/libtv/project-binding.js";
import type { LibTvState } from "../src/lib/libtv/types.js";

const tempRoots: string[] = [];

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
    expect(result.reviewCandidates).toEqual([
      "04_图片提示词/镜头组-001/镜头-001-关键帧-01.md",
      "05_视频提示词/镜头组-001/镜头-001.md"
    ]);
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
});
