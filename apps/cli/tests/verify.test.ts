import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { createProject } from "../src/lib/init.js";
import { exportObsidianVault } from "../src/lib/obsidian/export.js";
import { syncProject } from "../src/lib/sync.js";
import type { Ide, Platform } from "../src/lib/types.js";
import { verifyProject } from "../src/lib/verify.js";

const tempRoots: string[] = [];
const repoRoot = path.resolve(__dirname, "../../..");

async function createSyncedProject(root: string, ide: Ide, videoPlatform: Platform = "veo"): Promise<string> {
  await createProject({
    targetRoot: root,
    projectName: `${ide}-verify-project`,
    pack: "official-ai-video",
    ide,
    imagePlatform: "openai",
    videoPlatform
  });
  const projectRoot = path.join(root, `${ide}-verify-project`);
  await syncProject({
    repoRoot,
    projectRoot,
    ide,
    pack: "official-ai-video"
  });
  return projectRoot;
}

const requiredRuntimeFileByIde: Record<Ide, string> = {
  codex: ".codex/agent-rules.md",
  cursor: ".cursor/rules/ai-video-workflow.mdc",
  "claude-code": ".claude/commands/ai-video-workflow.md",
  trae: ".trae/rules/ai-video-workflow.md"
};

const shotGroupDir = "镜头组-001";
const storyboardRelPath = "03_分镜脚本/镜头组-001/镜头-001.md";
const imagePromptRelPath = "04_图片提示词/镜头组-001/镜头-001-关键帧-01.md";
const videoPromptRelPath = "05_视频提示词/镜头组-001/镜头-001.md";

interface SeedShotContractOptions {
  storyboardAssets?: string[];
  imagePromptAssets?: string[];
  videoPromptAssets?: string[];
  includeVideoPrompt?: boolean;
  missingPlatformMarker?: boolean;
  platform?: Platform;
}

function formatAssets(assets: string[]): string {
  return assets.length > 0 ? assets.join("、") : "已通过关键帧";
}

async function seedShotContract(projectRoot: string, options: SeedShotContractOptions = {}): Promise<void> {
  const storyboardAssets = options.storyboardAssets ?? ["@测试角色三视图", "@测试场景图"];
  const imagePromptAssets = options.imagePromptAssets ?? storyboardAssets;
  const videoPromptAssets = options.videoPromptAssets ?? imagePromptAssets;
  const includeVideoPrompt = options.includeVideoPrompt ?? true;
  const platform = options.platform ?? "veo";
  const imageAssetsText = formatAssets(imagePromptAssets);
  const videoAssetsText = formatAssets(videoPromptAssets);

  await fs.writeFile(
    path.join(projectRoot, "03_分镜脚本", shotGroupDir, "镜头-001.md"),
    [
      "# 镜头 001：雾塔门前",
      "",
      "## 镜头组与目标",
      "",
      "- 镜头组：group-001",
      "- 镜头编号：shot-001",
      "- 目标时长：15 秒",
      "",
      "## 分镜编排",
      "",
      "### 分镜 1",
      "",
      "阿岚站在雾塔门前，停顿后抬头。",
      "",
      "## 关键帧选择",
      "",
      "- 关键帧 01：对应分镜 1 的抬头前关键时刻。",
      "",
      "## 参考资产要求",
      "",
      `- 必带参考资产：${formatAssets(storyboardAssets)}`,
      "",
      "## 下游文件",
      "",
      "- 对应图片提示词：[镜头 001 关键帧 01](../../04_图片提示词/镜头组-001/镜头-001-关键帧-01.md)",
      "- 对应视频提示词：[镜头 001](../../05_视频提示词/镜头组-001/镜头-001.md)"
    ].join("\n"),
    "utf8"
  );
  await fs.writeFile(
    path.join(projectRoot, "04_图片提示词", shotGroupDir, "镜头-001-关键帧-01.md"),
    [
      "# 镜头 001 关键帧 01 图片提示词",
      "",
      "## 维护元信息",
      "",
      "- 镜头组：group-001",
      "- 镜头编号：shot-001",
      "- 对应分镜：分镜 1",
      "- 关键时刻：抬头前",
      `- 必带参考资产：${imageAssetsText}`,
      "",
      "## 快速导读",
      "",
      "- 画面内容：阿岚站在雾塔门前。",
      "",
      "## 中文完整版本",
      "",
      `${imageAssetsText}。阿岚站在雾塔门前。`,
      "",
      "## 可复制提示词",
      "",
      "```text",
      `${imageAssetsText}。阿岚站在雾塔门前。`,
      "避免：现代城市。",
      "```"
    ].join("\n"),
    "utf8"
  );
  if (!includeVideoPrompt) {
    return;
  }
  await fs.writeFile(
    path.join(projectRoot, "05_视频提示词", shotGroupDir, "镜头-001.md"),
    [
      "# 镜头 001 视频提示词",
      "",
      "## 元信息",
      "",
      "- 镜头组：group-001",
      "- 镜头编号：shot-001",
      "- 目标时长：15 秒",
      "",
      "## 平台执行设置",
      "",
      `- 默认视频平台：${platform}`,
      ...(platform === "seedance" ? ["- 执行模型：Seedance 2.0", "- 参考模式：全能参考模式"] : []),
      "- 输入方式：参考素材 + 文本提示词",
      "- 目标时长：15 秒",
      "- 画幅：继承项目目标画幅",
      `- 参考素材：${videoAssetsText}`,
      ...(options.missingPlatformMarker ? [] : ["- 素材上传顺序：先语义参考素材，再关键帧"]),
      "- 负面约束：见文末负面约束",
      "",
      "## 参考素材映射",
      "",
      `- 主体与场景：${videoAssetsText}`,
      "- 关键帧：镜头-001-关键帧-01.md",
      "",
      "## 可复制提示词",
      "",
      "```text",
      `把 ${videoAssetsText} 中的主体与空间绑定为视频参考。`,
      "",
      "生成阿岚在雾塔门前停顿后抬头的视频。",
      "",
      "镜头1：中景正面视角，镜头缓慢推进，阿岚停顿后抬头，雾气轻微流动，伴随风声和衣料摩擦声。",
      "",
      "写实电影画风，冷调自然光，保留环境声和动作声，无配乐、无字幕。",
      "```",
      "",
      "## 负面约束",
      "",
      "- 不得加入配乐或字幕。"
    ].join("\n"),
    "utf8"
  );
}

