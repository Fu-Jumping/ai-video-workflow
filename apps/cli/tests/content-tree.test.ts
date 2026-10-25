
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { assembleContentTree, checkContentConsistency, renderAssembleSummary } from "../src/lib/content-assemble.js";
import {
  assembleShotVideoPrompt,
  buildContentTree,
  keyframeLimitForSegmentCount,
  parseStoryboardDocument,
  renderAutoBlock,
  renderManualBlock,
  resolveContentMode,
  validateShotKeyframes
} from "../src/lib/content-tree.js";
import { createProject } from "../src/lib/init.js";
import {
  mediaRecordPath,
  renderMediaRecord,
  type MediaCandidateRecord,
  type MediaIdentity,
  type MediaRecord
} from "../src/lib/media-records.js";
import { syncProject } from "../src/lib/sync.js";
import { verifyProject } from "../src/lib/verify.js";
import { parseYaml, stringifyYaml } from "../src/lib/yaml.js";
import type { VerificationIssue } from "../src/lib/types.js";

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const tempRoots: string[] = [];
const FENCE = "```";
const NL = String.fromCharCode(10);

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await fs.remove(root);
  }
});

async function createContentProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "avw-content-tree-"));
  tempRoots.push(root);
  await createProject({
    targetRoot: root,
    projectName: "content-tree-project",
    pack: "official-ai-video",
    ide: "codex",
    imagePlatform: "openai",
    videoPlatform: "seedance"
  });
  const projectRoot = path.join(root, "content-tree-project");
  await syncProject({ repoRoot, projectRoot, ide: "codex", pack: "official-ai-video" });
  return projectRoot;
}

async function writeFile(projectRoot: string, relPath: string, content: string): Promise<void> {
  const absolute = path.join(projectRoot, relPath);
  await fs.ensureDir(path.dirname(absolute));
  await fs.writeFile(absolute, content, "utf8");
}

async function readFile(projectRoot: string, relPath: string): Promise<string> {
  return fs.readFile(path.join(projectRoot, relPath), "utf8");
}

async function dropContentFormatVersion(projectRoot: string): Promise<void> {
  const configPath = path.join(projectRoot, "project.config.yaml");
  const config = parseYaml(await fs.readFile(configPath, "utf8")) as Record<string, unknown>;
  delete config.content;
  await fs.writeFile(configPath, stringifyYaml(config), "utf8");
}

async function verify(projectRoot: string) {
  return verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video" });
}

function codesOf(issues: VerificationIssue[]): string[] {
  return issues.map((issue) => issue.code);
}

/** 返回自动区块正文在文件里的起止下标；找不到返回 null。 */
function autoBlockIndex(content: string, name: string): { start: number; end: number } | null {
  const startLine = "<!-- avw:auto:start name=" + name + " -->";
  const endLine = "<!-- avw:auto:end name=" + name + " -->";
  const start = content.indexOf(startLine);
  const end = content.indexOf(endLine);
  if (start < 0 || end < 0 || end < start) return null;
  return { start: start + startLine.length, end };
}

/** 只改自动区块正文、保留两行标记：用来模拟「手工改自动区块」。 */
function replaceAutoBlockBody(content: string, name: string, body: string): string {
  const index = autoBlockIndex(content, name);
  if (index === null) return content;
  const inner = content.slice(index.start, index.end);
  // 保留自动区块里的哈希注释行：被手改的是正文，不是哈希。
  const hashLine = inner.split(NL).find((line) => line.length > 0) ?? "";
  const head = hashLine.startsWith("<!-- avw:auto:hash=") ? NL + hashLine : "";
  return content.slice(0, index.start) + head + NL + body + NL + content.slice(index.end);
}

/** 删掉「## 可复制提示词」小节里的代码块，保留小节标题。 */
function dropCopyableFence(content: string): string {
  const heading = "## 可复制提示词";
  const headingAt = content.indexOf(heading);
  if (headingAt < 0) return content;
  const afterHeading = headingAt + heading.length;
  const nextHeadingAt = content.indexOf(NL + "## ", afterHeading);
  const end = nextHeadingAt < 0 ? content.length : nextHeadingAt;
  const section = content.slice(afterHeading, end);
  const fenceAt = section.indexOf(FENCE);
  if (fenceAt < 0) return content;
  const closeAt = section.indexOf(NL + FENCE, fenceAt + FENCE.length);
  if (closeAt < 0) return content;
  const replaced = section.slice(0, fenceAt) + "（这里没有代码块）" + section.slice(closeAt + (NL + FENCE).length);
  return content.slice(0, afterHeading) + replaced + content.slice(end);
}

/* ------------------------------ 夹具 ------------------------------ */

interface KeyframeFixture {
  number: number;
  /** 对应分镜；null 表示整行不写。 */
  mappedSegment: number | null;
  moment?: string | null;
  prompt?: string;
}

interface SegmentFixture {
  /** 片段正文（不含「镜头N：」前缀时会被补上）。 */
  prompt?: string;
  keyframes?: KeyframeFixture[];
  /** false 表示删掉「本段正文」小节。 */
  includeBodySection?: boolean;
  /** false 表示删掉整个「关键帧」小节。 */
  includeKeyframeSection?: boolean;
  /** false 表示「视频提示词」小节里没有代码块。 */
  includePromptFence?: boolean;
}

function storyboardContent(index: number, segment: SegmentFixture): string {
  const lines: string[] = ["# 分镜-" + String(index).padStart(2, "0") + "：第 " + index + " 段", ""];

  if (segment.includeBodySection !== false) {
    lines.push(
      "## 一、本段正文（画面与动作）",
      "",
      "- **景别与视角**：中景正面。",
      "- **人物与位置**：阿岚居中。",
      "- **背景与光线**：雾塔门前，冷调自然光。",
      "- **动作起止**：停步到抬头。",
      "- **拍法**：缓慢推进。",
      "- **声音**：风声。",
      "- **与前后衔接**：承接上一段。",
      ""
    );
  }

  if (segment.includeKeyframeSection !== false) {
    lines.push("## 二、关键帧", "");
    const keyframes = segment.keyframes ?? [];
    if (keyframes.length === 0) {
      lines.push("本段没有单独关键帧：纯过渡段。", "");
    } else {
      for (const keyframe of keyframes) {
        lines.push("#### 关键帧 " + String(keyframe.number).padStart(2, "0"), "");
        if (keyframe.mappedSegment !== null) {
          lines.push("- 对应分镜：分镜 " + keyframe.mappedSegment);
        }
        if (keyframe.moment !== null) {
          lines.push("- 关键时刻：" + (keyframe.moment ?? "第 " + index + " 段的转折点"));
        }
        lines.push("- 稳定画面状态：阿岚站在雾塔门前。", "- 选择理由：情绪转折点。", "");
        lines.push(FENCE + "text", keyframe.prompt ?? "阿岚站在雾塔门前，冷调自然光。", FENCE, "");
      }
    }
  }

  lines.push("## 三、视频提示词片段", "");
  const prompt = segment.prompt ?? "中景正面视角，主体在第 " + index + " 段停步抬头，风声。";
  if (segment.includePromptFence === false) {
    lines.push(prompt, "");
  } else {
    lines.push(FENCE + "text", prompt, FENCE, "");
  }
  return lines.join("\n");
}

