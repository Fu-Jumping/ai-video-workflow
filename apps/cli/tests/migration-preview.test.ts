import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { createProject } from "../src/lib/init.js";
import { assembleContentTree } from "../src/lib/content-assemble.js";
import {
  applyMigration,
  buildMigrationPreview,
  renderMigrationPreview
} from "../src/lib/migration-preview.js";
import { syncProject } from "../src/lib/sync.js";
import { verifyProject } from "../src/lib/verify.js";
import { parseYaml, stringifyYaml } from "../src/lib/yaml.js";

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const tempRoots: string[] = [];
const FENCE = "```";
const NL = String.fromCharCode(10);

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await fs.remove(root);
  }
});

async function writeFile(projectRoot: string, relPath: string, content: string): Promise<void> {
  const absolute = path.join(projectRoot, relPath);
  await fs.ensureDir(path.dirname(absolute));
  await fs.writeFile(absolute, content, "utf8");
}

/** 建一个「旧格式项目」：createProject 之后删掉 content 键。 */
async function createLegacyProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "avw-migration-preview-"));
  tempRoots.push(root);
  await createProject({
    targetRoot: root,
    projectName: "legacy-project",
    pack: "official-ai-video",
    ide: "codex",
    imagePlatform: "openai",
    videoPlatform: "seedance"
  });
  const projectRoot = path.join(root, "legacy-project");
  await syncProject({ repoRoot, projectRoot, ide: "codex", pack: "official-ai-video" });

  const configPath = path.join(projectRoot, "project.config.yaml");
  const config = parseYaml(await fs.readFile(configPath, "utf8")) as Record<string, unknown>;
  delete config.content;
  await fs.writeFile(configPath, stringifyYaml(config), "utf8");
  return projectRoot;
}

const LEGACY_STORYBOARD = "03_分镜脚本/镜头组-001/镜头-001.md";
const LEGACY_KEYFRAME_MERGE = "04_图片提示词/镜头组-001/镜头-001-关键帧-01.md";
const LEGACY_KEYFRAME_CONFLICT = "04_图片提示词/镜头组-001/镜头-001-关键帧-02.md";
const LEGACY_VIDEO = "05_视频提示词/镜头组-001/镜头-001.md";

async function seedLegacyProject(projectRoot: string): Promise<void> {
  await writeFile(
    projectRoot,
    LEGACY_STORYBOARD,
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
      "### 分镜 2",
      "",
      "阿岚抬脚迈过门槛，雾气从身后合上。",
      ""
    ].join(NL)
  );

  await writeFile(
    projectRoot,
    LEGACY_KEYFRAME_MERGE,
    [
      "# 镜头 001 关键帧 01 图片提示词",
      "",
      "## 维护元信息",
      "",
      "- 镜头组：group-001",
      "- 镜头编号：shot-001",
      "- 对应分镜：分镜 1",
      "- 关键时刻：抬头前",
      "",
      "## 可复制提示词",
      "",
      FENCE + "text",
      "阿岚站在雾塔门前，冷调自然光。",
      FENCE,
      ""
    ].join(NL)
  );

  // 这一份故意不写「对应分镜」：预览必须标成 conflict。
  await writeFile(
    projectRoot,
    LEGACY_KEYFRAME_CONFLICT,
    [
      "# 镜头 001 关键帧 02 图片提示词",
      "",
      "## 可复制提示词",
      "",
      FENCE + "text",
      "雾塔门前的门缝特写，冷调自然光。",
      FENCE,
      ""
    ].join(NL)
  );

  await writeFile(
    projectRoot,
    LEGACY_VIDEO,
    [
      "# 镜头 001 视频提示词",
      "",
      "## 可复制提示词",
      "",
      FENCE + "text",
      "镜头1：中景正面视角，阿岚停顿后抬头，风声。",
      "",
      "镜头2：阿岚迈过门槛，雾气合上，风声。",
      FENCE,
      ""
    ].join(NL)
  );
}