async function seedSegmentContract(projectRoot: string, segmentCount: number, keyframeSegments: number[]): Promise<void> {
  const assets = ["@测试角色三视图", "@测试场景图"];
  await seedShotContract(projectRoot, {
    storyboardAssets: assets,
    imagePromptAssets: assets,
    videoPromptAssets: assets
  });

  const storyboard = [
    "# 镜头 001：多分镜测试",
    "",
    "## 镜头组与目标",
    "",
    "- 镜头组：group-001",
    "- 镜头编号：shot-001",
    "- 目标时长：15 秒",
    "",
    "## 分镜编排",
    "",
    ...Array.from({ length: segmentCount }, (_, index) => `### 分镜 ${index + 1}\n\n分镜 ${index + 1} 的可见动作。\n`),
    "## 关键帧选择",
    "",
    ...keyframeSegments.map((segment, index) => `- 关键帧 ${String(index + 1).padStart(2, "0")}：对应分镜 ${segment} 的关键时刻。`),
    "",
    "## 参考资产要求",
    "",
    `- 必带参考资产：${formatAssets(assets)}`,
    "",
    "## 下游文件",
    "",
    ...keyframeSegments.map((_, index) => {
      const number = String(index + 1).padStart(2, "0");
      return `- 对应图片提示词：[关键帧 ${number}](../../04_图片提示词/镜头组-001/镜头-001-关键帧-${number}.md)`;
    }),
    "- 对应视频提示词：[镜头 001](../../05_视频提示词/镜头组-001/镜头-001.md)"
  ].join("\n");
  await fs.writeFile(path.join(projectRoot, "03_分镜脚本", shotGroupDir, "镜头-001.md"), storyboard, "utf8");

  const keyframeTemplate = await fs.readFile(path.join(projectRoot, "04_图片提示词", shotGroupDir, "镜头-001-关键帧-01.md"), "utf8");
  for (const [index, segment] of keyframeSegments.entries()) {
    const number = String(index + 1).padStart(2, "0");
    const content = keyframeTemplate
      .replaceAll("关键帧 01", `关键帧 ${number}`)
      .replace("对应分镜：分镜 1", `对应分镜：分镜 ${segment}`)
      .replace("关键时刻：抬头前", `关键时刻：分镜 ${segment} 中段`);
    await fs.writeFile(path.join(projectRoot, "04_图片提示词", shotGroupDir, `镜头-001-关键帧-${number}.md`), content, "utf8");
  }

  const videoPath = path.join(projectRoot, "05_视频提示词", shotGroupDir, "镜头-001.md");
  const videoPrompt = await fs.readFile(videoPath, "utf8");
  const shotSections = Array.from(
    { length: segmentCount },
    (_, index) => `镜头${index + 1}：中景正面视角，镜头平稳推进，主体完成分镜 ${index + 1} 动作，环境连续变化，伴随风声和动作声。`
  ).join("\n");
  await fs.writeFile(videoPath, videoPrompt.replace(/^镜头1：.*$/m, shotSections), "utf8");
}