function shotOverviewContent(displayName: string, watchOrder: number): string {
  return [
    "# 镜头 001：" + displayName,
    "",
    "- 观看顺序：" + watchOrder,
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
    renderManualBlock("视频提示词前段", "整镜公共说明：@阿岚三视图 与 @雾塔场景图 绑定到本镜。"),
    "",
    renderAutoBlock("镜头段拼装", "（待拼装）"),
    "",
    renderManualBlock("视频提示词后段", "写实电影画风，冷调自然光，保留环境声和动作声，无配乐、无字幕。"),
    ""
  ].join("\n");
}

async function seedScene(projectRoot: string, sceneDir = "场-001", groupDirs: string[] = ["镜头组-001"]): Promise<void> {
  await writeFile(
    projectRoot,
    "内容/" + sceneDir + "/00_场总览.md",
    "# " + sceneDir + " 场总览\n\n## 这一场讲什么\n\n雾塔门前。\n\n## 所属镜头组\n\n" +
      renderAutoBlock("场镜头组表", "| a |\n| --- |") + "\n"
  );
  for (const groupDir of groupDirs) {
    await writeFile(
      projectRoot,
      "内容/" + sceneDir + "/" + groupDir + "/00_镜头组总览.md",
      "# " + groupDir + " 镜头组总览\n\n## 这一组讲什么\n\n开场。\n\n## 所属镜头\n\n" +
        renderAutoBlock("组镜头表", "| a |\n| --- |") + "\n"
    );
  }
}

interface ShotOptions {
  sceneDir?: string;
  groupDir?: string;
  shotDir?: string;
  displayName?: string;
  watchOrder?: number;
  segments: SegmentFixture[];
}

async function seedShot(projectRoot: string, options: ShotOptions): Promise<string> {
  const sceneDir = options.sceneDir ?? "场-001";
  const groupDir = options.groupDir ?? "镜头组-001";
  const shotDir = options.shotDir ?? "镜头-001";
  const directory = "内容/" + sceneDir + "/" + groupDir + "/" + shotDir;
  await writeFile(
    projectRoot,
    directory + "/00_" + shotDir + ".md",
    shotOverviewContent(options.displayName ?? "雾塔门前", options.watchOrder ?? 1)
  );
  for (let index = 1; index <= options.segments.length; index += 1) {
    await writeFile(
      projectRoot,
      directory + "/分镜-" + String(index).padStart(2, "0") + ".md",
      storyboardContent(index, options.segments[index - 1]!)
    );
  }
  return directory;
}

async function assemble(projectRoot: string) {
  return assembleContentTree(projectRoot, { force: true });
}

function selectedCandidate(fileName: string): MediaCandidateRecord {
  return {
    version: 1,
    candidate: 1,
    fileName,
    platformStatus: "completed",
    downloadStatus: "downloaded",
    reviewStatus: "unreviewed",
    selected: true
  };
}

/** 按播种说明写人读编号（镜头-001 / 关键帧-01 / 视频）的素材记录；候选文件不要求存在。 */
async function seedHumanNumberedMedia(projectRoot: string): Promise<void> {
  const keyframeIdentity: MediaIdentity = { category: "keyframe", objectId: "镜头-001", purpose: "关键帧-01" };
  const keyframeFile = "镜头-001_关键帧-01_v001_c01.png";
  const keyframeRecord: MediaRecord = {
    identity: keyframeIdentity,
    displayName: "镜头-001 关键帧 01",
    source: "generated",
    currentSelection: keyframeFile,
    candidates: [selectedCandidate(keyframeFile)],
    createdAt: "2026-10-24T00:00:00.000Z",
    updatedAt: "2026-10-24T00:00:00.000Z"
  };
  await writeFile(projectRoot, mediaRecordPath(keyframeIdentity), renderMediaRecord(keyframeRecord));

  const videoIdentity: MediaIdentity = { category: "video", objectId: "镜头-001", purpose: "视频" };
  const videoFile = "镜头-001_v001_c01.mp4";
  const videoRecord: MediaRecord = {
    identity: videoIdentity,
    displayName: "镜头-001 视频",
    source: "generated",
    currentSelection: videoFile,
    candidates: [selectedCandidate(videoFile)],
    createdAt: "2026-10-24T00:00:00.000Z",
    updatedAt: "2026-10-24T00:00:00.000Z"
  };
  await writeFile(projectRoot, mediaRecordPath(videoIdentity), renderMediaRecord(videoRecord));
}

const SHOT_OVERVIEW = "内容/场-001/镜头组-001/镜头-001/00_镜头-001.md";
const STEP5_FILE = "05_视频提示词/镜头组-001/镜头-001.md";

/* ------------------------------ 用例 ------------------------------ */

describe("内容树：分镜数量合同", () => {
  test("1 个分镜的镜头通过校验", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, { segments: [{ keyframes: [{ number: 1, mappedSegment: 1 }] }] });
    const result = await assemble(projectRoot);
    expect(result.issues).toEqual([]);

    const verified = await verify(projectRoot);
    expect(verified.issues).toEqual([]);
    expect(verified.ok).toBe(true);
  });

  test("4／5／6 个分镜的镜头都通过校验", async () => {
    for (const count of [4, 5, 6]) {
      const projectRoot = await createContentProject();
      await seedScene(projectRoot);
      await seedShot(projectRoot, { segments: Array.from({ length: count }, () => ({})) });
      const result = await assemble(projectRoot);
      expect(result.issues).toEqual([]);

      const verified = await verify(projectRoot);
      expect(verified.issues).toEqual([]);
      expect(verified.ok).toBe(true);
    }
  });

  test("超过 6 个分镜报 invalid-storyboard-segment-count", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, { segments: Array.from({ length: 7 }, () => ({})) });

    const tree = await buildContentTree(projectRoot);
    expect(codesOf(tree.issues)).toContain("invalid-storyboard-segment-count");

    const verified = await verify(projectRoot);
    expect(codesOf(verified.issues)).toContain("invalid-storyboard-segment-count");
    expect(verified.ok).toBe(false);
  });

  test("分镜序号不连续报 invalid-storyboard-segment-count", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    const directory = await seedShot(projectRoot, { segments: [{}, {}] });
    // 只留 分镜-01 与 分镜-03：序号出现空洞。
    await fs.remove(path.join(projectRoot, directory, "分镜-02.md"));
    await writeFile(projectRoot, directory + "/分镜-03.md", storyboardContent(3, {}));

    const tree = await buildContentTree(projectRoot);
    expect(codesOf(tree.issues)).toContain("invalid-storyboard-segment-count");
  });
});

