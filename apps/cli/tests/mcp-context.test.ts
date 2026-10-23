import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { createProject } from "../src/lib/init.js";
import { buildMcpContext } from "../src/lib/mcp/context.js";
import { writeState } from "../src/lib/libtv/project-binding.js";
import { syncProject } from "../src/lib/sync.js";

const tempRoots: string[] = [];
const repoRoot = path.resolve(__dirname, "..", "..", "..");

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

async function createChineseMcpProject({ research = false }: { research?: boolean } = {}): Promise<string> {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-mcp-cn-"));
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
      "    default: seedance",
      "workflow:",
      ...(research ? ["  research_step:", "    enabled: true"] : []),
      "  enhanced_flow:",
      "    enabled: true"
    ].join("\n"),
    "utf8"
  );

  for (const dir of [
    ...(research ? ["00_前期研究"] : []),
    "01_概念策划",
    "02_世界设定",
    "03_分镜脚本",
    "04_图片提示词",
    "05_视频提示词",
    "06_执行计划"
  ]) {
    await fs.ensureDir(path.join(projectRoot, dir));
  }
  for (const step of ["03_分镜脚本", "04_图片提示词", "05_视频提示词"]) {
    await fs.ensureDir(path.join(projectRoot, step, "镜头组-001"));
  }
  await fs.writeFile(path.join(projectRoot, "03_分镜脚本", "镜头组-001", "00_镜头组说明.md"), "# 镜头组 001\n", "utf8");

  for (const shotNumber of ["001", "002", "003"]) {
    await fs.writeFile(
      path.join(projectRoot, "03_分镜脚本", "镜头组-001", `镜头-${shotNumber}.md`),
      [
        `# 镜头 ${shotNumber}`,
        "",
        `- 图片提示词：[镜头-${shotNumber}-关键帧](../../04_图片提示词/镜头组-001/镜头-${shotNumber}-关键帧-01.md)`,
        `- 视频提示词：[镜头-${shotNumber}](../../05_视频提示词/镜头组-001/镜头-${shotNumber}.md)`
      ].join("\n"),
      "utf8"
    );
    await fs.writeFile(path.join(projectRoot, "04_图片提示词", "镜头组-001", `镜头-${shotNumber}-关键帧-01.md`), `# 镜头 ${shotNumber} 关键帧\n`, "utf8");
    await fs.writeFile(path.join(projectRoot, "05_视频提示词", "镜头组-001", `镜头-${shotNumber}.md`), `# 镜头 ${shotNumber} 视频\n`, "utf8");
  }

  return projectRoot;
}

/** 内容树项目夹具：声明 content.format_version=1，正文放在 内容/ 下。 */
async function createContentTreeMcpProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-mcp-content-"));
  tempRoots.push(root);
  await createProject({
    targetRoot: root,
    projectName: "content-mcp",
    pack: "official-ai-video",
    ide: "codex",
    imagePlatform: "openai",
    videoPlatform: "seedance"
  });
  const projectRoot = path.join(root, "content-mcp");
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
    "# 镜头组-001 镜头组总览\n\n## 这一组讲什么\n\n开场。\n",
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