describe("迁移预览：逐文件可读", () => {
  test("旧项目给出 create／merge／conflict 三种去向", async () => {
    const projectRoot = await createLegacyProject();
    await seedLegacyProject(projectRoot);

    const preview = await buildMigrationPreview(projectRoot);
    expect(preview.canApply).toBe(true);

    const actions = new Set(preview.entries.map((entry) => entry.action));
    expect(actions.has("create")).toBe(true);
    expect(actions.has("merge")).toBe(true);
    expect(actions.has("conflict")).toBe(true);

    // 每个旧文件都在预览里出现，且都登记了只读快照去向。
    const sources = new Set(preview.entries.map((entry) => entry.sourceRelPath));
    expect(sources.has(LEGACY_STORYBOARD)).toBe(true);
    expect(sources.has(LEGACY_KEYFRAME_MERGE)).toBe(true);
    expect(sources.has(LEGACY_KEYFRAME_CONFLICT)).toBe(true);
    expect(sources.has(LEGACY_VIDEO)).toBe(true);
    for (const entry of preview.entries) {
      expect(entry.snapshotRelPath.startsWith("已迁移/")).toBe(true);
      expect(entry.targetRelPath.startsWith("内容/")).toBe(true);
    }

    // conflict 必须有说明，且预览里带一条需要人工处理的提示。
    const conflict = preview.entries.find((entry) => entry.action === "conflict");
    expect(conflict).toBeDefined();
    expect(conflict!.reason).toBeTruthy();
    expect(preview.issues.map((issue) => issue.code)).toContain("content-identity-invalid");
  });

  test("渲染出来的预览能逐行读懂", async () => {
    const projectRoot = await createLegacyProject();
    await seedLegacyProject(projectRoot);

    const preview = await buildMigrationPreview(projectRoot);
    const text = renderMigrationPreview(preview);
    const lines = text.split(NL);

    expect(lines[0]).toBe("迁移预览（未写入任何文件）");
    expect(text).toContain("共 ");
    expect(text).toContain("[create] " + LEGACY_STORYBOARD);
    expect(text).toContain("[merge] " + LEGACY_KEYFRAME_MERGE);
    expect(text).toContain("[conflict] " + LEGACY_KEYFRAME_CONFLICT);
    expect(text).toContain(" -> 内容/");
    expect(text).toContain("旧文件另存为只读快照：已迁移/");
    expect(text).toContain("需要注意：");

    // 每一条都占独立行：行数不少于条目数。
    expect(lines.length).toBeGreaterThanOrEqual(preview.entries.length);
  });

  test("没有任何旧镜头文件的项目没有可迁移内容", async () => {
    const projectRoot = await createLegacyProject();
    // 模板会往 03/04/05 放「分镜卡」「镜头组说明」这类空白模板文件；
    // 这里整体删掉三个旧目录，模拟「一个旧镜头文件都没有」的项目。
    for (const stepDir of ["03_分镜脚本", "04_图片提示词", "05_视频提示词"]) {
      await fs.remove(path.join(projectRoot, stepDir));
    }

    const preview = await buildMigrationPreview(projectRoot);
    expect(preview.canApply).toBe(false);
    expect(preview.entries).toEqual([]);
    expect(preview.issues.map((issue) => issue.code)).toContain("content-tree-missing");
  });

  test("已经声明内容树的项目不再给迁移预览", async () => {
    const projectRoot = await createLegacyProject();
    await seedLegacyProject(projectRoot);
    const configPath = path.join(projectRoot, "project.config.yaml");
    const config = parseYaml(await fs.readFile(configPath, "utf8")) as Record<string, unknown>;
    config.content = { format_version: 1 };
    await fs.writeFile(configPath, stringifyYaml(config), "utf8");

    const preview = await buildMigrationPreview(projectRoot);
    expect(preview.canApply).toBe(false);
    expect(preview.entries).toEqual([]);
    expect(preview.issues.map((issue) => issue.code)).toContain("content-legacy-and-tree-coexist");
  });
});