describe("内容树：关键帧合同", () => {
  test("没有独立关键帧的镜头通过校验", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, { segments: [{}, {}] });

    // 不写「#### 关键帧」时，两个分镜的关键帧数组都为空，且不算错误。
    const tree = await buildContentTree(projectRoot);
    expect(tree.shots).toHaveLength(1);
    expect(tree.shots[0]!.storyboards).toHaveLength(2);
    for (const storyboard of tree.shots[0]!.storyboards) {
      expect(storyboard.document.keyframes).toEqual([]);
    }
    expect(codesOf(tree.issues)).not.toContain("invalid-keyframe-mapping");

    const result = await assemble(projectRoot);
    expect(result.issues).toEqual([]);

    const verified = await verify(projectRoot);
    expect(verified.issues).toEqual([]);
    expect(verified.ok).toBe(true);
  });

  test("关键帧数量不超过 min(4, 分镜数) 时通过", async () => {
    // 上限口径：不超过 4 张，也不超过分镜数。
    expect(keyframeLimitForSegmentCount(1)).toBe(1);
    expect(keyframeLimitForSegmentCount(2)).toBe(2);
    expect(keyframeLimitForSegmentCount(5)).toBe(4);

    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, {
      segments: [
        { keyframes: [{ number: 1, mappedSegment: 1 }] },
        { keyframes: [{ number: 2, mappedSegment: 2 }] }
      ]
    });
    const result = await assemble(projectRoot);
    expect(result.issues).toEqual([]);

    const verified = await verify(projectRoot);
    expect(verified.issues).toEqual([]);
    expect(verified.ok).toBe(true);
  });

  test("同一个分镜里可以放两张关键帧", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    // 一个镜头两个分镜：第 1 段放关键帧 01 与 02，第 2 段不放。
    await seedShot(projectRoot, {
      segments: [
        {
          keyframes: [
            { number: 1, mappedSegment: 1 },
            { number: 2, mappedSegment: 2 }
          ]
        },
        {}
      ]
    });

    const tree = await buildContentTree(projectRoot);
    expect(tree.shots).toHaveLength(1);
    expect(tree.shots[0]!.storyboards[0]!.document.keyframes).toHaveLength(2);
    expect(tree.shots[0]!.storyboards[0]!.document.keyframes.map((keyframe) => keyframe.id)).toEqual([
      "keyframe-01",
      "keyframe-02"
    ]);
    expect(tree.shots[0]!.storyboards[1]!.document.keyframes).toHaveLength(0);
    expect(codesOf(tree.issues)).not.toContain("invalid-keyframe-mapping");
  });

  test("关键帧数量超过 min(4, 分镜数) 报 invalid-keyframe-mapping", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, {
      segments: [
        {
          keyframes: [
            { number: 1, mappedSegment: 1 },
            { number: 2, mappedSegment: 2 }
          ]
        },
        {
          keyframes: [{ number: 3, mappedSegment: 2 }]
        }
      ]
    });

    const tree = await buildContentTree(projectRoot);
    expect(codesOf(tree.issues)).toContain("invalid-keyframe-mapping");
  });

  test("关键帧缺少「对应分镜」引用时报错", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, {
      segments: [{ keyframes: [{ number: 1, mappedSegment: null }] }]
    });

    const tree = await buildContentTree(projectRoot);
    expect(codesOf(tree.issues)).toContain("invalid-keyframe-mapping");

    // 单独调校验函数：结论与内容树一致，且错误信息点名「对应分镜」。
    const shot = tree.shots[0]!;
    const keyframeIssues = validateShotKeyframes(
      shot.document,
      shot.storyboards.map((storyboard) => storyboard.document)
    );
    expect(codesOf(keyframeIssues)).toContain("invalid-keyframe-mapping");
    expect(keyframeIssues.some((issue) => issue.message.includes("对应分镜"))).toBe(true);
  });

  test("关键帧指到本镜不存在的分镜时报 invalid-keyframe-mapping", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, {
      segments: [{}, { keyframes: [{ number: 1, mappedSegment: 5 }] }]
    });

    const tree = await buildContentTree(projectRoot);
    expect(codesOf(tree.issues)).toContain("invalid-keyframe-mapping");
  });
});

describe("内容树：新旧格式按版本读取", () => {
  test("缺 content.format_version 的旧项目只读旧 03／04／05", async () => {
    const projectRoot = await createContentProject();
    await dropContentFormatVersion(projectRoot);
    await writeFile(projectRoot, "03_分镜脚本/镜头组-001/镜头-001.md", "# 镜头 001：雾塔门前\n");

    const resolution = await resolveContentMode(projectRoot);
    expect(resolution.mode).toBe("legacy");
    expect(resolution.version).toBeNull();

    const verified = await verify(projectRoot);
    expect(codesOf(verified.issues).filter((code) => code.startsWith("content-"))).toEqual([]);
  });

  test("声明 format_version: 1 时读内容树", async () => {
    const projectRoot = await createContentProject();
    const resolution = await resolveContentMode(projectRoot);
    expect(resolution.mode).toBe("content-tree");
    expect(resolution.version).toBe(1);
    expect(resolution.contentRootExists).toBe(true);
    expect(resolution.issues).toEqual([]);
  });

  test("新旧两套正文并存时以内容树为准，删掉 content 键后回到旧格式", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, { segments: [{}] });
    await assemble(projectRoot);

    // 同一项目里再放一份旧 03 镜头文件：两套正文同时存在。
    await writeFile(projectRoot, "03_分镜脚本/镜头组-001/镜头-001.md", "# 镜头 001：旧正文\n");

    const coexisting = await resolveContentMode(projectRoot);
    expect(coexisting.mode).toBe("content-tree");
    expect(coexisting.version).toBe(1);
    expect(coexisting.contentRootExists).toBe(true);

    // 去掉 content 键：同样的文件，退回旧格式读取。
    await dropContentFormatVersion(projectRoot);
    const legacy = await resolveContentMode(projectRoot);
    expect(legacy.mode).toBe("legacy");
    expect(legacy.version).toBeNull();
  });

  test("新旧两套正文并存报 content-legacy-and-tree-coexist", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, { segments: [{}] });
    await assemble(projectRoot);
    await writeFile(projectRoot, "03_分镜脚本/镜头组-001/镜头-001.md", "# 镜头 001：旧正文\n");

    const verified = await verify(projectRoot);
    const coexist = verified.issues.filter((issue) => issue.code === "content-legacy-and-tree-coexist");
    expect(coexist).toHaveLength(1);
    expect(coexist[0]!.message).toContain("03_分镜脚本/镜头组-001/镜头-001.md");
    expect(coexist[0]!.message).toContain("已迁移/");
    expect(coexist[0]!.message).toContain("以内容树");
  });

  test("声明了新格式但没有 内容/ 目录报 content-tree-missing", async () => {
    const projectRoot = await createContentProject();
    await fs.remove(path.join(projectRoot, "内容"));

    const verified = await verify(projectRoot);
    expect(codesOf(verified.issues)).toContain("content-tree-missing");
  });
});

