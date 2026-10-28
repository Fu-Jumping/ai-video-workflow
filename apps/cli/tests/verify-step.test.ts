import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { createProject } from "../src/lib/init.js";
import { syncProject } from "../src/lib/sync.js";
import { verifyProject } from "../src/lib/verify.js";

/**
 * Step-scoped verification (--step) and the machine-checked content gates added after the
 * two end-to-end test rounds: duplicated 避免 prefix, quick-guide meta language, and
 * generic-only Step 5 negative constraints.
 */

const tempRoots: string[] = [];
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const shotGroupDir = "镜头组-001";

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

/**
 * 本文件的用例检验的是旧的 03／04／05 目录合同，所以项目必须是「旧格式项目」：
 * 建好之后删掉 project.config.yaml 里的 content 键（缺这个键＝按旧格式读取）。
 * 新格式（内容树）的等价覆盖在 content-tree.test.ts。
 */
async function dropContentFormatVersion(projectRoot: string): Promise<void> {
  const { parseYaml, stringifyYaml } = await import("../src/lib/yaml.js");
  const configPath = path.join(projectRoot, "project.config.yaml");
  const parsed = parseYaml<Record<string, unknown>>(await fs.readFile(configPath, "utf8"));
  delete parsed.content;
  await fs.writeFile(configPath, stringifyYaml(parsed), "utf8");
}

/**
 * 旧格式项目在 Step 3 组目录必须有 `00_镜头组说明.md`（quality-gates §Step 3）。
 * init 现在按内容树口径播种（03 只留索引，不再带这份组说明），所以旧格式夹具改回
 * 旧口径时自己补回来：内容取自 pack 模板，与改动前 init 播种的完全一致。
 */
async function seedLegacyShotGroupDescription(projectRoot: string): Promise<void> {
  await fs.outputFile(
    path.join(projectRoot, "03_分镜脚本", shotGroupDir, "00_镜头组说明.md"),
    await fs.readFile(path.join(repoRoot, "packs", "official-ai-video", "templates", "03_分镜脚本", "镜头组说明.md"), "utf8"),
    "utf8"
  );
}

async function createSyncedProject(root: string): Promise<string> {
  await createProject({
    targetRoot: root,
    projectName: "verify-step-project",
    pack: "official-ai-video",
    ide: "codex",
    imagePlatform: "openai",
    videoPlatform: "seedance",
    startFrom: "research"
  });
  const projectRoot = path.join(root, "verify-step-project");
  await syncProject({ repoRoot, projectRoot, pack: "official-ai-video", ide: "codex" });
  await dropContentFormatVersion(projectRoot);
  await seedLegacyShotGroupDescription(projectRoot);
  return projectRoot;
}

async function seedStoryboard(projectRoot: string): Promise<void> {
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
      "主体在场景中停步抬头。",
      "",
      "## 关键帧选择",
      "",
      "- 关键帧 01：对应分镜 1 的时刻。",
      "",
      "## 参考资产要求",
      "",
      "- 必带参考资产：@测试角色三视图、@测试场景图",
      "",
      "## 下游文件",
      "",
      "- 对应图片提示词：[镜头 001 关键帧 01](../../04_图片提示词/镜头组-001/镜头-001-关键帧-01.md)"
    ].join("\n"),
    "utf8"
  );
}

async function seedKeyframe(projectRoot: string, keyframeBody: string): Promise<void> {
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
      "- 必带参考资产：@测试角色三视图、@测试场景图",
      "",
      "## 快速导读",
      "",
      "- 画面内容：主体站在雾塔门前。",
      "",
      "## 中文完整版本",
      "",
      "参考 @测试角色三视图、@测试场景图。主体站在雾塔门前。",
      "",
      "## 可复制提示词",
      "",
      "```text",
      "参考 @测试角色三视图、@测试场景图。主体站在雾塔门前。",
      "避免：现代城市。",
      "```",
      keyframeBody
    ].join("\n"),
    "utf8"
  );
}

async function seedVideoPrompt(projectRoot: string, negativeLines: string[]): Promise<void> {
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
      "- 默认视频平台：seedance",
      "- 执行模型：Seedance 2.0",
      "- 参考模式：全能参考模式",
      "- 输入方式：参考素材 + 文本提示词",
      "- 目标时长：15 秒",
      "- 画幅：21:9",
      "- 参考素材：@测试角色三视图、@测试场景图",
      "- 素材上传顺序：先语义参考素材，再关键帧",
      "- 负面约束：见文末负面约束",
      "",
      "## 参考素材映射",
      "",
      "- 主体与场景：@测试角色三视图、@测试场景图",
      "- 关键帧：镜头-001-关键帧-01.md",
      "",
      "## 可复制提示词",
      "",
      "```text",
      "把 @测试角色三视图、@测试场景图 中的主体与空间绑定为视频参考。",
      "",
      "生成主体在雾塔门前停顿后抬头的视频。",
      "",
      "镜头1：中景正面视角，镜头缓慢推进，主体停顿后抬头，雾气轻微流动，伴随风声和衣料摩擦声。",
      "",
      "写实电影画风，冷调自然光，保留环境声和动作声，无配乐、无字幕。",
      "```",
      "",
      "## 负面约束",
      "",
      ...negativeLines.map((line) => `- ${line}`)
    ].join("\n"),
    "utf8"
  );
}

describe("step-scoped verification", () => {
  test("full verify reports expected Step 3 interim errors when Step 4 files do not exist yet", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-step-full-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root);
    await seedStoryboard(projectRoot);

    const result = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video" });
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid-keyframe-mapping" }),
        expect.objectContaining({ code: "broken-step3-step4-link" })
      ])
    );
  });

  test("verify --step 3 passes once storyboards are complete", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-step-3-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root);
    await seedStoryboard(projectRoot);

    const result = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video", step: 3 });
    expect(result).toEqual({ ok: true, issues: [] });
  });
});

