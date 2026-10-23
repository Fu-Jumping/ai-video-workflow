import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { assembleContentTree } from "../src/lib/content-assemble.js";
import { renderAutoBlock, renderManualBlock } from "../src/lib/content-tree.js";
import { createProject } from "../src/lib/init.js";
import { buildLibTvPlan } from "../src/lib/libtv/assets.js";
import { buildPlan, renderPlan } from "../src/lib/libtv/plan.js";
import { syncProject } from "../src/lib/sync.js";

const exampleRoot = path.resolve(__dirname, "..", "..", "..", "examples", "官方示例-云上早市");
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

describe("libtv plan from official example", () => {
  test("discovers anchors, keyframes, videos, and groups", async () => {
    const plan = await buildLibTvPlan(exampleRoot);
    expect(plan.anchors.map((anchor) => anchor.token)).toEqual([
      "@罗婆婆三视图",
      "@沈安三视图",
      "@小满三视图",
      "@小镇修伞铺场景图",
      "@云上早市场景图",
      "@镇口晨光场景图"
    ]);
    expect(plan.keyframes).toHaveLength(3);
    expect(plan.videos).toHaveLength(3);
    expect(plan.groups).toEqual(["group-001"]);
    for (const keyframe of plan.keyframes) {
      expect(keyframe.prompt.length).toBeGreaterThan(0);
    }
    for (const video of plan.videos) {
      expect(video.prompt.length).toBeGreaterThan(0);
    }
  });
});

describe("libtv model mapping", () => {
  test("official example maps seedance video to star-video2", async () => {
    const plan = await buildLibTvPlan(exampleRoot);
    expect(plan.videos.every((video) => video.modelKey === "star-video2")).toBe(true);
  });

  test("gpt-image-2 maps to LibTV lib-image-2", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "avw-libtv-gpt-image-2-"));
    tempRoots.push(projectRoot);
    await fs.copy(exampleRoot, projectRoot);
    await fs.writeFile(
      path.join(projectRoot, "project.config.yaml"),
      [
        "pack: official-ai-video",
        "ide: codex",
        "platforms:",
        "  image:",
        "    default: gpt-image-2",
        "  video:",
        "    default: seedance",
        "workflow:",
        "  enhanced_flow:",
        "    enabled: true"
      ].join("\n"),
      "utf8"
    );
    const plan = await buildLibTvPlan(projectRoot);
    expect(plan.keyframes.every((item) => item.modelKey === "lib-image-2")).toBe(true);
  });

  test("project libtv config overrides image model", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "avw-libtv-model-"));
    tempRoots.push(projectRoot);
    await fs.copy(exampleRoot, projectRoot);
    await fs.writeFile(
      path.join(projectRoot, "project.config.yaml"),
      [
        "pack: official-ai-video",
        "ide: codex",
        "platforms:",
        "  image:",
        "    default: midjourney",
        "  video:",
        "    default: seedance",
        "workflow:",
        "  enhanced_flow:",
        "    enabled: true",
        "libtv:",
        "  image_model: mj-v8.2",
        "  video_model: star-video2"
      ].join("\n"),
      "utf8"
    );
    const plan = await buildLibTvPlan(projectRoot);
    expect(plan.keyframes.every((item) => item.modelKey === "mj-v8.2")).toBe(true);
    expect(plan.videos.every((item) => item.modelKey === "star-video2")).toBe(true);
  });
});


/* ---------------------- 内容树：生成准备计划带分镜身份 ---------------------- */

const FENCE = "\u0060\u0060\u0060";
const NL = String.fromCharCode(10);

/**
 * 内容树项目夹具：声明 content.format_version=1，正文写在 内容/ 下，
 * 再用 assembleContentTree 生成 04／05 执行文件（生成准备计划读的是这两个目录）。
 */