describe("迁移执行：保留原件、快照标注、不覆盖冲突目标", () => {
  test("apply 之后原件仍在，快照首行标注正确", async () => {
    const projectRoot = await createLegacyProject();
    await seedLegacyProject(projectRoot);

    const originalStoryboard = await fs.readFile(path.join(projectRoot, LEGACY_STORYBOARD), "utf8");
    const originalVideo = await fs.readFile(path.join(projectRoot, LEGACY_VIDEO), "utf8");

    const preview = await buildMigrationPreview(projectRoot);
    const result = await applyMigration(projectRoot, preview);
    expect(result.written.length).toBeGreaterThan(0);

    // 原件一个都不能少，内容也不许被改写。
    expect(await fs.pathExists(path.join(projectRoot, LEGACY_STORYBOARD))).toBe(true);
    expect(await fs.pathExists(path.join(projectRoot, LEGACY_KEYFRAME_MERGE))).toBe(true);
    expect(await fs.pathExists(path.join(projectRoot, LEGACY_KEYFRAME_CONFLICT))).toBe(true);
    expect(await fs.pathExists(path.join(projectRoot, LEGACY_VIDEO))).toBe(true);
    // 03 的旧镜头文件留在原位，但首行加一行标注：读的人一眼知道它不是当前正文。
    const keptStoryboard = await fs.readFile(path.join(projectRoot, LEGACY_STORYBOARD), "utf8");
    const keptFirstLine = keptStoryboard.split(NL)[0]!;
    expect(keptFirstLine.startsWith("> 已迁移：")).toBe(true);
    expect(keptFirstLine).toContain("非当前正文");
    expect(keptFirstLine).toContain("正文以「内容/」为准");
    expect(keptFirstLine).toMatch(/\d{4}-\d{2}-\d{2}/u);
    // 除了这一行标注和它后面的空行，原件正文一个字都不改。
    expect(keptStoryboard.slice(keptFirstLine.length + 2)).toBe(originalStoryboard);

    // 04／05 的旧路径正是执行文件的固定路径，迁移后会放按内容树重新生成的执行文件；
    // 旧 05 原文不丢，完整保存在「已迁移」快照里（下面校验）。
    const regeneratedVideo = await fs.readFile(path.join(projectRoot, LEGACY_VIDEO), "utf8");
    expect(regeneratedVideo).not.toBe(originalVideo);
    expect(regeneratedVideo).toContain("## 可复制提示词");
    // 04／05 的原件位置放的是重新生成的执行文件，不打「已迁移」标注。
    expect(regeneratedVideo.startsWith("> 已迁移：")).toBe(false);

    // 只读快照存在，首行是迁移标注。
    const snapshotRelPath = "已迁移/" + LEGACY_STORYBOARD;
    expect(await fs.pathExists(path.join(projectRoot, snapshotRelPath))).toBe(true);
    const snapshot = await fs.readFile(path.join(projectRoot, snapshotRelPath), "utf8");
    const firstLine = snapshot.split(NL)[0]!;
    expect(firstLine).toContain("已迁移");
    expect(firstLine).toContain("只读快照");
    expect(firstLine).toContain(LEGACY_STORYBOARD);
    expect(firstLine).toMatch(/\d{4}-\d{2}-\d{2}/u);
    expect(snapshot).toContain(originalStoryboard.trim());

    // 旧 05 的原文也在快照里，一个字都没少。
    const videoSnapshot = await fs.readFile(
      path.join(projectRoot, "已迁移/" + LEGACY_VIDEO),
      "utf8"
    );
    expect(videoSnapshot.split(NL)[0]!).toContain("只读快照");
    expect(videoSnapshot).toContain(originalVideo.trim());

    // 快照目录不再参与检查：链接检查不会因为快照里的旧链接报错。
    expect(result.written.some((relPath) => relPath.startsWith("已迁移/"))).toBe(true);
  });

  test("冲突项不覆盖目标：目标分镜文件保留内容树正文", async () => {
    const projectRoot = await createLegacyProject();
    await seedLegacyProject(projectRoot);

    const preview = await buildMigrationPreview(projectRoot);
    const conflict = preview.entries.find((entry) => entry.action === "conflict");
    expect(conflict).toBeDefined();
    const conflictSource = await fs.readFile(path.join(projectRoot, conflict!.sourceRelPath), "utf8");

    await applyMigration(projectRoot, preview);

    // 目标文件里不出现冲突文件独有的正文（旧图片提示词没有被塞进分镜文件）。
    const targetAbs = path.join(projectRoot, conflict!.targetRelPath);
    expect(await fs.pathExists(targetAbs)).toBe(true);
    const target = await fs.readFile(targetAbs, "utf8");
    expect(target).not.toContain("雾塔门前的门缝特写");

    // 冲突文件的原文完整留在只读快照里，等人处理。
    const snapshotAbs = path.join(projectRoot, conflict!.snapshotRelPath);
    expect(await fs.pathExists(snapshotAbs)).toBe(true);
    expect(await fs.readFile(snapshotAbs, "utf8")).toContain("雾塔门前的门缝特写");
    expect(conflictSource).toContain("雾塔门前的门缝特写");
  });

  test("迁移后校验不再报「两套正文并存」：03 原件带标注、03 只多一份索引", async () => {
    const projectRoot = await createLegacyProject();
    await seedLegacyProject(projectRoot);

    const preview = await buildMigrationPreview(projectRoot);
    await applyMigration(projectRoot, preview);

    const result = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video" });
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).not.toContain("content-legacy-and-tree-coexist");

    // 03 原件保留原位并带标注，同时 03 下补出内容树索引（正文不复制到 03）。
    const kept = await fs.readFile(path.join(projectRoot, LEGACY_STORYBOARD), "utf8");
    expect(kept.split(NL)[0]).toContain("非当前正文");
    expect(await fs.pathExists(path.join(projectRoot, "03_分镜脚本/00_内容树索引.md"))).toBe(true);
  });

  test("迁移后项目按内容树读取", async () => {
    const projectRoot = await createLegacyProject();
    await seedLegacyProject(projectRoot);

    const preview = await buildMigrationPreview(projectRoot);
    await applyMigration(projectRoot, preview);

    const config = parseYaml(await fs.readFile(path.join(projectRoot, "project.config.yaml"), "utf8")) as {
      content?: { format_version?: number };
    };
    expect(config.content?.format_version).toBe(1);
    expect(await fs.pathExists(path.join(projectRoot, "内容"))).toBe(true);
    expect(await fs.pathExists(path.join(projectRoot, "内容/场-001/镜头组-001/镜头-001/00_镜头-001.md"))).toBe(true);
    expect(await fs.pathExists(path.join(projectRoot, "内容/场-001/镜头组-001/镜头-001/分镜-01.md"))).toBe(true);
  });

  test("迁移生成的场总览与 content assemble 共用同一份骨架（Q43）", async () => {
    const projectRoot = await createLegacyProject();
    await seedLegacyProject(projectRoot);

    const preview = await buildMigrationPreview(projectRoot);
    await applyMigration(projectRoot, preview);

    const overview = await fs.readFile(path.join(projectRoot, "内容/场-001/00_场总览.md"), "utf8");
    expect(overview).toContain("# 场-001 场总览");
    expect(overview).not.toContain("# 场 001 总览");
    expect(overview).toContain("## 对应剧本");
    expect(overview).toContain("剧本文件：`01_概念策划/剧本.md`");
    expect(overview).toContain("片段范围：<待补充>");

    // 骨架对齐后，迁移项目要过完整的内容树检查与验收。
    const verified = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video" });
    expect(verified.issues.map((issue) => issue.code)).not.toContain("content-summary-stale");
  });
});