function step5PlatformExecutionSettings(platform = "veo"): string[] {
  return [
    "## 平台执行设置",
    "",
    `- 默认视频平台：${platform}`,
    "- 输入方式：参考素材 + 文本提示词",
    "- 目标时长：15 秒",
    "- 画幅：继承项目目标画幅",
    "- 参考素材：已通过关键帧",
    "- 素材上传顺序：先语义参考素材，再关键帧",
    "- 负面约束：见文末负面约束",
    ""
  ];
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

describe("verifyProject", () => {
  test("reports a missing project root as a direct issue", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-missing-project-root-"));
    tempRoots.push(root);
    const projectRoot = path.join(root, "missing");

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "missing-project-root",
        path: projectRoot
      })
    ]);
  });

  test("reports a file project root as a direct issue", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-file-project-root-"));
    tempRoots.push(root);
    const projectRoot = path.join(root, "project.md");
    await fs.writeFile(projectRoot, "# Not a directory\n", "utf8");

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "project-root-not-directory",
        path: projectRoot
      })
    ]);
  });

  test("reports invalid project config YAML without throwing", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-invalid-yaml-"));
    tempRoots.push(root);
    await fs.writeFile(path.join(root, "project.config.yaml"), "pack: [unterminated\n", "utf8");

    const result = await verifyProject({
      projectRoot: root,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid-project-config-yaml",
          path: "project.config.yaml"
        })
      ])
    );
  });

  test("reports invalid project config enum and type values", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-invalid-config-values-"));
    tempRoots.push(root);
    await fs.writeFile(
      path.join(root, "project.config.yaml"),
      [
        "pack: unofficial-pack",
        "ide: not-an-ide",
        "platforms:",
        "  image:",
        "    default: open-ai",
        "  video:",
        "    default: not-video",
        "workflow:",
        "  enhanced_flow:",
        "    enabled: yes"
      ].join("\n"),
      "utf8"
    );

    const result = await verifyProject({
      projectRoot: root,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid-project-config", path: "project.config.yaml" })
      ])
    );
  });

  test("reports nested ai-video-workflow projects", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-nested-project-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");
    await fs.ensureDir(path.join(projectRoot, "01_概念策划", "child"));
    await fs.writeFile(path.join(projectRoot, "01_概念策划", "child", "project.config.yaml"), "pack: official-ai-video\n", "utf8");

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "nested-project",
          path: path.join("01_概念策划", "child", "project.config.yaml")
        })
      ])
    );
  });

  test("does not require Step 0 for legacy configs without research_step", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-legacy-no-step0-"));
    tempRoots.push(projectRoot);
    await fs.writeFile(
      path.join(projectRoot, "project.config.yaml"),
      [
        "pack: official-ai-video",
        "ide: codex",
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
    for (const dir of ["01_概念策划", "02_世界设定", "03_分镜脚本", "04_图片提示词", "05_视频提示词", "06_执行计划"]) {
      await fs.ensureDir(path.join(projectRoot, dir));
    }
    await fs.writeFile(path.join(projectRoot, "06_执行计划", "00_执行计划.md"), "# 计划\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "06_执行计划", "01_图片执行计划.md"), "# 图片\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "06_执行计划", "02_视频执行计划.md"), "# 视频\n", "utf8");
    await syncProject({
      repoRoot,
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.issues).not.toEqual(expect.arrayContaining([expect.objectContaining({ code: "missing-step0-file" })]));
  });

  test("reports missing Step 0 template files when research mode is enabled", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-missing-step0-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");
    await fs.remove(path.join(projectRoot, "00_前期研究", "04_创作简报.md"));

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing-step0-file",
          path: path.join("00_前期研究", "04_创作简报.md")
        })
      ])
    );
  });

  test("reports invalid research source ID directories", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-invalid-source-id-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");
    await fs.ensureDir(path.join(projectRoot, "00_前期研究", "_资料库", "source-one"));

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid-research-source-id",
          path: path.join("00_前期研究", "_资料库", "source-one")
        })
      ])
    );
  });

  test("reports possible auth material in research text files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-sensitive-research-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");
    const sourceRoot = path.join(projectRoot, "00_前期研究", "_资料库", "SRC-0001");
    await fs.ensureDir(sourceRoot);
    await fs.writeFile(path.join(sourceRoot, "source-card.md"), "# Source\n\naccess_token: should-not-be-saved\n", "utf8");

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "research-sensitive-auth-material",
          path: path.join("00_前期研究", "_资料库", "SRC-0001", "source-card.md")
        })
      ])
    );
  });

  test("requires main character tri-view and special scene reference assets", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-reference-assets-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");
    await fs.writeFile(path.join(projectRoot, "02_世界设定", "角色设定.md"), "# 角色设定\n\n## 阿岚\n\n- 主角色：是\n- 三视图引用：\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "02_世界设定", "场景设定.md"), "# 场景设定\n\n## 雾塔\n\n- 需要场景图：是\n- 场景图引用：\n", "utf8");

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing-character-triview", path: path.join("02_世界设定", "角色设定.md") }),
        expect.objectContaining({ code: "missing-scene-reference-image", path: path.join("02_世界设定", "场景设定.md") })
      ])
    );
  });

  test("does not treat yes-no placeholders as selected reference asset requirements", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-reference-placeholders-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");
    await fs.writeFile(
      path.join(projectRoot, "02_世界设定", "角色设定.md"),
      "# 角色设定\n\n## 角色细节\n\n### 角色一\n\n- 主角色：是 / 否\n- 三视图引用：@角色名三视图\n",
      "utf8"
    );
    await fs.writeFile(
      path.join(projectRoot, "02_世界设定", "场景设定.md"),
      "# 场景设定\n\n## 场景细节\n\n### 场景一\n\n- 需要场景图：是 / 否\n- 场景图引用：@场景名场景图\n",
      "utf8"
    );

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(true);
    expect(result.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing-character-triview" }),
        expect.objectContaining({ code: "missing-scene-reference-image" })
      ])
    );
  });

  test("requires Step 4 prompts to carry storyboard reference assets", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-reference-trace-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");
    await fs.writeFile(path.join(projectRoot, "02_世界设定", "角色设定.md"), "# 角色设定\n\n## 阿岚\n\n- 主角色：是\n- 三视图引用：@阿岚三视图\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "02_世界设定", "场景设定.md"), "# 场景设定\n\n## 雾塔\n\n- 需要场景图：是\n- 场景图引用：@雾塔场景图\n", "utf8");
    await fs.writeFile(
      path.join(projectRoot, "03_分镜脚本", "镜头-001.md"),
      [
        "# 镜头 001：雾塔门前",
        "",
        "## 镜头目标",
        "- 对应步骤四：[镜头 001 关键帧图片提示词](../04_图片提示词/镜头-001-关键帧.md)",
        "",
        "## 参考资产要求",
        "",
        "- 主角色三视图：@阿岚三视图",
        "- 场景设定图：@雾塔场景图"
      ].join("\n"),
      "utf8"
    );
    await fs.writeFile(
      path.join(projectRoot, "04_图片提示词", "镜头-001-关键帧.md"),
      [
        "# 镜头 001 关键帧图片提示词",
        "",
        "## 快速导读",
        "",
        "- 画面内容：阿岚站在雾塔门前。",
        "",
        "## 中文完整版本",
        "",
        "阿岚站在雾塔门前。",
        "",
        "## 可复制提示词",
        "",
        "```text",
        "阿岚站在雾塔门前。",
        "避免：现代城市。",
        "```"
      ].join("\n"),
      "utf8"
    );
    await fs.remove(path.join(projectRoot, "03_分镜脚本", "镜头-001.md"));
    await fs.remove(path.join(projectRoot, "04_图片提示词", "镜头-001-关键帧.md"));
    await seedShotContract(projectRoot, {
      storyboardAssets: ["@阿岚三视图", "@雾塔场景图"],
      imagePromptAssets: [],
      includeVideoPrompt: false
    });

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing-step4-reference-asset", path: imagePromptRelPath })
      ])
    );
  });

  test("requires Step 5 prompts to carry Step 4 character and scene reference assets", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-reference-video-trace-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");
    await fs.writeFile(path.join(projectRoot, "02_世界设定", "角色设定.md"), "# 角色设定\n\n## 阿岚\n\n- 主角色：是\n- 三视图引用：@阿岚三视图\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "02_世界设定", "场景设定.md"), "# 场景设定\n\n## 雾塔\n\n- 需要场景图：是\n- 场景图引用：@雾塔场景图\n", "utf8");
    await fs.writeFile(
      path.join(projectRoot, "03_分镜脚本", "镜头-001.md"),
      [
        "# 镜头 001：雾塔门前",
        "",
        "## 镜头目标",
        "- 对应步骤四：[镜头 001 关键帧图片提示词](../04_图片提示词/镜头-001-关键帧.md)",
        "",
        "## 参考资产要求",
        "",
        "- 主角色三视图：@阿岚三视图",
        "- 场景设定图：@雾塔场景图"
      ].join("\n"),
      "utf8"
    );
    await fs.writeFile(
      path.join(projectRoot, "04_图片提示词", "镜头-001-关键帧.md"),
      [
        "# 镜头 001 关键帧图片提示词",
        "",
        "## 快速导读",
        "",
        "- 必带参考资产：@阿岚三视图、@雾塔场景图",
        "",
        "## 中文完整版本",
        "",
        "参考 @阿岚三视图、@雾塔场景图。阿岚站在雾塔门前。",
        "",
        "## 可复制提示词",
        "",
        "```text",
        "参考 @阿岚三视图、@雾塔场景图。阿岚站在雾塔门前。",
        "避免：现代城市。",
        "```"
      ].join("\n"),
      "utf8"
    );
    await fs.writeFile(
      path.join(projectRoot, "05_视频提示词", "镜头-001.md"),
      [
        "# 镜头 001 视频提示词",
        "",
        "## 视频动作链",
        "",
        "以已通过的关键帧作为首帧，阿岚在雾塔门前停顿后抬头。"
      ].join("\n"),
      "utf8"
    );
    await fs.remove(path.join(projectRoot, "03_分镜脚本", "镜头-001.md"));
    await fs.remove(path.join(projectRoot, "04_图片提示词", "镜头-001-关键帧.md"));
    await fs.remove(path.join(projectRoot, "05_视频提示词", "镜头-001.md"));
    await seedShotContract(projectRoot, {
      storyboardAssets: ["@阿岚三视图", "@雾塔场景图"],
      imagePromptAssets: ["@阿岚三视图", "@雾塔场景图"],
      videoPromptAssets: [],
      includeVideoPrompt: true
    });

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing-step5-reference-asset", path: videoPromptRelPath })
      ])
    );
  });

  test("accepts Step 5 prompts that carry Step 4 character and scene reference assets", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-reference-video-pass-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");
    await fs.writeFile(path.join(projectRoot, "02_世界设定", "角色设定.md"), "# 角色设定\n\n## 阿岚\n\n- 主角色：是\n- 三视图引用：@阿岚三视图\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "02_世界设定", "场景设定.md"), "# 场景设定\n\n## 雾塔\n\n- 需要场景图：是\n- 场景图引用：@雾塔场景图\n", "utf8");
    await fs.writeFile(
      path.join(projectRoot, "03_分镜脚本", "镜头-001.md"),
      [
        "# 镜头 001：雾塔门前",
        "",
        "## 镜头目标",
        "- 对应步骤四：[镜头 001 关键帧图片提示词](../04_图片提示词/镜头-001-关键帧.md)",
        "",
        "## 参考资产要求",
        "",
        "- 主角色三视图：@阿岚三视图",
        "- 场景设定图：@雾塔场景图"
      ].join("\n"),
      "utf8"
    );
    await fs.writeFile(
      path.join(projectRoot, "04_图片提示词", "镜头-001-关键帧.md"),
      [
        "# 镜头 001 关键帧图片提示词",
        "",
        "## 快速导读",
        "",
        "- 必带参考资产：@阿岚三视图、@雾塔场景图",
        "",
        "## 中文完整版本",
        "",
        "参考 @阿岚三视图、@雾塔场景图。阿岚站在雾塔门前。",
        "",
        "## 可复制提示词",
        "",
        "```text",
        "参考 @阿岚三视图、@雾塔场景图。阿岚站在雾塔门前。",
        "避免：现代城市。",
        "```"
      ].join("\n"),
      "utf8"
    );
    await fs.writeFile(
      path.join(projectRoot, "05_视频提示词", "镜头-001.md"),
      [
        "# 镜头 001 视频提示词",
        "",
        "## 视觉参考来源",
        "",
        "- 继承参考资产：@阿岚三视图、@雾塔场景图",
        "",
        ...step5PlatformExecutionSettings(),
        "## 视频动作链",
        "",
        "以已通过的关键帧作为首帧，延续 @阿岚三视图、@雾塔场景图。阿岚在雾塔门前停顿后抬头。"
      ].join("\n"),
      "utf8"
    );
    await fs.remove(path.join(projectRoot, "03_分镜脚本", "镜头-001.md"));
    await fs.remove(path.join(projectRoot, "04_图片提示词", "镜头-001-关键帧.md"));
    await fs.remove(path.join(projectRoot, "05_视频提示词", "镜头-001.md"));
    await seedShotContract(projectRoot, {
      storyboardAssets: ["@阿岚三视图", "@雾塔场景图"],
      imagePromptAssets: ["@阿岚三视图", "@雾塔场景图"],
      videoPromptAssets: ["@阿岚三视图", "@雾塔场景图"],
      includeVideoPrompt: true
    });

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result).toEqual({ ok: true, issues: [] });
  });

  test("requires Step 5 prompts to declare platform execution settings", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-video-platform-settings-missing-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");
    await fs.writeFile(
      path.join(projectRoot, "05_视频提示词", "镜头-001.md"),
      [
        "# 镜头 001 视频提示词",
        "",
        "## 视频动作链",
        "",
        "以已通过的关键帧作为首帧，阿岚在雾塔门前停顿后抬头。"
      ].join("\n"),
      "utf8"
    );
    await fs.remove(path.join(projectRoot, "05_视频提示词", "镜头-001.md"));
    await seedShotContract(projectRoot, { missingPlatformMarker: true });

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing-step5-platform-execution-setting", path: videoPromptRelPath })
      ])
    );
  });

  test("accepts Step 5 prompts with platform execution settings", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-video-platform-settings-pass-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");
    await fs.writeFile(
      path.join(projectRoot, "05_视频提示词", "镜头-001.md"),
      [
        "# 镜头 001 视频提示词",
        "",
        ...step5PlatformExecutionSettings(),
        "## 视频动作链",
        "",
        "以已通过的关键帧作为首帧，阿岚在雾塔门前停顿后抬头。"
      ].join("\n"),
      "utf8"
    );
    await fs.remove(path.join(projectRoot, "05_视频提示词", "镜头-001.md"));
    await seedShotContract(projectRoot);

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result).toEqual({ ok: true, issues: [] });
  });

  test("accepts four storyboard segments with multiple keyframes including a mid-shot moment", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-four-segment-shot-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");
    await seedSegmentContract(projectRoot, 4, [2, 4]);

    const result = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video" });

    expect(result).toEqual({ ok: true, issues: [] });
  });

  test("rejects a fifth storyboard segment", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-five-segment-shot-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");
    await seedSegmentContract(projectRoot, 5, [3]);

    const result = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video" });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "invalid-storyboard-segment-count", path: storyboardRelPath })])
    );
  });

  test.each([
    ["music", "无字幕"],
    ["subtitles", "无配乐"]
  ])("rejects Step 5 prompts missing the default no-%s constraint", async (_label, replacement) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-no-audio-constraint-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");
    await seedShotContract(projectRoot);
    const videoPath = path.join(projectRoot, "05_视频提示词", shotGroupDir, "镜头-001.md");
    const content = await fs.readFile(videoPath, "utf8");
    await fs.writeFile(videoPath, content.replace("无配乐、无字幕", replacement), "utf8");

    const result = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video" });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "invalid-step5-contract", path: videoPromptRelPath })])
    );
  });

  test("preserves environment sound and dialogue without requiring music", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-dialogue-sound-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");
    await seedShotContract(projectRoot);
    const videoPath = path.join(projectRoot, "05_视频提示词", shotGroupDir, "镜头-001.md");
    const content = await fs.readFile(videoPath, "utf8");
    await fs.writeFile(videoPath, content.replace("伴随风声和衣料摩擦声。", "伴随风声、衣料摩擦声和台词：‘停下！’。"), "utf8");

    const result = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video" });

    expect(result).toEqual({ ok: true, issues: [] });
  });

  test("accepts Seedance 2.0 full-reference execution settings", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-seedance-contract-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex", "seedance");
    await seedShotContract(projectRoot, { platform: "seedance" });

    const result = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video" });

    expect(result).toEqual({ ok: true, issues: [] });
  });

  test.each<Ide>(["codex", "cursor", "claude-code", "trae"])("passes IDE runtime verification for synced %s projects", async (ide) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-verify-runtime-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, ide);

    const result = await verifyProject({
      projectRoot,
      ide,
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(true);
  });

  test.each<Ide>(["codex", "cursor", "claude-code", "trae"])("reports missing IDE runtime files for %s", async (ide) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-missing-runtime-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, ide);
    const missingPath = requiredRuntimeFileByIde[ide];
    await fs.remove(path.join(projectRoot, missingPath));

    const result = await verifyProject({
      projectRoot,
      ide,
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing-ide-runtime",
          path: missingPath
        })
      ])
    );
  });

  test("reports a missing shared agent entry", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-missing-shared-entry-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");
    await fs.remove(path.join(projectRoot, "AGENTS.md"));

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing-shared-agent-entry",
          path: "AGENTS.md"
        })
      ])
    );
  });

  test("reports custom AGENTS as a merge task when Cherry host surfaces exist", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-agents-merge-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");

    await fs.writeFile(path.join(projectRoot, "AGENTS.md"), "# Custom Agents\n\nRead SOUL.md first.\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "SOUL.md"), "# Soul\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "USER.md"), "# User\n", "utf8");
    await fs.ensureDir(path.join(projectRoot, "memory"));

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "shared-agent-entry-needs-merge",
          path: "AGENTS.md"
        })
      ])
    );
  });

  test("accepts custom AGENTS after the ai-video-workflow merge block is added", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-agents-merged-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");

    await fs.writeFile(
      path.join(projectRoot, "AGENTS.md"),
      [
        "# Custom Agents",
        "",
        "Read `SOUL.md` and `USER.md` for Cherry Studio host context.",
        "",
        "## ai-video-workflow",
        "",
        "标记：ai-video-workflow 共享智能体入口。",
        "",
        "- 修改文件前读取 `文档/智能体工作区/入口说明.md`。",
        "- 将 `project-step-files` 作为事实源。"
      ].join("\n"),
      "utf8"
    );

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(true);
  });

  test("reports a missing shared agent doc", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-missing-shared-doc-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "cursor");
    await fs.remove(path.join(projectRoot, "文档", "智能体工作区", "边界说明.md"));

    const result = await verifyProject({
      projectRoot,
      ide: "cursor",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing-shared-agent-doc",
          path: "文档/智能体工作区/边界说明.md"
        })
      ])
    );
  });

  test("reports a missing entrypoint reconciliation shared agent doc", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-missing-entrypoint-doc-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "cursor");
    const docPath = "文档/智能体工作区/入口协调.md";
    await fs.remove(path.join(projectRoot, docPath));

    const result = await verifyProject({
      projectRoot,
      ide: "cursor",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing-shared-agent-doc",
          path: docPath
        })
      ])
    );
  });

  test("reports an invalid entrypoint reconciliation shared agent doc", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-invalid-entrypoint-doc-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "cursor");
    const docPath = "文档/智能体工作区/入口协调.md";
    await fs.writeFile(path.join(projectRoot, docPath), "# Entrypoint Reconciliation\n", "utf8");

    const result = await verifyProject({
      projectRoot,
      ide: "cursor",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid-shared-agent-doc",
          path: docPath
        })
      ])
    );
  });

  test("reports runtime entries that do not point to the shared workspace", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-runtime-conflict-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "trae");
    await fs.writeFile(
      path.join(projectRoot, ".trae", "rules", "ai-video-workflow.md"),
      "# Trae Runtime\n\nThe .trae runtime mirror is the source of truth for this project.\n",
      "utf8"
    );

    const result = await verifyProject({
      projectRoot,
      ide: "trae",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "agent-runtime-conflict",
          path: ".trae/rules/ai-video-workflow.md"
        })
      ])
    );
  });

  test("finds missing Step 6 files, invalid Step 4 contracts, and absolute path links", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-verify-"));
    tempRoots.push(root);

    const projectRoot = path.join(root, "bad-project");
    await fs.ensureDir(path.join(projectRoot, "04_图片提示词"));
    await fs.ensureDir(path.join(projectRoot, "06_执行计划"));
    await fs.writeFile(
      path.join(projectRoot, "project.config.yaml"),
      [
        "pack: official-ai-video",
        "ide: codex",
        "platforms:",
        "  image:",
        "    default: openai",
        "workflow:",
        "  enhanced_flow:",
        "    enabled: true"
      ].join("\n"),
      "utf8"
    );
    await fs.writeFile(
      path.join(projectRoot, "04_图片提示词", "shot-01.md"),
      [
        "# Shot 01",
        "",
        "快速导读",
        "",
        "主体在夜色中前行。",
        "",
        "中文完整版本",
        "",
        "参考前文继续写，模型应自行理解剧情。",
        "",
        "可复制提示词",
        "",
        "主体在夜色中前行。",
        "",
        "[bad](G:\\absolute\\path.md)"
      ].join("\n"),
      "utf8"
    );

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "missing-step6-file",
        "missing-step4-section",
        "absolute-path-link",
        "step4-forbidden-text",
        "invalid-project-config"
      ])
    );
  });

  test("finds absolute links outside Step 4 markdown files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-links-"));
    tempRoots.push(root);

    const projectRoot = path.join(root, "bad-links");
    await fs.ensureDir(path.join(projectRoot, "01_概念策划"));
    await fs.ensureDir(path.join(projectRoot, "06_执行计划"));
    await fs.writeFile(
      path.join(projectRoot, "project.config.yaml"),
      [
        "pack: official-ai-video",
        "ide: codex",
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
    await fs.writeFile(path.join(projectRoot, "06_执行计划", "00_执行计划.md"), "# 计划\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "06_执行计划", "01_图片执行计划.md"), "# 图片\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "06_执行计划", "02_视频执行计划.md"), "# 视频\n", "utf8");
    await fs.writeFile(
      path.join(projectRoot, "01_概念策划", "story.md"),
      "[bad](file:///C:/Users/example/story.md)\n",
      "utf8"
    );

    const result = await verifyProject({
      projectRoot,
      ide: "cursor",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "absolute-path-link",
          path: path.join("01_概念策划", "story.md")
        })
      ])
    );
  });

  test("ignores Cherry Studio host surfaces during project Markdown link checks", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-cherry-host-surfaces-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");

    await fs.writeFile(path.join(projectRoot, "SOUL.md"), "[local](G:\\private\\soul.md)\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "USER.md"), "[local](file:///C:/Users/example/user.md)\n", "utf8");
    await fs.ensureDir(path.join(projectRoot, "memory"));
    await fs.writeFile(path.join(projectRoot, "memory", "README.md"), "[local](G:\\private\\memory.md)\n", "utf8");

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(true);
    expect(result.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "absolute-path-link"
        })
      ])
    );
  });

  test("ignores generated Obsidian view layers during project Markdown link checks", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-views-link-checks-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");
    const outRoot = path.join(projectRoot, "_views", "obsidian");

    await exportObsidianVault({ projectRoot, outRoot, force: true, includePluginRecipes: true, inProjectView: true });
    await fs.writeFile(path.join(outRoot, "04_个人笔记", "manual.md"), "[local](G:\\private\\note.md)\n", "utf8");
    await fs.writeFile(path.join(outRoot, "01_阶段审核", "manual-generated.md"), "[local](file:///C:/private/generated.md)\n", "utf8");

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(true);
    expect(result.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "absolute-path-link"
        })
      ])
    );
  });

  test("ignores root Obsidian UI state during project Markdown link checks", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-root-obsidian-link-checks-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");

    await fs.ensureDir(path.join(projectRoot, ".obsidian", "plugins", "example"));
    await fs.writeFile(path.join(projectRoot, ".obsidian", "plugins", "example", "README.md"), "[local](C:\\private\\config.md)\n", "utf8");

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(true);
    expect(result.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "absolute-path-link"
        })
      ])
    );
  });

  test("requires storyboard files to link to existing Step 4 prompt files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-trace-"));
    tempRoots.push(root);

    const projectRoot = path.join(root, "bad-trace");
    await fs.ensureDir(path.join(projectRoot, "03_分镜脚本", shotGroupDir));
    await fs.ensureDir(path.join(projectRoot, "04_图片提示词", shotGroupDir));
    await fs.ensureDir(path.join(projectRoot, "06_执行计划"));
    await fs.writeFile(
      path.join(projectRoot, "project.config.yaml"),
      [
        "pack: official-ai-video",
        "ide: codex",
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
    await fs.writeFile(path.join(projectRoot, "06_执行计划", "00_执行计划.md"), "# 计划\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "06_执行计划", "01_图片执行计划.md"), "# 图片\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "06_执行计划", "02_视频执行计划.md"), "# 视频\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "03_分镜脚本", shotGroupDir, "00_镜头组说明.md"), "# 镜头组 001\n", "utf8");
    await fs.writeFile(
      path.join(projectRoot, "03_分镜脚本", shotGroupDir, "镜头-001.md"),
      [
        "# 镜头 001",
        "",
        "## 分镜编排",
        "",
        "### 分镜 1",
        "",
        "测试画面。",
        "",
        "[missing](../../04_图片提示词/镜头组-001/missing.md)"
      ].join("\n"),
      "utf8"
    );

    const result = await verifyProject({
      projectRoot,
      ide: "cursor",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "broken-step3-step4-link",
          path: storyboardRelPath
        })
      ])
    );
  });
});