describe("Step 4 content gates", () => {
  test("rejects a duplicated 避免 prefix", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-avoid-dup-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root);
    await seedStoryboard(projectRoot);
    await seedKeyframe(projectRoot, "\n- 避免：避免：现代城市。\n");

    const result = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video", step: 4 });
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "step4-avoid-double-prefix" })])
    );
  });

  test("rejects director meta-language inside 快速导读", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-quick-guide-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root);
    await seedStoryboard(projectRoot);
    await seedKeyframe(projectRoot, "");

    const keyframePath = path.join(projectRoot, "04_图片提示词", shotGroupDir, "镜头-001-关键帧-01.md");
    const content = await fs.readFile(keyframePath, "utf8");
    await fs.writeFile(keyframePath, content.replace("- 画面内容：主体站在雾塔门前。", "- 画面内容：导演意图：表现坚定。"), "utf8");

    const result = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video", step: 4 });
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "step4-quick-guide-meta-language" })])
    );
  });
});

describe("Step 5 content gates", () => {
  test("rejects negative constraints that only repeat template defaults", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-generic-negative-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root);
    await seedStoryboard(projectRoot);
    await seedKeyframe(projectRoot, "");
    await seedVideoPrompt(projectRoot, [
      "不得超过 15 秒。",
      "不得超过 4 个连续编号的镜头段。",
      "不得加入配乐或字幕；无字幕不禁止场景内真实招牌、木牌等叙事文字。"
    ]);

    const result = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video", step: 5 });
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "step5-generic-negative-only" })])
    );
  });

  test("rejects generic-only negatives even with punctuation variants", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-generic-negative-variant-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root);
    await seedStoryboard(projectRoot);
    await seedKeyframe(projectRoot, "");
    await seedVideoPrompt(projectRoot, [
      "不得超过15秒",
      "不得把 {{Mixed n}} 槽位号写成事实源引用。",
      "不得使用\"同上\"\"保持一致\"替代具体可见事实。"
    ]);

    const result = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video", step: 5 });
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "step5-generic-negative-only" })])
    );
  });

  test("accepts shot-specific negative constraints", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-custom-negative-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root);
    await seedStoryboard(projectRoot);
    await seedKeyframe(projectRoot, "");
    await seedVideoPrompt(projectRoot, [
      "不得超过 15 秒。",
      "不得新增第二个人物或现代设施。",
      "不得加入配乐或字幕。"
    ]);

    const result = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video", step: 5 });
    expect(result.issues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "step5-generic-negative-only" })])
    );
  });
});

describe("Step 1 decision gates", () => {
  /**
   * Issue #3：动笔前决策访谈的软警告。三种状态各有对应 code，但都不阻塞 verify 通过；
   * 全新项目（模板内核 + 模板决策记录）必须零警告，保持既有验收语义。
   */
  async function fillStoryKernel(projectRoot: string): Promise<void> {
    await fs.writeFile(
      path.join(projectRoot, "01_概念策划", "故事内核.md"),
      [
        "# 测试故事内核",
        "",
        "- 项目名称：决策访谈测试项目",
        "- 项目类型：奇幻生活短片",
        "- 目标时长：约 90 秒"
      ].join("\n"),
      "utf8"
    );
  }

  test("fresh project emits no Step 1 warnings", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-step1-clean-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root);

    const result = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video", step: 1 });
    expect(result.ok).toBe(true);
    expect(result.warnings).toBeUndefined();
  });

  test("warns when the story kernel still carries [assumption] markers", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-step1-assumption-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root);
    await fs.appendFile(
      path.join(projectRoot, "01_概念策划", "故事内核.md"),
      "- 核心主题：[assumption] 待用户确认\n",
      "utf8"
    );

    const result = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video", step: 1 });
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "step1-assumption-markers" })])
    );
  });

  test("warns when the story kernel is filled but the decision log is missing", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-step1-no-log-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root);
    await fillStoryKernel(projectRoot);
    await fs.remove(path.join(projectRoot, "01_概念策划", "00_决策记录.md"));

    const result = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video", step: 1 });
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "step1-decision-log-missing" })])
    );
  });

  test("warns while the decision log still has pending rows", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-step1-pending-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root);
    await fillStoryKernel(projectRoot);

    const result = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video", step: 1 });
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "step1-decision-log-unconfirmed" })])
    );
  });

  test("warns when the interview record stays a template placeholder", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-step1-interview-empty-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root);
    await fillStoryKernel(projectRoot);
    const logPath = path.join(projectRoot, "01_概念策划", "00_决策记录.md");
    const log = await fs.readFile(logPath, "utf8");
    await fs.writeFile(logPath, log.split("| pending |").join("| confirmed |"), "utf8");

    const result = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video", step: 1 });
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "step1-interview-log-empty" })])
    );
  });

  test("emits no warnings once the decision log is fully confirmed", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-step1-confirmed-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root);
    await fillStoryKernel(projectRoot);
    const logPath = path.join(projectRoot, "01_概念策划", "00_决策记录.md");
    const log = await fs.readFile(logPath, "utf8");
    await fs.writeFile(
      logPath,
      log
        .split("| pending |")
        .join("| confirmed |")
        .replace(
          "- 第 1 组（日期，覆盖编号）：",
          "- 第 1 组（2026-10-26，覆盖 D1—D9）：用户逐条确认推荐项。"
        ),
      "utf8"
    );

    const result = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video", step: 1 });
    expect(result.ok).toBe(true);
    expect(result.warnings).toBeUndefined();
  });
});