describe("内容树：稳定身份", () => {
  test("移动镜头组与调换顺序后 shotId／storyboardId 不变", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot, "场-001", ["镜头组-001", "镜头组-002"]);
    const directory = await seedShot(projectRoot, { segments: [{}, {}] });

    const before = await buildContentTree(projectRoot);
    expect(before.shots).toHaveLength(1);
    const beforeShot = before.shots[0]!;
    expect(beforeShot.shotId).toBe("shot-001");
    expect(beforeShot.storyboards.map((storyboard) => storyboard.document.storyboardId)).toEqual([
      "storyboard-01",
      "storyboard-02"
    ]);

    // 整组挪到另一个镜头组：身份来自「类别+编号」，与所在组、顺序无关。
    const moved = "内容/场-001/镜头组-002/镜头-001";
    await fs.move(path.join(projectRoot, directory), path.join(projectRoot, moved));

    const after = await buildContentTree(projectRoot);
    expect(after.shots).toHaveLength(1);
    const afterShot = after.shots[0]!;
    expect(afterShot.shotId).toBe("shot-001");
    expect(afterShot.groupId).toBe("group-002");
    expect(afterShot.storyboards.map((storyboard) => storyboard.document.storyboardId)).toEqual([
      "storyboard-01",
      "storyboard-02"
    ]);
    expect(afterShot.assembly.text).toBe(beforeShot.assembly.text);
  });

  test("调换分镜顺序后整镜正文按序号拼装，片段前缀与序号一致", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    const directory = await seedShot(projectRoot, {
      segments: [
        { prompt: "甲段：阿岚停步抬头。" },
        { prompt: "乙段：阿岚迈过门槛。" }
      ]
    });

    const first = await readFile(projectRoot, directory + "/分镜-01.md");
    const second = await readFile(projectRoot, directory + "/分镜-02.md");
    // 内容互换：分镜-01 装原第二段，分镜-02 装原第一段。
    await writeFile(projectRoot, directory + "/分镜-01.md", second.replace("# 分镜-02", "# 分镜-01"));
    await writeFile(projectRoot, directory + "/分镜-02.md", first.replace("# 分镜-01", "# 分镜-02"));

    const tree = await buildContentTree(projectRoot);
    const shot = tree.shots[0]!;
    const assembly = assembleShotVideoPrompt(
      shot.document,
      shot.storyboards.map((storyboard) => storyboard.document)
    );
    expect(assembly.issues).toEqual([]);
    expect(assembly.segments.map((segment) => segment.number)).toEqual([1, 2]);
    expect(assembly.segments[0]!.text.startsWith("镜头1：")).toBe(true);
    expect(assembly.segments[1]!.text.startsWith("镜头2：")).toBe(true);
    // 拼装顺序按分镜序号，不按文件内容来源：第 1 段是换过来的「乙段」。
    expect(assembly.segments[0]!.text).toContain("乙段");
    expect(assembly.segments[1]!.text).toContain("甲段");
    expect(assembly.text).not.toBeNull();
    expect(assembly.text!.indexOf("镜头1：")).toBeLessThan(assembly.text!.indexOf("镜头2："));
  });

  test("改 H1 展示名不影响身份", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    const directory = await seedShot(projectRoot, { displayName: "雾塔门前", segments: [{}] });
    const before = await buildContentTree(projectRoot);
    expect(before.shots[0]!.shotId).toBe("shot-001");
    expect(before.shots[0]!.document.displayName).toBe("雾塔门前");

    const overviewPath = directory + "/00_镜头-001.md";
    await writeFile(
      projectRoot,
      overviewPath,
      (await readFile(projectRoot, overviewPath)).replace("# 镜头 001：雾塔门前", "# 镜头 001：雾塔门前（改名）")
    );
    const after = await buildContentTree(projectRoot);
    expect(after.shots[0]!.shotId).toBe("shot-001");
    expect(after.shots[0]!.document.displayName).toBe("雾塔门前（改名）");
  });
});

describe("内容树：汇总与执行文件一致性", () => {
  test("汇总没刷新时报 content-summary-stale", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    const directory = await seedShot(projectRoot, { segments: [{}] });
    await assemble(projectRoot);

    // 只改分镜的片段，不重新整理：镜头汇总里的自动区块落后。
    const storyboardPath = directory + "/分镜-01.md";
    await writeFile(
      projectRoot,
      storyboardPath,
      (await readFile(projectRoot, storyboardPath)).replace("停步抬头", "转身离开")
    );

    const verified = await verify(projectRoot);
    expect(codesOf(verified.issues)).toContain("content-summary-stale");
    expect(codesOf(verified.issues)).not.toContain("content-summary-manual-drift");
    expect(verified.ok).toBe(false);
  });

  test("手工改自动区块报 content-summary-manual-drift", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, { segments: [{}] });
    await assemble(projectRoot);

    const summary = await readFile(projectRoot, SHOT_OVERVIEW);
    const patched = replaceAutoBlockBody(summary, "镜头段拼装", "镜头1：手写进来的正文。");
    expect(patched).not.toBe(summary);
    await writeFile(projectRoot, SHOT_OVERVIEW, patched);

    const verified = await verify(projectRoot);
    expect(codesOf(verified.issues)).toContain("content-summary-manual-drift");
    expect(codesOf(verified.issues)).not.toContain("content-summary-stale");

    // 不带 force 再整理一次：手写内容必须原样保留，并且整理结果里报同样的漂移。
    const again = await assembleContentTree(projectRoot, {});
    expect(codesOf(again.issues)).toContain("content-summary-manual-drift");
    const afterAssemble = await readFile(projectRoot, SHOT_OVERVIEW);
    expect(afterAssemble).toContain("镜头1：手写进来的正文。");
  });

  test("执行文件落后时报 content-execution-stale", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, { segments: [{}] });
    await assemble(projectRoot);

    const step5 = await readFile(projectRoot, STEP5_FILE);
    await writeFile(projectRoot, STEP5_FILE, step5.replace("停步抬头", "手改执行文件"));

    const verified = await verify(projectRoot);
    expect(codesOf(verified.issues)).toContain("content-execution-stale");
  });

  test("执行文件缺少「可复制提示词」代码块报 content-summary-execution-mismatch", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, { segments: [{}] });
    await assemble(projectRoot);

    const step5 = await readFile(projectRoot, STEP5_FILE);
    const broken = dropCopyableFence(step5);
    expect(broken).not.toBe(step5);
    await writeFile(projectRoot, STEP5_FILE, broken);

    const verified = await verify(projectRoot);
    expect(codesOf(verified.issues)).toContain("content-summary-execution-mismatch");
  });
});

