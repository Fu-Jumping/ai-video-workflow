import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { parseShotDocument, parseStoryboardDocument } from "../src/lib/content-tree.js";
import { createProject } from "../src/lib/init.js";
import { extractReferenceAssets, findMissingCharacterTriViews, findMissingSceneReferenceImages } from "../src/lib/reference-assets.js";
import { verifyProject } from "../src/lib/verify.js";

/**
 * Template compliance guards: the official templates must never drift away from the checker
 * contracts ("fill-in from template then verify" must pass). Both test rounds found issues of
 * exactly this class: a template self-check containing literal `@xx三视图` placeholders was read
 * as a real reference asset, and Step 2 templates used a nested heading structure the checker
 * does not support.
 */

const tempRoots: string[] = [];
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const packTemplatesRoot = path.join(repoRoot, "packs", "official-ai-video", "templates");

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

describe("template compliance", () => {
  test("Step 4 template self-check must not contain literal reference asset placeholders", async () => {
    const template = await fs.readFile(path.join(packTemplatesRoot, "04_图片提示词", "图片提示词.md"), "utf8");
    const selfCheck = template.slice(template.indexOf("## 中文自检"));
    expect(selfCheck).not.toMatch(/@[^@\s，。、；;：:（）()【】\[\]<>《》"'`]+?(三视图|场景图)/u);
  });

  test("reference asset extraction ignores self-check sections with literal placeholders", async () => {
    const content = [
      "## 中文完整版本",
      "",
      "参考 @测试角色三视图。",
      "",
      "## 中文自检",
      "",
      "- [ ] 已携带 Step 3 声明的全部 `@xx三视图` / `@xx场景图`。"
    ].join("\n");
    const assets = extractReferenceAssets(content);
    expect(assets.map((asset) => asset.token)).toEqual(["@测试角色三视图"]);
  });

  test("Step 2 templates use flat ## entity sections matching the checker contract", async () => {
    const characters = await fs.readFile(path.join(packTemplatesRoot, "02_世界设定", "角色设定.md"), "utf8");
    const scenes = await fs.readFile(path.join(packTemplatesRoot, "02_世界设定", "场景设定.md"), "utf8");

    expect(characters).not.toMatch(/^##\s*角色细节\s*$/mu);
    expect(scenes).not.toMatch(/^##\s*场景细节\s*$/mu);
    expect(characters).toMatch(/^##\s*角色一\s*$/mu);
    expect(scenes).toMatch(/^##\s*场景一\s*$/mu);
    expect(characters).toContain("@角色一三视图");
    expect(scenes).toContain("@场景一场景图");
  });

  test("Step 3 storyboard card template declares segments as ### 分镜 N headings", async () => {
    const storyboard = await fs.readFile(path.join(packTemplatesRoot, "03_分镜脚本", "分镜卡.md"), "utf8");
    expect(storyboard).toMatch(/^###\s*分镜 1\s*$/mu);
    expect(storyboard).not.toMatch(/^-\s*分镜 \d+[：:]/mu);
  });

  test("unfilled Step 2 templates produce no missing-asset false positives", async () => {
    const characters = await fs.readFile(path.join(packTemplatesRoot, "02_世界设定", "角色设定.md"), "utf8");
    const scenes = await fs.readFile(path.join(packTemplatesRoot, "02_世界设定", "场景设定.md"), "utf8");
    expect(findMissingCharacterTriViews(characters)).toEqual([]);
    expect(findMissingSceneReferenceImages(scenes)).toEqual([]);
  });

  test("content tree templates exist at the spec paths", async () => {
    const expected = [
      path.join("内容", "00_镜头总表.md"),
      path.join("内容", "01_分镜总表.md"),
      path.join("内容", "场-XXX", "00_场总览.md"),
      path.join("内容", "场-XXX", "镜头组-XXX", "00_镜头组总览.md"),
      path.join("内容", "场-XXX", "镜头组-XXX", "镜头-NNN", "00_镜头-NNN.md"),
      path.join("内容", "场-XXX", "镜头组-XXX", "镜头-NNN", "分镜-NN.md"),
      path.join("内容", "场-XXX", "镜头组-XXX", "镜头-NNN", "分镜-NN-无关键帧示例.md")
    ];
    for (const relPath of expected) {
      expect(await fs.pathExists(path.join(packTemplatesRoot, relPath))).toBe(true);
    }
  });

  test("content tree templates stay placeholder-only and use relative paths", async () => {
    const expected = [
      path.join("内容", "00_镜头总表.md"),
      path.join("内容", "01_分镜总表.md"),
      path.join("内容", "场-XXX", "00_场总览.md"),
      path.join("内容", "场-XXX", "镜头组-XXX", "00_镜头组总览.md"),
      path.join("内容", "场-XXX", "镜头组-XXX", "镜头-NNN", "00_镜头-NNN.md"),
      path.join("内容", "场-XXX", "镜头组-XXX", "镜头-NNN", "分镜-NN.md"),
      path.join("内容", "场-XXX", "镜头组-XXX", "镜头-NNN", "分镜-NN-无关键帧示例.md")
    ];
    for (const relPath of expected) {
      const template = await fs.readFile(path.join(packTemplatesRoot, relPath), "utf8");
      // 每份都要有文件用途说明与占位符骨架，避免被填成某个具体项目的内容。
      expect(template).toContain("## 文件用途");
      expect(template).toMatch(/<[^>\n]+>/u);
      // 只允许相对路径：不得出现盘符、file:// 或 vscode://。
      expect(template).not.toMatch(/[A-Za-z]:[\\/]|file:\/\/|vscode:\/\//u);
    }
  });

  test("content tree overview templates declare their auto blocks", async () => {
    const shotOverview = await fs.readFile(path.join(packTemplatesRoot, "内容", "00_镜头总表.md"), "utf8");
    const storyboardOverview = await fs.readFile(path.join(packTemplatesRoot, "内容", "01_分镜总表.md"), "utf8");
    const sceneOverview = await fs.readFile(path.join(packTemplatesRoot, "内容", "场-XXX", "00_场总览.md"), "utf8");
    const groupOverview = await fs.readFile(
      path.join(packTemplatesRoot, "内容", "场-XXX", "镜头组-XXX", "00_镜头组总览.md"),
      "utf8"
    );

    expect(shotOverview).toContain("<!-- avw:auto:start name=镜头总表 -->");
    expect(shotOverview).toContain("<!-- avw:auto:end name=镜头总表 -->");
    expect(storyboardOverview).toContain("<!-- avw:auto:start name=分镜总表 -->");
    expect(storyboardOverview).toContain("<!-- avw:auto:end name=分镜总表 -->");
    expect(sceneOverview).toContain("<!-- avw:auto:start name=场镜头组表 -->");
    expect(sceneOverview).toContain("<!-- avw:auto:end name=场镜头组表 -->");
    expect(groupOverview).toContain("<!-- avw:auto:start name=组镜头表 -->");
    expect(groupOverview).toContain("<!-- avw:auto:end name=组镜头表 -->");
  });

  test("shot summary template declares the five content tree blocks", async () => {
    const shotSummary = await fs.readFile(
      path.join(packTemplatesRoot, "内容", "场-XXX", "镜头组-XXX", "镜头-NNN", "00_镜头-NNN.md"),
      "utf8"
    );
    for (const name of ["分镜速览", "图片提示词", "镜头段拼装"]) {
      expect(shotSummary).toContain(`<!-- avw:auto:start name=${name} -->`);
      expect(shotSummary).toContain(`<!-- avw:auto:end name=${name} -->`);
    }
    for (const name of ["视频提示词前段", "视频提示词后段"]) {
      expect(shotSummary).toContain(`<!-- avw:manual:start name=${name} -->`);
      expect(shotSummary).toContain(`<!-- avw:manual:end name=${name} -->`);
    }
  });

  test("storyboard template keeps the three required parts and a prompt code fence", async () => {
    const storyboardDir = path.join(packTemplatesRoot, "内容", "场-XXX", "镜头组-XXX", "镜头-NNN");
    for (const fileName of ["分镜-NN.md", "分镜-NN-无关键帧示例.md"]) {
      const storyboard = await fs.readFile(path.join(storyboardDir, fileName), "utf8");
      // 解析器按小节标题识别三部分：含「本段正文」的小节、含「关键帧」的小节、含「视频提示词」的小节。
      expect(storyboard).toMatch(/^#{2,3}\s+[^\n]*本段正文[^\n]*$/mu);
      expect(storyboard).toMatch(/^#{2,3}\s+[^\n]*关键帧[^\n]*$/mu);
      expect(storyboard).toMatch(/^#{2,3}\s+[^\n]*视频提示词[^\n]*$/mu);
      // 视频提示词片段必须写在代码块里，否则整镜拼装拿不到正文。
      expect(storyboard).toContain("```text");
      expect(storyboard).toContain("整段视频提交请用");
      expect(storyboard).toContain("镜头汇总");
    }
  });

  test("storyboard template keeps keyframe headings at level four", async () => {
    const storyboard = await fs.readFile(
      path.join(packTemplatesRoot, "内容", "场-XXX", "镜头组-XXX", "镜头-NNN", "分镜-NN.md"),
      "utf8"
    );
    // 解析器只在 ##/### 处切小节：关键帧标题若写成 ### 级，会被当成新小节，导致本段关键帧解析为空。
    expect(storyboard).toMatch(/^####\s*关键帧 01\s*$/mu);
    expect(storyboard).not.toMatch(/^###\s*关键帧 \d+\s*$/mu);
    expect(storyboard).toContain("对应分镜：");
    expect(storyboard).toContain("关键时刻：");
  });

  test("content tree templates parse cleanly with the content tree reader", async () => {
    const storyboardDir = path.join(packTemplatesRoot, "内容", "场-XXX", "镜头组-XXX", "镜头-NNN");
    const shotDirRel = "内容/场-001/镜头组-001/镜头-001";

    const withKeyframes = await fs.readFile(path.join(storyboardDir, "分镜-NN.md"), "utf8");
    const withKeyframeDoc = parseStoryboardDocument(path.posix.join(shotDirRel, "分镜-01.md"), withKeyframes);
    expect(withKeyframeDoc.issues).toEqual([]);
    expect(withKeyframeDoc.keyframes).toHaveLength(1);
    expect(withKeyframeDoc.videoPromptSegment).toBeTruthy();

    const withoutKeyframes = await fs.readFile(path.join(storyboardDir, "分镜-NN-无关键帧示例.md"), "utf8");
    const withoutKeyframeDoc = parseStoryboardDocument(path.posix.join(shotDirRel, "分镜-02.md"), withoutKeyframes);
    expect(withoutKeyframeDoc.issues).toEqual([]);
    expect(withoutKeyframeDoc.keyframes).toHaveLength(0);
    expect(withoutKeyframeDoc.videoPromptSegment).toBeTruthy();

    const shotSummary = await fs.readFile(path.join(storyboardDir, "00_镜头-NNN.md"), "utf8");
    const shotDoc = parseShotDocument(path.posix.join(shotDirRel, "00_镜头-001.md"), shotSummary);
    expect(shotDoc.issues).toEqual([]);
    for (const body of [shotDoc.segmentDigest, shotDoc.imagePrompt, shotDoc.segmentsBody, shotDoc.promptBefore, shotDoc.promptAfter]) {
      expect(body).toBeTruthy();
    }
  });

  test("a freshly initialized project with seeded templates passes full verification", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-template-compliance-"));
    tempRoots.push(root);
    await createProject({
      targetRoot: root,
      projectName: "compliance-project",
      pack: "official-ai-video",
      ide: "codex",
      imagePlatform: "openai",
      videoPlatform: "seedance",
      startFrom: "research"
    });
    const projectRoot = path.join(root, "compliance-project");

    expect(await fs.pathExists(path.join(projectRoot, "02_世界设定", "角色设定.md"))).toBe(true);
    expect(await fs.pathExists(path.join(projectRoot, "02_世界设定", "场景设定.md"))).toBe(true);
    expect(await fs.pathExists(path.join(projectRoot, "04_图片提示词", "镜头组-001", "图片提示词.md"))).toBe(true);
    expect(await fs.pathExists(path.join(projectRoot, "05_视频提示词", "镜头组-001", "视频提示词.md"))).toBe(true);

    const result = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video" });
    expect(result).toEqual({ ok: true, issues: [] });
  });

  test("a freshly initialized gpt-image-2 project passes full verification", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-template-compliance-gpt-"));
    tempRoots.push(root);
    await createProject({
      targetRoot: root,
      projectName: "compliance-gpt-project",
      pack: "official-ai-video",
      ide: "codex",
      imagePlatform: "gpt-image-2",
      videoPlatform: "seedance",
      startFrom: "script"
    });
    const projectRoot = path.join(root, "compliance-gpt-project");

    const result = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video" });
    expect(result).toEqual({ ok: true, issues: [] });
  });

  test("a freshly initialized midjourney project passes full verification", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-template-compliance-mj-"));
    tempRoots.push(root);
    await createProject({
      targetRoot: root,
      projectName: "compliance-mj-project",
      pack: "official-ai-video",
      ide: "codex",
      imagePlatform: "midjourney",
      videoPlatform: "seedance",
      startFrom: "script"
    });
    const projectRoot = path.join(root, "compliance-mj-project");

    const result = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video" });
    expect(result).toEqual({ ok: true, issues: [] });
  });
});
