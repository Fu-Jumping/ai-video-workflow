import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import {
  buildShotGraph,
  keyframeIdFromFileName,
  keyframeMappedSegment,
  linkedStepFiles,
  resolveProjectMarkdownLink,
  shotGroupDirectoryName,
  shotGroupIdFromPath,
  shotIdFromFileName,
  storyboardSegmentNumbers,
  videoPromptShotNumbers
} from "../src/lib/shot-graph.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

async function createGraphRoot(): Promise<string> {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-shot-graph-"));
  tempRoots.push(projectRoot);
  for (const step of ["03_分镜脚本", "04_图片提示词", "05_视频提示词"]) {
    await fs.ensureDir(path.join(projectRoot, step));
  }
  return projectRoot;
}

async function writeMarkdown(projectRoot: string, relPath: string, content: string): Promise<void> {
  const filePath = path.join(projectRoot, ...relPath.split("/"));
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
}

describe("shot graph parsing", () => {
  test("normalizes group, shot, keyframe, segment, and relative link identifiers", () => {
    expect(shotGroupIdFromPath("03_分镜脚本/镜头组-1/镜头-7.md")).toBe("group-001");
    expect(shotGroupIdFromPath("03_分镜脚本/shot-group-12/shot-7.md")).toBe("group-012");
    expect(shotGroupDirectoryName("group-9")).toBe("镜头组-009");
    expect(shotIdFromFileName("镜头-7-关键帧-01.md")).toBe("shot-007");
    expect(keyframeIdFromFileName("镜头-7-关键帧-2.md")).toBe("keyframe-02");
    expect(storyboardSegmentNumbers("### 分镜 1\n### 分镜 2\n### 分镜 4\n")).toEqual([1, 2, 4]);
    expect(storyboardSegmentNumbers("### 分镜 2\n### 分镜 1\n")).toEqual([2, 1]);
    expect(videoPromptShotNumbers("镜头1：全景\n镜头2: 近景\n镜头4：特写\n")).toEqual([1, 2, 4]);
    expect(videoPromptShotNumbers("镜头2：近景\n镜头1：全景\n")).toEqual([2, 1]);
    expect(keyframeMappedSegment("- 对应分镜：分镜 3\n")).toBe(3);
    expect(resolveProjectMarkdownLink("03_分镜脚本/镜头组-001/镜头-001.md", "../../04_图片提示词/镜头组-001/镜头-001-关键帧-01.md"))
      .toBe("04_图片提示词/镜头组-001/镜头-001-关键帧-01.md");
  });

  test("recursively builds a four-segment shot with multiple mid-shot keyframes", async () => {
    const projectRoot = await createGraphRoot();
    await writeMarkdown(projectRoot, "03_分镜脚本/镜头组-001/00_镜头组说明.md", "# 镜头组 001\n");
    await writeMarkdown(
      projectRoot,
      "03_分镜脚本/镜头组-001/镜头-001.md",
      [
        "# 镜头 001",
        "### 分镜 1",
        "### 分镜 2",
        "### 分镜 3",
        "### 分镜 4",
        "[关键帧 01](../../04_图片提示词/镜头组-001/镜头-001-关键帧-01.md)",
        "[关键帧 02](../../04_图片提示词/镜头组-001/镜头-001-关键帧-02.md)"
      ].join("\n")
    );
    await writeMarkdown(
      projectRoot,
      "04_图片提示词/镜头组-001/镜头-001-关键帧-01.md",
      "- 镜头组：group-001\n- 镜头编号：shot-001\n- 对应分镜：分镜 2\n- 关键时刻：动作中段\n"
    );
    await writeMarkdown(
      projectRoot,
      "04_图片提示词/镜头组-001/镜头-001-关键帧-02.md",
      "- 镜头组：group-001\n- 镜头编号：shot-001\n- 对应分镜：分镜 4\n- 关键时刻：动作收束\n"
    );
    await writeMarkdown(
      projectRoot,
      "05_视频提示词/镜头组-001/镜头-001.md",
      "镜头1：全景。\n镜头2：中景。\n镜头3：近景。\n镜头4：特写。\n"
    );

    const graph = await buildShotGraph(projectRoot);
    const shot = graph.shots[0];

    expect(graph.groups).toHaveLength(1);
    expect(graph.groups[0]).toEqual(expect.objectContaining({ id: "group-001", directoryName: "镜头组-001" }));
    expect(shot).toEqual(expect.objectContaining({ id: "shot-001", groupId: "group-001" }));
    expect(shot.storyboardSegments).toEqual([1, 2, 3, 4]);
    expect(shot.videoPromptShots).toEqual([1, 2, 3, 4]);
    expect(shot.imagePrompts.map((file) => file.keyframeId)).toEqual(["keyframe-01", "keyframe-02"]);
    expect(shot.imagePrompts.map((file) => keyframeMappedSegment(file.content))).toEqual([2, 4]);
    expect(linkedStepFiles(shot.storyboard!, 4)).toEqual([
      "04_图片提示词/镜头组-001/镜头-001-关键帧-01.md",
      "04_图片提示词/镜头组-001/镜头-001-关键帧-02.md"
    ]);
  });

  test("reports duplicate shot files, cross-group mismatches, and ungrouped files", async () => {
    const projectRoot = await createGraphRoot();
    await writeMarkdown(projectRoot, "03_分镜脚本/镜头组-001/镜头-001.md", "### 分镜 1\n");
    await writeMarkdown(projectRoot, "03_分镜脚本/镜头组-002/镜头-001.md", "### 分镜 1\n");
    await writeMarkdown(projectRoot, "04_图片提示词/镜头组-002/镜头-001-关键帧-01.md", "- 对应分镜：1\n");
    await writeMarkdown(projectRoot, "04_图片提示词/镜头-002-关键帧-01.md", "- 对应分镜：1\n");

    const graph = await buildShotGraph(projectRoot);

    expect(graph.duplicateShotFiles).toEqual([
      expect.objectContaining({ shotId: "shot-001", step: 3 })
    ]);
    expect(graph.groupMismatches).toEqual([
      expect.objectContaining({ shotId: "shot-001", groupIds: ["group-001", "group-002"] })
    ]);
    expect(graph.ungroupedShotFiles).toEqual([
      expect.objectContaining({ shotId: "shot-002", relPath: "04_图片提示词/镜头-002-关键帧-01.md" })
    ]);
  });
});