describe("内容树：执行文件整份新鲜度与素材诊断", () => {
  test("改正文标注行后 content check 与 verify 都报 content-execution-stale", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    const directory = await seedShot(projectRoot, { segments: [{ keyframes: [{ number: 1, mappedSegment: 1 }] }] });
    await assemble(projectRoot);
    expect(codesOf((await checkContentConsistency(projectRoot)).issues)).toEqual([]);

    // 只改正文（人物与位置进 04 执行文件的「主体状态」），提示词与汇总都没动：
    // 提示词级比对发现不了，整份新鲜度检查必须能发现。
    const storyboardPath = directory + "/分镜-01.md";
    await writeFile(
      projectRoot,
      storyboardPath,
      (await readFile(projectRoot, storyboardPath)).replace("- **人物与位置**：阿岚居中。", "- **人物与位置**：阿岚在门侧。")
    );

    const checked = await checkContentConsistency(projectRoot);
    const stalePaths = checked.issues.filter((issue) => issue.code === "content-execution-stale").map((issue) => issue.path);
    expect(stalePaths).toContain(STEP5_FILE);
    // 04 的「主体状态」来自该行、05 的正文指纹也来自正文：两份执行文件都要报。
    expect(stalePaths.some((path) => path!.startsWith("04_图片提示词/"))).toBe(true);

    const verified = await verify(projectRoot);
    expect(codesOf(verified.issues)).toContain("content-execution-stale");
    expect(verified.ok).toBe(false);
  });

  test("改正文摘要行后 verify 也报分镜速览落后", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    const directory = await seedShot(projectRoot, { segments: [{}] });
    await assemble(projectRoot);

    // 动作起止是「分镜速览」摘要的来源行：改它会让镜头汇总的速览区块落后。
    const storyboardPath = directory + "/分镜-01.md";
    await writeFile(
      projectRoot,
      storyboardPath,
      (await readFile(projectRoot, storyboardPath)).replace("- **动作起止**：停步到抬头。", "- **动作起止**：推门到站定。")
    );

    expect(codesOf((await checkContentConsistency(projectRoot)).issues)).toContain("content-summary-stale");
    const verified = await verify(projectRoot);
    expect(codesOf(verified.issues)).toContain("content-summary-stale");
  });

  test("素材状态变化后执行文件报 stale（行为扩展点锁定）", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, { segments: [{ keyframes: [{ number: 1, mappedSegment: 1 }] }] });
    await seedHumanNumberedMedia(projectRoot);
    await assemble(projectRoot);

    // 候选取消选用标记：素材状态从「已选用」变为「下载了但尚未选用」，执行文件与总表都要刷新。
    const recordPath = mediaRecordPath({ category: "video", objectId: "镜头-001", purpose: "视频" });
    await writeFile(
      projectRoot,
      recordPath,
      (await readFile(projectRoot, recordPath)).replace("选用: 是", "选用: 否")
    );

    const checked = await checkContentConsistency(projectRoot);
    expect(codesOf(checked.issues)).toContain("content-execution-stale");
  });

  test("currentSelection 按文件名取当前候选，不退化为最后一个候选", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, { segments: [{ keyframes: [{ number: 1, mappedSegment: 1 }] }] });

    // 候选 1 已选用（已审可用），候选 2 只下载未审：当前选用是候选 1，状态应显示「已选用」，
    // 而不是旧逻辑里永远匹配不上文件名后退化为最后一个候选的「下载了但尚未选用」。
    const identity: MediaIdentity = { category: "video", objectId: "镜头-001", purpose: "视频" };
    const firstFile = "镜头-001_v001_c01.mp4";
    const secondFile = "镜头-001_v001_c02.mp4";
    const record: MediaRecord = {
      identity,
      displayName: "镜头-001 视频",
      source: "generated",
      currentSelection: firstFile,
      candidates: [
        {
          version: 1,
          candidate: 1,
          fileName: firstFile,
          platformStatus: "completed",
          downloadStatus: "downloaded",
          reviewStatus: "accepted",
          selected: true,
          sha256: "a".repeat(64)
        },
        {
          version: 1,
          candidate: 2,
          fileName: secondFile,
          platformStatus: "completed",
          downloadStatus: "downloaded",
          reviewStatus: "unreviewed",
          selected: false
        }
      ],
      createdAt: "2026-10-24T00:00:00.000Z",
      updatedAt: "2026-10-24T00:00:00.000Z"
    };
    await writeFile(projectRoot, mediaRecordPath(identity), renderMediaRecord(record));

    const result = await assemble(projectRoot);
    expect(result.issues).toEqual([]);
    const step5 = await readFile(projectRoot, STEP5_FILE);
    expect(step5).toContain("素材状态：已选用");
    expect(step5).not.toContain("下载了但尚未选用");

    const overview = await readFile(projectRoot, "内容/00_镜头总表.md");
    const row = overview.split("\n").find((line) => line.startsWith("| ") && line.includes("镜头-001"));
    expect(row).toContain("| 已选用 |");
  });

  test("同镜头双编号素材记录报 media-identity-conflict", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, { segments: [{ keyframes: [{ number: 1, mappedSegment: 1 }] }] });
    await seedHumanNumberedMedia(projectRoot);

    // 同一镜头再写一份内部编号（shot-001）的视频记录：两套编号并用要给出重复身份诊断。
    const internalIdentity: MediaIdentity = { category: "video", objectId: "shot-001", purpose: "视频" };
    const internalFile = "shot-001_v001_c01.mp4";
    const internalRecord: MediaRecord = {
      identity: internalIdentity,
      displayName: "shot-001 视频",
      source: "generated",
      currentSelection: internalFile,
      candidates: [selectedCandidate(internalFile)],
      createdAt: "2026-10-24T00:00:00.000Z",
      updatedAt: "2026-10-24T00:00:00.000Z"
    };
    await writeFile(projectRoot, mediaRecordPath(internalIdentity), renderMediaRecord(internalRecord));

    const result = await assemble(projectRoot);
    expect(codesOf(result.issues)).toContain("media-identity-conflict");
    expect(codesOf((await checkContentConsistency(projectRoot)).issues)).toContain("media-identity-conflict");
  });

  test("正文指纹让独立对白行的改动也能被检出", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    const directory = await seedShot(projectRoot, { segments: [{}] });
    const storyboardPath = directory + "/分镜-01.md";

    // 先给正文加一条独立对白行并整理：指纹记录下这一版正文。
    await writeFile(
      projectRoot,
      storyboardPath,
      (await readFile(projectRoot, storyboardPath)).replace("- **声音**：风声。", "- **声音**：风声。\n- 对白：这伞撑不过雨季了。")
    );
    await assemble(projectRoot);
    expect(codesOf((await checkContentConsistency(projectRoot)).issues)).toEqual([]);

    // 只改对白文字、不改任何提示词：05 元信息里的正文指纹随之变化，必须能被发现。
    await writeFile(
      projectRoot,
      storyboardPath,
      (await readFile(projectRoot, storyboardPath)).replace("对白：这伞撑不过雨季了。", "对白：伞骨都酥了，将就到雨季结束吧。")
    );

    const checked = await checkContentConsistency(projectRoot);
    const stalePaths = checked.issues.filter((issue) => issue.code === "content-execution-stale").map((issue) => issue.path);
    expect(stalePaths).toContain(STEP5_FILE);
    const step5 = await readFile(projectRoot, STEP5_FILE);
    expect(step5).toContain("正文指纹：");
  });

  test("参考资产提取不受自动区块刷新影响（整理幂等）", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    const directory = await seedShot(projectRoot, {
      segments: [{ keyframes: [{ number: 1, mappedSegment: 1, prompt: "罗婆婆递出黑伞，参考 @罗婆婆三视图。" }] }]
    });
    // 分镜正文先出现另一个 @ 提及：自动区块未刷新时，它先于关键帧提示词进入素材顺序。
    const storyboardPath = directory + "/分镜-01.md";
    await writeFile(
      projectRoot,
      storyboardPath,
      (await readFile(projectRoot, storyboardPath)).replace("- **声音**：风声。", "- **声音**：风声。\n- 参考资产：@场景三视图。")
    );
    await assemble(projectRoot);

    const step4Path = "04_图片提示词/镜头组-001/镜头-001-关键帧-01.md";
    const first = await readFile(projectRoot, step4Path);
    // 顺序断言只看「参考资产」小节：提示词全文里罗婆婆本来就先出现。
    const assetsSection = first.slice(first.indexOf("## 参考资产"));
    expect(assetsSection.indexOf("@场景三视图")).toBeGreaterThan(-1);
    expect(assetsSection.indexOf("@场景三视图")).toBeLessThan(assetsSection.indexOf("@罗婆婆三视图"));

    // 第二次整理必须不再有变化：自动区块是渲染输出，不能反过来改变素材顺序。
    const again = await assemble(projectRoot);
    expect(again.changes.every((change) => change.kind === "unchanged")).toBe(true);
    expect(await readFile(projectRoot, step4Path)).toBe(first);
  });
});