describe("MCP read-only context", () => {
  test("builds a deterministic project summary without absolute paths", async () => {
    const projectRoot = await createChineseMcpProject();
    const context = await buildMcpContext({
      projectRoot,
      pack: "official-ai-video"
    });

    expect(context.project.pack).toBe("official-ai-video");
    expect(context.project.projectRoot).toBe(".");
    expect(context.steps.map((step) => step.step)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(context.steps.map((step) => step.directory)).toEqual([
      "01_概念策划",
      "02_世界设定",
      "03_分镜脚本",
      "04_图片提示词",
      "05_视频提示词",
      "06_执行计划",
      "07_发布物料"
    ]);
    expect(context.verificationCommands).toEqual(
      expect.arrayContaining([
        "ai-video-workflow verify --project <path> --ide codex",
        "ai-video-workflow export-obsidian --project <path> --in-project-view",
        "ai-video-workflow verify-obsidian --project <path> --in-project-view",
        "ai-video-workflow mcp-context --project <path>"
      ])
    );
    expect(context.viewLayers.obsidian).toEqual({
      defaultVaultPath: "_views/obsidian",
      sourceOfTruth: false,
      refreshCommand: "ai-video-workflow export-obsidian --project <path> --in-project-view"
    });
    expect(context.editBoundaries.generated).toContain("_views/obsidian");
    expect(context.editBoundaries.story).toContain("步骤三分镜脚本");
    expect(JSON.stringify(context)).not.toMatch(/[A-Z]:\\|[A-Z]:\/|file:\/\/|vscode:\/\//);
  });

  test("内容树模式在步骤清单里补上内容目录并标出正文模式", async () => {
    const projectRoot = await createContentTreeMcpProject();
    const context = await buildMcpContext({ projectRoot, pack: "official-ai-video" });

    expect(context.contentMode).toBe("content-tree");
    expect(context.contentRoot).toBe("内容");
    // 内容树是步骤三的正文，归到 step 3；目录不在 WORKFLOW_STEPS 里，所以单独一项。
    const contentStep = context.steps.find((step) => step.directory === "内容");
    expect(contentStep).toBeDefined();
    expect(contentStep?.step).toBe(3);
    expect(context.steps.some((step) => step.directory === "03_分镜脚本")).toBe(true);
    // 新建项目默认带步骤零（研究模式），内容树那一项排在步骤三之后。
    expect(context.steps.map((step) => step.step)).toEqual([0, 1, 2, 3, 3, 4, 5, 6, 7]);
    expect(context.steps.filter((step) => step.step === 3).map((step) => step.directory)).toEqual(["03_分镜脚本", "内容"]);

    // 镜头的正文路径来自内容树，分镜身份也要能带出来。
    expect(context.shots.map((shot) => shot.id)).toContain("shot-001");
    const shot = context.shots.find((candidate) => candidate.id === "shot-001");
    expect(shot?.sourcePaths.storyboard).toBe("内容/场-001/镜头组-001/镜头-001/00_镜头-001.md");
    expect(shot?.storyboards?.map((storyboard) => storyboard.id)).toEqual(["storyboard-01"]);
    expect(JSON.stringify(context)).not.toMatch(/[A-Z]:\\|[A-Z]:\/|file:\/\/|vscode:\/\//);
  });


  test("内容树模式下分镜身份带出序号、路径与关键帧", async () => {
    const projectRoot = await createContentTreeMcpProject();
    const shotDirectory = path.join(projectRoot, "内容", "场-001", "镜头组-001", "镜头-001");
    await fs.writeFile(
      path.join(shotDirectory, "分镜-02.md"),
      [
        "# 分镜-02：转身离开",
        "",
        "## 一、本段正文（画面与动作）",
        "",
        "- **景别与视角**：全景。",
        "",
        "## 二、关键帧",
        "",
        "#### 关键帧 01",
        "",
        "- 对应分镜：分镜 2",
        "- 关键时刻：转身的一瞬",
        "",
        "\u0060\u0060\u0060text",
        "阿岚转身离开雾塔。",
        "\u0060\u0060\u0060",
        "",
        "## 三、视频提示词片段",
        "",
        "\u0060\u0060\u0060text",
        "镜头2：全景，阿岚转身离开雾塔。",
        "\u0060\u0060\u0060",
        ""
      ].join(String.fromCharCode(10)),
      "utf8"
    );

    const context = await buildMcpContext({ projectRoot, pack: "official-ai-video" });
    const shot = context.shots.find((candidate) => candidate.id === "shot-001");
    expect(shot?.storyboards?.map((storyboard) => storyboard.id)).toEqual(["storyboard-01", "storyboard-02"]);
    expect(shot?.storyboards?.map((storyboard) => storyboard.number)).toEqual([1, 2]);
    expect(shot?.storyboards?.map((storyboard) => storyboard.sourcePath)).toEqual([
      "内容/场-001/镜头组-001/镜头-001/分镜-01.md",
      "内容/场-001/镜头组-001/镜头-001/分镜-02.md"
    ]);
    // 展示名可以改，身份不变：标题取 H1 冒号后的文字。
    expect(shot?.storyboards?.[0]?.title).toBe("停步抬头");
    expect(shot?.storyboards?.[0]?.keyframes).toEqual([]);
    expect(shot?.storyboards?.[1]?.keyframes).toEqual(["keyframe-01"]);
    expect(JSON.stringify(context)).not.toMatch(/[A-Z]:\\|[A-Z]:\/|file:\/\/|vscode:\/\//);
  });

  test("旧格式项目的步骤清单与新增字段保持原样", async () => {
    const projectRoot = await createChineseMcpProject();
    const context = await buildMcpContext({ projectRoot, pack: "official-ai-video" });

    expect(context.contentMode).toBe("legacy");
    expect(context.contentRoot).toBeUndefined();
    expect(context.steps.map((step) => step.directory)).not.toContain("内容");
    expect(context.shots.every((shot) => shot.storyboards === undefined)).toBe(true);
  });

  test("includes Step 0 in research-mode project context", async () => {
    const projectRoot = await createChineseMcpProject({ research: true });
    const context = await buildMcpContext({
      projectRoot,
      pack: "official-ai-video"
    });

    expect(context.steps.map((step) => step.step)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(context.steps[0]).toEqual({ step: 0, label: "前期研究", directory: "00_前期研究" });
    expect(context.editBoundaries.research).toContain("步骤零前期研究");
  });

  test("maps each shot to Step 3, Step 4, Step 5, and Step 6 source files", async () => {
    const projectRoot = await createChineseMcpProject();
    const context = await buildMcpContext({
      projectRoot,
      pack: "official-ai-video"
    });

    expect(context.shots.map((shot) => shot.id)).toEqual(["shot-001", "shot-002", "shot-003"]);
    for (const shot of context.shots) {
      const number = shot.id.replace("shot-", "");
      expect(shot.groupId).toBe("group-001");
      expect(shot.sourcePaths.storyboard).toBe(`03_分镜脚本/镜头组-001/镜头-${number}.md`);
      expect(shot.sourcePaths.imagePrompt).toBe(`04_图片提示词/镜头组-001/镜头-${number}-关键帧-01.md`);
      expect(shot.sourcePaths.imagePrompts).toEqual([`04_图片提示词/镜头组-001/镜头-${number}-关键帧-01.md`]);
      expect(shot.sourcePaths.videoPrompt).toBe(`05_视频提示词/镜头组-001/镜头-${number}.md`);
      expect(shot.sourcePaths.executionPlan).toEqual([
        "06_执行计划/00_执行计划.md",
        "06_执行计划/01_图片执行计划.md",
        "06_执行计划/02_视频执行计划.md"
      ]);
      expect(JSON.stringify(shot.sourcePaths)).not.toContain("_views");
    }
  });

  test("requires project config before building context", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-mcp-missing-config-"));
    tempRoots.push(projectRoot);
    await fs.ensureDir(path.join(projectRoot, "03_分镜脚本"));

    await expect(
      buildMcpContext({
        projectRoot,
        pack: "official-ai-video"
      })
    ).rejects.toThrow("Missing project.config.yaml");
  });

  test("requires a directory project root before building context", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-mcp-file-root-"));
    tempRoots.push(root);
    const projectRoot = path.join(root, "project.md");
    await fs.writeFile(projectRoot, "# Not a project\n", "utf8");

    await expect(
      buildMcpContext({
        projectRoot,
        pack: "official-ai-video"
      })
    ).rejects.toThrow("must be a directory");
  });

  test("includes LibTV execution status when no state file exists", async () => {
    const projectRoot = await createChineseMcpProject();
    const context = await buildMcpContext({
      projectRoot,
      pack: "official-ai-video"
    });
    expect(context.libtv.available).toBe(false);
    expect(context.libtv.anchors).toEqual([]);
    expect(context.libtv.keyframes).toEqual([]);
  });

  test("requires all Step directories before building context", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-mcp-missing-step-"));
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

    await expect(
      buildMcpContext({
        projectRoot,
        pack: "official-ai-video"
      })
    ).rejects.toThrow("missing Step directory: 01_概念策划");
  });
  test("exposes LibTV progress and summary fields through MCP context", async () => {
    const projectRoot = await createChineseMcpProject();
    await writeState(projectRoot, {
      version: 1,
      projectUuid: "mock-project",
      anchors: [],
      keyframes: [{
        groupId: "group-001",
        shotId: "shot-001",
        keyframeId: "keyframe-01",
        sourcePath: "04_图片提示词/镜头组-001/镜头-001-关键帧-01.md",
        prompt: "test",
        referenceTokens: [],
        nodeId: "i-keyframe-1",
        status: "generating",
        taskId: "task-1",
        progressPercent: 42,
        generationError: undefined,
        attempts: 1
      }],
      videos: [{
        groupId: "group-001",
        shotId: "shot-001",
        sourcePath: "05_视频提示词/镜头组-001/镜头-001.md",
        prompt: "test",
        referenceTokens: [],
        keyframePaths: [],
        nodeId: "v-video-1",
        status: "generated",
        taskId: "task-2",
        progressPercent: 100,
        attempts: 1
      }],
      updatedAt: new Date().toISOString()
    });
    const context = await buildMcpContext({ projectRoot, pack: "official-ai-video" });
    expect(context.libtv.available).toBe(true);
    expect(context.libtv.keyframes[0]).toMatchObject({
      id: "group-001/shot-001/keyframe-01",
      status: "generating",
      taskId: "task-1",
      progressPercent: 42,
      attempts: 1
    });
    expect(context.libtv.videos[0]).toMatchObject({
      id: "group-001/shot-001",
      status: "generated",
      taskId: "task-2",
      progressPercent: 100
    });
    expect(context.libtv.summary?.keyframes.generating).toBe(1);
    expect(context.libtv.summary?.videos.generated).toBe(1);
  });


});