async function createContentTreePlanProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "avw-libtv-plan-content-"));
  tempRoots.push(root);
  await createProject({
    targetRoot: root,
    projectName: "content-plan",
    pack: "official-ai-video",
    ide: "codex",
    imagePlatform: "openai",
    videoPlatform: "seedance"
  });
  const projectRoot = path.join(root, "content-plan");
  await syncProject({ repoRoot, projectRoot, ide: "codex", pack: "official-ai-video" });

  const shotDirectory = path.join(projectRoot, "内容", "场-001", "镜头组-001", "镜头-001");
  await fs.ensureDir(shotDirectory);
  await fs.writeFile(
    path.join(projectRoot, "内容", "场-001", "00_场总览.md"),
    "# 场-001 场总览" + NL + NL + "## 这一场讲什么" + NL + NL + "雾塔门前的清晨。" + NL,
    "utf8"
  );
  await fs.writeFile(
    path.join(projectRoot, "内容", "场-001", "镜头组-001", "00_镜头组总览.md"),
    "# 镜头组-001 镜头组总览" + NL + NL + "## 这一组讲什么" + NL + NL + "开场。" + NL,
    "utf8"
  );
  await fs.writeFile(
    path.join(shotDirectory, "00_镜头-001.md"),
    [
      "# 镜头 001：雾塔门前",
      "",
      "- 观看顺序：1",
      "- 目标时长：15 秒",
      "",
      "## 一、分镜速览",
      "",
      renderAutoBlock("分镜速览", "（待刷新）"),
      "",
      "## 二、图片提示词",
      "",
      renderAutoBlock("图片提示词", "（待刷新）"),
      "",
      "## 三、完整视频提示词",
      "",
      renderManualBlock("视频提示词前段", "整镜公共说明：@阿岚三视图 绑定到本镜。"),
      "",
      renderAutoBlock("镜头段拼装", "（待拼装）"),
      "",
      renderManualBlock("视频提示词后段", "写实电影画风，无配乐、无字幕。"),
      ""
    ].join(NL),
    "utf8"
  );
  await fs.writeFile(
    path.join(shotDirectory, "分镜-01.md"),
    [
      "# 分镜-01：停步抬头",
      "",
      "## 一、本段正文（画面与动作）",
      "",
      "- **景别与视角**：中景正面。",
      "- **人物与位置**：阿岚居中。",
      "",
      "## 二、关键帧",
      "",
      "#### 关键帧 01",
      "",
      "- 对应分镜：分镜 1",
      "- 关键时刻：抬头的一瞬",
      "",
      FENCE + "text",
      "阿岚站在雾塔门前抬头，冷调自然光。",
      FENCE,
      "",
      "## 三、视频提示词片段",
      "",
      FENCE + "text",
      "镜头1：中景正面，阿岚在雾塔门前停步抬头，风声。",
      FENCE,
      ""
    ].join(NL),
    "utf8"
  );

  const assembled = await assembleContentTree(projectRoot, { force: true });
  expect(assembled.ok).toBe(true);
  return projectRoot;
}

describe("libtv order tokens", () => {
  test("official example video refs include upload order tokens", async () => {
    const plan = await buildLibTvPlan(exampleRoot);
    expect(plan.videos[0].orderTokens).toBeDefined();
    expect(plan.videos[0].orderTokens!.length).toBeGreaterThanOrEqual(4);
  });
});


describe("libtv generation plan carries storyboard identity in content-tree mode", () => {
  test("keyframes and videos name the storyboard each one belongs to", async () => {
    const projectRoot = await createContentTreePlanProject();
    const plan = await buildPlan(projectRoot);

    expect(plan.keyframes.length).toBe(1);
    expect(plan.videos.length).toBe(1);
    const keyframe = plan.keyframes[0]!;
    const video = plan.videos[0]!;
    // 旧字段口径不变：groupId / shotId / keyframeId 继续是身份主轴。
    expect(keyframe.groupId).toBe("group-001");
    expect(keyframe.shotId).toBe("shot-001");
    expect(keyframe.keyframeId).toBe("keyframe-01");
    expect(video.groupId).toBe("group-001");
    expect(video.shotId).toBe("shot-001");

    // 内容树模式额外带分镜身份，说明这张关键帧属于哪一段。
    expect(plan.storyboards?.keyframes["group-001/shot-001/keyframe-01"]).toBe("storyboard-01");
    expect(plan.storyboards?.videos["group-001/shot-001"]).toEqual(["storyboard-01"]);

    const rendered = renderPlan(plan);
    expect(rendered).toContain("分镜=storyboard-01");
    expect(rendered).not.toContain("undefined");
    expect(rendered).not.toMatch(/[A-Z]:\\|[A-Z]:\/|file:\/\/|vscode:\/\//);
  });

  test("legacy projects never grow a storyboards field", async () => {
    const plan = await buildPlan(exampleRoot);
    expect(plan.storyboards).toBeUndefined();
    expect(renderPlan(plan)).not.toContain("分镜=");
  });
});