describe("内容树：assemble 写盘逐项报告与只读处理", () => {
  test("目标与备份只读时整理仍成功，失败后可直接重试", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    const directory = await seedShot(projectRoot, { segments: [{ keyframes: [{ number: 1, mappedSegment: 1 }] }] });
    await assemble(projectRoot);

    // 先制造一轮更新：首轮整理全是新建文件，没有备份；更新过一次后 .tmp/content-backup/ 才有旧内容。
    const storyboardPath = directory + "/分镜-01.md";
    await writeFile(projectRoot, storyboardPath, (await readFile(projectRoot, storyboardPath)).replace("停步抬头", "转身离开"));
    await assemble(projectRoot);

    // 上一轮失败留下的现场：目标执行文件与备份都带只读位。
    const backupPath = path.join(".tmp", "content-backup", STEP5_FILE);
    for (const relPath of [STEP5_FILE, backupPath]) {
      await fs.chmod(path.join(projectRoot, relPath), 0o444);
    }
    try {
      await writeFile(projectRoot, storyboardPath, (await readFile(projectRoot, storyboardPath)).replace("转身离开", "推门张望"));

      const result = await assembleContentTree(projectRoot, { force: true });
      expect(result.writeFailures).toEqual([]);
      expect(result.ok).toBe(true);
      const step5 = await readFile(projectRoot, STEP5_FILE);
      expect(step5).toContain("推门张望");

      // 再跑一次幂等：不再有变化。
      const again = await assembleContentTree(projectRoot, { force: true });
      expect(again.changes.every((change) => change.kind === "unchanged")).toBe(true);
    } finally {
      for (const relPath of [STEP5_FILE, backupPath]) {
        await fs.chmod(path.join(projectRoot, relPath), 0o644);
      }
    }
  });

  test("单项写失败时逐项报告，其余文件照常写入", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    const directory = await seedShot(projectRoot, { segments: [{ keyframes: [{ number: 1, mappedSegment: 1 }] }] });
    await assemble(projectRoot);

    // 把 05 的镜头组目录变成一个同名文件：这一项写不进去，其他项不受牵连。
    const groupDir = path.join(projectRoot, "05_视频提示词", "镜头组-001");
    await fs.remove(groupDir);
    await fs.writeFile(groupDir, "占位", "utf8");
    try {
      const storyboardPath = directory + "/分镜-01.md";
      await writeFile(
        projectRoot,
        storyboardPath,
        (await readFile(projectRoot, storyboardPath)).replace("停步抬头", "转身离开")
      );

      const result = await assembleContentTree(projectRoot, { force: true });
      expect(result.writeFailures.map((failure) => failure.relPath)).toEqual([STEP5_FILE]);
      expect(result.ok).toBe(false);
      const summary = renderAssembleSummary(result);
      expect(summary).toContain("未写 1 个");
      expect(summary).toContain("x " + STEP5_FILE);
      // 其余执行文件照常刷新：04 的主体状态所在行没变，但素材状态行与提示词都在，检查它的哈希刷新即可。
      const indexContent = await readFile(projectRoot, "03_分镜脚本/00_内容树索引.md");
      expect(indexContent.length).toBeGreaterThan(0);
      const checked = await checkContentConsistency(projectRoot);
      const stalePaths = checked.issues.filter((issue) => issue.code === "content-execution-stale").map((issue) => issue.path);
      expect(stalePaths).toContain(STEP5_FILE);
    } finally {
      await fs.remove(groupDir);
    }
  });
});

describe("内容树：人读编号素材记录", () => {
  test("人读编号的素材记录出现在 04/05 素材状态与镜头总表", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, { segments: [{ keyframes: [{ number: 1, mappedSegment: 1 }] }] });
    await seedHumanNumberedMedia(projectRoot);

    const result = await assemble(projectRoot);
    expect(result.issues).toEqual([]);

    const step4 = await readFile(projectRoot, "04_图片提示词/镜头组-001/镜头-001-关键帧-01.md");
    expect(step4).toContain("素材状态：已选用");
    const step5 = await readFile(projectRoot, STEP5_FILE);
    expect(step5).toContain("素材状态：已选用");

    const overview = await readFile(projectRoot, "内容/00_镜头总表.md");
    const row = overview.split("\n").find((line) => line.startsWith("| ") && line.includes("镜头-001"));
    expect(row, "镜头总表里有这个镜头的一行").toBeDefined();
    expect(row).toContain("1 张（已选用）");
    expect(row).toContain("| 已选用 |");
    expect(row).not.toContain("未生成");
  });

  test("缺少 05 执行文件时报出的路径使用镜头组中文目录", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, { segments: [{}] });
    await assemble(projectRoot);
    await fs.remove(path.join(projectRoot, STEP5_FILE));

    const verified = await verify(projectRoot);
    const missing = verified.issues.filter(
      (issue) => issue.code === "content-execution-stale" && issue.message.includes("缺少 05 执行文件")
    );
    expect(missing).toHaveLength(1);
    expect(missing[0]!.path).toBe(STEP5_FILE);
    expect(verified.issues.filter((issue) => issue.path?.includes("group-001"))).toEqual([]);
  });
});