describe("迁移保留镜内关键帧编号（J1）", () => {
  test("旧项目镜内关键帧 01／02 迁移后保留原编号，不按分镜重排；迁移后 check 收敛", async () => {
    const projectRoot = await createLegacyProject();
    // 干净的旧项目：两个关键帧文件都写明对应分镜（分镜 1 / 分镜 2），无冲突。
    await writeFile(
      projectRoot,
      "03_分镜脚本/镜头组-001/镜头-001.md",
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
        "### 分镜 2",
        "",
        "阿岚抬脚迈过门槛，雾气从身后合上。",
        ""
      ].join(NL)
    );
    await writeFile(
      projectRoot,
      "04_图片提示词/镜头组-001/镜头-001-关键帧-01.md",
      [
        "# 镜头 001 关键帧 01 图片提示词",
        "",
        "## 维护元信息",
        "",
        "- 镜头组：group-001",
        "- 镜头编号：shot-001",
        "- 对应分镜：分镜 1",
        "- 关键时刻：抬头前",
        "",
        "## 可复制提示词",
        "",
        FENCE + "text",
        "阿岚站在雾塔门前，冷调自然光。",
        FENCE,
        ""
      ].join(NL)
    );
    await writeFile(
      projectRoot,
      "04_图片提示词/镜头组-001/镜头-001-关键帧-02.md",
      [
        "# 镜头 001 关键帧 02 图片提示词",
        "",
        "## 维护元信息",
        "",
        "- 镜头组：group-001",
        "- 镜头编号：shot-001",
        "- 对应分镜：分镜 2",
        "- 关键时刻：迈过门槛",
        "",
        "## 可复制提示词",
        "",
        FENCE + "text",
        "阿岚迈过门槛，雾气合上，冷调自然光。",
        FENCE,
        ""
      ].join(NL)
    );
    await writeFile(
      projectRoot,
      "05_视频提示词/镜头组-001/镜头-001.md",
      [
        "# 镜头 001 视频提示词",
        "",
        "## 可复制提示词",
        "",
        FENCE + "text",
        "镜头1：中景正面视角，阿岚停顿后抬头，风声。",
        "",
        "镜头2：阿岚迈过门槛，雾气合上，风声。",
        FENCE,
        ""
      ].join(NL)
    );

    const preview = await buildMigrationPreview(projectRoot);
    expect(preview.canApply).toBe(true);
    const applied = await applyMigration(projectRoot, preview);
    expect(applied.ok).toBe(true);

    const storyboardDir = "内容/场-001/镜头组-001/镜头-001";
    const storyboardOne = await fs.readFile(path.join(projectRoot, storyboardDir, "分镜-01.md"), "utf8");
    const storyboardTwo = await fs.readFile(path.join(projectRoot, storyboardDir, "分镜-02.md"), "utf8");
    // 旧项目镜内全局编号原样保留：分镜 1 拿关键帧 01，分镜 2 拿关键帧 02。
    expect(storyboardOne).toContain("#### 关键帧 01");
    expect(storyboardTwo).toContain("#### 关键帧 02");

    // 迁移后整理收敛：二次整理不再报更新（旧迁移器重排编号会让 04 执行文件永不收敛）。
    const first = await assembleContentTree(projectRoot, { force: true });
    expect(first.issues).toEqual([]);
    const second = await assembleContentTree(projectRoot, { force: true });
    expect(second.changes.every((change) => change.kind === "unchanged")).toBe(true);

    const verified = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video" });
    expect(verified.ok).toBe(true);
    expect(verified.issues).toEqual([]);
  });
});
