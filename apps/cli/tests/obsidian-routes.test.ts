import { describe, expect, test } from "vitest";

import { workflowVaultPath } from "../src/lib/obsidian/markdown.js";
import {
  agentHandoffPath,
  notesIndexLink,
  notesIndexPath,
  projectHomePath,
  productionBoardPath,
  reviewMapCanvasPath,
  reviewOverviewPath,
  shotBasePath,
  shotGroupPagePath,
  shotPipelineCanvasPath,
  shotReviewCanvasPath,
  singleShotPagePath,
  stageReviewDirectory,
  stageReviewHubPath,
  stageReviewPath,
  workflowBasePath,
  workflowCanvasPath,
  userNotesDirectory,
  reviewToolsDirectory
} from "../src/lib/obsidian/routes.js";

describe("Obsidian viewing-layer route contract", () => {
  test("projects research and story sources under the stage-review root", () => {
    expect(
      workflowVaultPath({
        sourcePath: "00_前期研究/研究总览.md",
        sourceKind: "research",
        step: 0,
        title: "研究总览"
      })
    ).toBe("01_阶段审核/00_前期研究/研究总览.md");
    expect(
      workflowVaultPath({
        sourcePath: "01_概念策划/故事内核.md",
        sourceKind: "concept",
        step: 1,
        title: "故事内核"
      })
    ).toBe("01_阶段审核/01_概念策划/故事内核.md");
  });

  test("projects shot-aligned sources under their stage and group directories", () => {
    expect(
      workflowVaultPath({
        sourcePath: "03_分镜脚本/镜头组-001/镜头-001.md",
        sourceKind: "storyboard",
        step: 3,
        title: "镜头 001",
        shotGroupId: "group-001",
        shotId: "shot-001"
      })
    ).toBe("01_阶段审核/03_分镜脚本/镜头组-001/镜头 001 - 分镜脚本.md");
    expect(
      workflowVaultPath({
        sourcePath: "04_图片提示词/镜头组-001/镜头-001-关键帧-01.md",
        sourceKind: "image-prompt",
        step: 4,
        title: "镜头 001 关键帧 01",
        shotGroupId: "group-001",
        shotId: "shot-001"
      })
    ).toBe("01_阶段审核/04_图片提示词/镜头组-001/镜头 001 关键帧 01 - 图片提示词.md");
    expect(
      workflowVaultPath({
        sourcePath: "05_视频提示词/镜头组-001/镜头-001.md",
        sourceKind: "video-prompt",
        step: 5,
        title: "镜头 001",
        shotGroupId: "group-001",
        shotId: "shot-001"
      })
    ).toBe("01_阶段审核/05_视频提示词/镜头组-001/镜头 001 - 视频提示词.md");
  });

  test("exposes stage, shot, canvas, notes, and global tool routes", () => {
    expect(stageReviewDirectory).toBe("01_阶段审核");
    expect(stageReviewPath(3)).toBe("01_阶段审核/03_分镜脚本");
    expect(stageReviewHubPath(3)).toBe("01_阶段审核/03_分镜脚本/00_阶段审核.md");
    expect(singleShotPagePath("shot-001")).toBe("02_按镜头联查/单镜头/shot-001.md");
    expect(shotGroupPagePath("group-001")).toBe("02_按镜头联查/镜头组/group-001.md");
    expect(shotReviewCanvasPath("shot-001")).toBe("02_按镜头联查/逐镜头审阅画布/shot-001.canvas");
    expect(notesIndexPath).toBe("04_个人笔记/说明.md");
    expect(notesIndexLink).toBe("04_个人笔记/说明");
    expect(projectHomePath).toBe("00_开始审阅/00_项目首页.md");
    expect(reviewOverviewPath).toBe("00_开始审阅/01_审阅总览.md");
    expect(productionBoardPath).toBe("03_审阅工具/00_制作看板.md");
    expect(agentHandoffPath).toBe("03_审阅工具/01_智能体交接.md");
    expect(workflowBasePath).toBe("03_审阅工具/数据看板/流程文件.base");
    expect(shotBasePath).toBe("03_审阅工具/数据看板/镜头.base");
    expect(reviewMapCanvasPath).toBe("03_审阅工具/全局画布/审阅地图.canvas");
    expect(workflowCanvasPath).toBe("03_审阅工具/全局画布/流程图.canvas");
    expect(shotPipelineCanvasPath).toBe("03_审阅工具/全局画布/镜头流水线.canvas");
    expect(reviewToolsDirectory).toBe("03_审阅工具");
    expect(userNotesDirectory).toBe("04_个人笔记");
  });

  test("never emits the retired top-level viewing-layer roots", () => {
    const routes = [
      workflowVaultPath({ sourcePath: "01_概念策划/故事内核.md", sourceKind: "concept", step: 1, title: "故事内核" }),
      stageReviewPath(1),
      stageReviewHubPath(1),
      singleShotPagePath("shot-001"),
      shotGroupPagePath("group-001"),
      shotReviewCanvasPath("shot-001"),
      notesIndexPath,
      projectHomePath,
      reviewOverviewPath,
      productionBoardPath,
      agentHandoffPath,
      workflowBasePath,
      shotBasePath,
      reviewMapCanvasPath,
      workflowCanvasPath,
      shotPipelineCanvasPath
    ];
    for (const route of routes) {
      expect(route).not.toMatch(/^(流程|镜头|镜头组|画布|数据表|模板|笔记)(?:\/|$)/u);
      expect(route).not.toContain("\\");
    }
  });
});