describe("内容树：人读位置使用中文编号", () => {
  test("镜头总表、场总览、索引与 04/05 元信息显示 场-001 / 镜头组-001 / 镜头-001", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, { segments: [{ keyframes: [{ number: 1, mappedSegment: 1 }] }] });

    const result = await assemble(projectRoot);
    expect(result.issues).toEqual([]);

    const shotOverview = await readFile(projectRoot, "内容/00_镜头总表.md");
    expect(shotOverview).toContain("| 场-001 / 镜头组-001 |");
    expect(shotOverview).not.toContain("scene-001");
    expect(shotOverview).not.toContain("group-001");

    const sceneOverview = await readFile(projectRoot, "内容/场-001/00_场总览.md");
    expect(sceneOverview).toContain("| 镜头组-001 |");
    expect(sceneOverview).not.toContain("group-001");

    const index = await readFile(projectRoot, "03_分镜脚本/00_内容树索引.md");
    expect(index).toContain("### 场-001");
    expect(index).toContain("- [镜头组-001](");
    expect(index).not.toContain("镜头组 镜头组-001");
    expect(index).not.toContain("scene-001");
    expect(index).not.toContain("group-001");

    const step4 = await readFile(projectRoot, "04_图片提示词/镜头组-001/镜头-001-关键帧-01.md");
    expect(step4).toContain("- 镜头组：镜头组-001");
    expect(step4).toContain("- 镜头编号：镜头-001");
    expect(step4).not.toContain("group-001");
    expect(step4).not.toContain("shot-001");

    const step5 = await readFile(projectRoot, STEP5_FILE);
    expect(step5).toContain("- 镜头组：镜头组-001");
    expect(step5).toContain("- 镜头编号：镜头-001");
    expect(step5).toContain("- 场景事件范围：场-001 / 镜头组-001");
    expect(step5).not.toContain("group-001");
    expect(step5).not.toContain("shot-001");
  });

  test("删掉场总览后重新整理，新建文件 H1 是「场-001 场总览」", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, { segments: [{}] });
    await assemble(projectRoot);
    await fs.remove(path.join(projectRoot, "内容/场-001/00_场总览.md"));

    const result = await assemble(projectRoot);
    expect(result.issues).toEqual([]);

    const sceneOverview = await readFile(projectRoot, "内容/场-001/00_场总览.md");
    expect(sceneOverview.split("\n")[0]).toBe("# 场-001 场总览");
    expect(sceneOverview).not.toContain("scene-001");
    expect(sceneOverview).toContain("| 镜头组-001 |");
    expect(sceneOverview).toContain("## 对应剧本");
    expect(sceneOverview).toContain("01_概念策划/剧本.md");
  });
});

describe("内容树：空文件与半文件", () => {
  test("空的分镜文件与只有标题的分镜文件都报 content-identity-invalid", async () => {
    for (const content of ["", "# 分镜-01：只有标题\n"]) {
      const projectRoot = await createContentProject();
      await seedScene(projectRoot);
      const directory = await seedShot(projectRoot, { segments: [{}] });
      await writeFile(projectRoot, directory + "/分镜-01.md", content);

      // 半文件不能让整棵树抛异常：要么给 content-identity-invalid，要么给别的解析 issue。
      const tree = await buildContentTree(projectRoot);
      expect(codesOf(tree.issues)).toContain("content-identity-invalid");
      expect(tree.issues.length).toBeGreaterThan(0);

      // 单文件解析同样不抛异常，且给出同一类错误。
      const parsed = parseStoryboardDocument(directory + "/分镜-01.md", content);
      expect(codesOf(parsed.issues)).toContain("content-identity-invalid");
      expect(parsed.keyframes).toEqual([]);
    }
  });

  test("缺少「本段正文」小节报 content-identity-invalid", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, { segments: [{ includeBodySection: false }] });

    const tree = await buildContentTree(projectRoot);
    const issues = tree.issues.filter((issue) => issue.code === "content-identity-invalid");
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((issue) => issue.message.includes("本段正文"))).toBe(true);
  });

  test("缺少「关键帧」小节报 content-identity-invalid", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, { segments: [{ includeKeyframeSection: false }] });

    const tree = await buildContentTree(projectRoot);
    const issues = tree.issues.filter((issue) => issue.code === "content-identity-invalid");
    expect(issues.some((issue) => issue.message.includes("关键帧"))).toBe(true);
  });

  test("「视频提示词」小节里没有代码块报 content-identity-invalid", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, { segments: [{ includePromptFence: false }] });

    const tree = await buildContentTree(projectRoot);
    const issues = tree.issues.filter((issue) => issue.code === "content-identity-invalid");
    expect(issues.some((issue) => issue.message.includes("代码块"))).toBe(true);
  });

  test("内容树缺场总览时报 content-tree-incomplete", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, { segments: [{}] });
    await fs.remove(path.join(projectRoot, "内容/场-001/00_场总览.md"));

    const tree = await buildContentTree(projectRoot);
    expect(codesOf(tree.issues)).toContain("content-tree-incomplete");
  });
});

