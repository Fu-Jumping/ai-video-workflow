
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { assembleContentTree } from "../src/lib/content-assemble.js";
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
