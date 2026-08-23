import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

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