describe("内容树：镜内关键帧编号唯一（J1）", () => {
  test("同镜两个分镜各写关键帧 01：解析层报可读冲突，整理不写争用文件", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, {
      segments: [
        { keyframes: [{ number: 1, mappedSegment: 1 }] },
        { keyframes: [{ number: 1, mappedSegment: 2 }] }
      ]
    });

    // 解析层：指明镜头与涉事分镜。
    const tree = await buildContentTree(projectRoot);
    const duplicates = tree.issues.filter(
      (issue) => issue.code === "invalid-keyframe-mapping" && issue.message.includes("重复使用")
    );
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]!.message).toContain("shot-001");
    expect(duplicates[0]!.message).toContain("分镜-01");
    expect(duplicates[0]!.message).toContain("分镜-02");
    expect(duplicates[0]!.message).toContain("整镜连续");

    // 整理：输出冲突并整份不写，不静默按其中一份渲染写入。
    const result = await assembleContentTree(projectRoot, { force: true });
    const conflicts = result.issues.filter((issue) => issue.message.includes("关键帧声明争用"));
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.path).toBe("04_图片提示词/镜头组-001/镜头-001-关键帧-01.md");
    expect(await fs.pathExists(path.join(projectRoot, "04_图片提示词/镜头组-001/镜头-001-关键帧-01.md"))).toBe(false);
    // 其余文件照常生成。
    expect(await fs.pathExists(path.join(projectRoot, STEP5_FILE))).toBe(true);

    // check 同样给出冲突输出。
    const check = await checkContentConsistency(projectRoot);
    expect(codesOf(check.issues)).toContain("invalid-keyframe-mapping");
    expect(check.issues.map((issue) => issue.message).join("\n")).toContain("关键帧声明争用");
  });

  test("同镜两个分镜关键帧 01／02 连续不重复：整理收敛、verify 回绿", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, {
      segments: [
        { keyframes: [{ number: 1, mappedSegment: 1 }] },
        { keyframes: [{ number: 2, mappedSegment: 2 }] }
      ]
    });

    const first = await assembleContentTree(projectRoot, { force: true });
    expect(first.issues).toEqual([]);
    const second = await assembleContentTree(projectRoot, { force: true });
    expect(second.changes.every((change) => change.kind === "unchanged")).toBe(true);

    const verified = await verify(projectRoot);
    expect(verified.ok).toBe(true);
    expect(verified.issues).toEqual([]);
  });
});

describe("content check 恢复指引（I1）", () => {
  test("手改可复制提示词后 check 的恢复文案提示 --force，裸 assemble --force 能恢复", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, { segments: [{}] });
    await assembleContentTree(projectRoot, { force: true });

    // 手改 05 执行文件：删掉可复制提示词代码块。
    const step5 = await readFile(projectRoot, STEP5_FILE);
    await writeFile(projectRoot, STEP5_FILE, dropCopyableFence(step5));

    const check = await checkContentConsistency(projectRoot);
    const mismatch = check.issues.filter((issue) => issue.code === "content-summary-execution-mismatch");
    expect(mismatch.length).toBeGreaterThan(0);
    expect(mismatch.map((issue) => issue.message).join("\n")).toContain("--force");

    // 按提示用 --force 恢复后 check 干净。
    await assembleContentTree(projectRoot, { force: true });
    const after = await checkContentConsistency(projectRoot);
    expect(after.issues).toEqual([]);
  });

  test("素材状态变化导致执行文件陈旧时，stale 文案提示 --force", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, { segments: [{}] });
    await assembleContentTree(projectRoot, { force: true });

    // assemble 之后登记素材记录：执行文件里的「素材状态」行应更新而尚未刷新。
    await seedHumanNumberedMedia(projectRoot);
    const check = await checkContentConsistency(projectRoot);
    const stale = check.issues.filter((issue) => issue.code === "content-execution-stale");
    expect(stale.length).toBeGreaterThan(0);
    expect(stale.map((issue) => issue.message).join("\n")).toContain("--force");
  });
});

describe("midjourney 平台执行参数口径（J3）", () => {
  const LONG_CHINESE_PROMPT =
    "清晨的雾塔门前，年轻的画师阿岚背着旧画筒停步抬头，冷调自然光从薄雾里漫过来，" +
    "石阶上还留着夜雨冲刷过的水痕，青苔沿着砖缝爬上塔基，她望向塔顶的一线天光，" +
    "衣摆被风轻轻掀起，画筒的背带从肩头滑落半寸，远处檐角挂着的铜铃静默不动，" +
    "画面保持写实电影质感，中景构图，主体位于画面中央偏左，背景塔身轮廓被雾气柔化成灰蓝色层次，" +
    "前景留出湿润的石板路引导视线，情绪安静而克制，像一次迟到的告别，" +
    "光线的方向从右后方逆射，在发丝边缘留出极细的轮廓光，无文字无水印。";

  async function createMidjourneyProject(): Promise<string> {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "avw-content-tree-midjourney-"));
    tempRoots.push(root);
    await createProject({
      targetRoot: root,
      projectName: "midjourney-project",
      pack: "official-ai-video",
      ide: "codex",
      imagePlatform: "midjourney",
      videoPlatform: "seedance"
    });
    const projectRoot = path.join(root, "midjourney-project");
    await syncProject({ repoRoot, projectRoot, ide: "codex", pack: "official-ai-video" });
    return projectRoot;
  }

  test("04 执行文件平台执行参数渲染枚举小写 midjourney，显示名另起一行", async () => {
    const projectRoot = await createMidjourneyProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, { segments: [{ keyframes: [{ number: 1, mappedSegment: 1 }] }] });
    await assembleContentTree(projectRoot, { force: true });

    const step4 = await readFile(projectRoot, "04_图片提示词/镜头组-001/镜头-001-关键帧-01.md");
    expect(step4).toContain("| 图片平台 | midjourney |");
    expect(step4).toContain("| 平台显示名 | Midjourney |");
  });

  test("midjourney 项目 assemble 后 verify 通过（不再报 missing-step4-platform-execution-setting）", async () => {
    const projectRoot = await createMidjourneyProject();
    await seedScene(projectRoot);
    const directory = "内容/场-001/镜头组-001/镜头-001";
    await writeFile(projectRoot, directory + "/00_镜头-001.md", shotOverviewContent("雾塔门前", 1));
    await writeFile(
      projectRoot,
      directory + "/分镜-01.md",
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
        LONG_CHINESE_PROMPT,
        FENCE,
        "",
        FENCE + "text",
        "A young painter stands before the misty tower gate at dawn, looking up, cold natural light, " +
          "cinematic realism, medium shot, wet stone steps, fog softening the tower outline, quiet mood, " +
          "no text, no watermark --v 8.2 --ar 16:9 --style raw --stylize 200",
        FENCE,
        "",
        "## 三、视频提示词片段",
        "",
        FENCE + "text",
        "镜头1：中景正面，阿岚在雾塔门前停步抬头，风声。",
        FENCE,
        ""
      ].join("\n")
    );

    const result = await assembleContentTree(projectRoot, { force: true });
    expect(result.issues).toEqual([]);

    const verified = await verify(projectRoot);
    expect(codesOf(verified.issues)).not.toContain("missing-step4-platform-execution-setting");
    expect(verified.issues).toEqual([]);
    expect(verified.ok).toBe(true);
  });

  test("gpt-image-2 平台的平台执行参数渲染不受影响", async () => {
    const projectRoot = await createContentProject();
    await seedScene(projectRoot);
    await seedShot(projectRoot, { segments: [{ keyframes: [{ number: 1, mappedSegment: 1 }] }] });
    await assembleContentTree(projectRoot, { force: true });

    const step4 = await readFile(projectRoot, "04_图片提示词/镜头组-001/镜头-001-关键帧-01.md");
    expect(step4).toContain("| 图片平台 | GPT Image 2（LibTV） |");
    expect(step4).toContain("gpt-image-2");
    expect(step4).not.toContain("midjourney");
  });
});
