import fs from "fs-extra";
import path from "node:path";

import {
  CONTENT_FORMAT_VERSION,
  CONTENT_ROOT_DIRECTORY,
  MIGRATED_SNAPSHOT_DIRECTORY,
  STEP_DIR_BY_NUMBER
} from "./constants.js";
import {
  buildContentTree,
  getContentBlockBody,
  parseContentBlocks,
  renderAutoBlock,
  renderManualBlock,
  resolveContentMode
} from "./content-tree.js";
import { assembleContentTree, sceneOverviewSkeleton } from "./content-assemble.js";
import { buildShotGraph } from "./shot-graph.js";
import { readProjectConfig } from "./project-config.js";
import type { VerificationIssue } from "./types.js";

/** 代码块围栏（三反引号）。 */
const F = "```";

/* ------------------------------ 类型 ------------------------------ */

export type MigrationAction = "create" | "merge" | "conflict";

export interface MigrationPreviewEntry {
  /** 旧文件相对路径（相对项目根）。 */
  sourceRelPath: string;
  /** 迁移后写入的相对路径。 */
  targetRelPath: string;
  action: MigrationAction;
  /** 冲突或需要人看一眼时的说明。 */
  reason?: string;
  /** 只读快照的相对路径。 */
  snapshotRelPath: string;
}

export interface MigrationPreview {
  projectRoot: string;
  /** 旧格式（legacy）才允许迁移；其余状态直接给出原因。 */
  canApply: boolean;
  entries: MigrationPreviewEntry[];
  issues: VerificationIssue[];
}

export interface MigrationApplyResult {
  ok: boolean;
  summary: string;
  written: string[];
  issues: VerificationIssue[];
}

/* ------------------------------ 工具 ------------------------------ */

function snapshotRelPath(sourceRelPath: string): string {
  return path.posix.join(MIGRATED_SNAPSHOT_DIRECTORY, sourceRelPath.split(path.sep).join("/"));
}

function normalizeRelPath(relPath: string): string {
  return relPath.split(path.sep).join("/");
}

function sceneDirectoryForLegacy(): string {
  return "场-001";
}

function shotDirectoryRelPath(groupDirectoryName: string, shotDirectoryName: string): string {
  return path.posix.join("内容", sceneDirectoryForLegacy(), groupDirectoryName, shotDirectoryName);
}

function stripTrailingNewlines(value: string): string {
  return value.replace(/\n+$/u, "");
}

/** 从旧 03 镜头文件里切出各分镜正文。 */
export function legacyStoryboardSegments(content: string): Array<{ number: number; text: string }> {
  const segments: Array<{ number: number; text: string }> = [];
  const pattern = /^###\s*分镜\s*([0-9]+)\s*$/gmu;
  const matches = [...content.matchAll(pattern)];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const number = Number.parseInt(match[1] ?? "", 10);
    if (!Number.isFinite(number)) continue;
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? content.length) : content.length;
    const raw = content.slice(start, end);
    const trimmed = stripTrailingNewlines(raw).replace(/^\n+/u, "");
    segments.push({ number, text: trimAtSectionEnd(trimmed) });
  }
  return segments;
}

/** 分镜正文到下一个二级标题为止。 */
function trimAtSectionEnd(value: string): string {
  const match = /^##\s+/mu.exec(value);
  return match && match.index !== undefined ? stripTrailingNewlines(value.slice(0, match.index)) : value;
}

/** 从旧 04 文件里取关键帧对应分镜号。 */
export function legacyKeyframeSegment(content: string): number | null {
  const match = /对应分镜\s*[：:]\s*(?:分镜\s*)?([0-9]+)/u.exec(content);
  return match ? Number.parseInt(match[1] ?? "", 10) : null;
}

/**
 * 从旧 04 文件名里取关键帧编号：`镜头-015-关键帧-02.md` → 2。
 *
 * 旧项目的关键帧编号在镜头内全局唯一（跨分镜连续），迁移必须原样保留；
 * 若按分镜重排成各分镜的「01」，同一镜头的两个分镜会各写一张「关键帧 01」，
 * 04 执行文件路径互相争用（J1）。取不到编号时回退 1。
 */
export function legacyKeyframeNumber(fileName: string): number {
  const match = /关键帧[-_ ]?(\d+)/iu.exec(path.basename(fileName));
  const number = match ? Number.parseInt(match[1] ?? "", 10) : NaN;
  return Number.isFinite(number) && number > 0 ? number : 1;
}

/** 从旧 04 文件里取「关键时刻」。 */
export function legacyKeyframeMoment(content: string): string | null {
  const match = /关键时刻\s*[：:]\s*(.+)$/mu.exec(content);
  return match ? (match[1] ?? "").trim() : null;
}

/** 取第一个代码块。 */
export function legacyFencedBlock(content: string): string | null {
  const pattern = new RegExp("\u0060{3,}[^\\n]*\\n([\\s\\S]*?)\u0060{3,}", "u");
  const match = pattern.exec(content);
  return match ? stripTrailingNewlines(match[1] ?? "") : null;
}

/**
 * 把整镜视频提示词拆成三段：镜头段之前的公共说明（前段）、各「镜头N：」片段、最后一段之后的收束段（后段）。
 *
 * 迁移要求整镜正文完整：前段与后段是镜头级公共内容，落在镜头汇总的人工区块里，
 * 镜头段则按顺序拼装。三者合起来必须与旧 05 的可复制提示词逐字一致。
 */
export function splitLegacyVideoPromptParts(content: string): {
  before: string;
  segments: Array<{ number: number; text: string }>;
  after: string;
} {
  const segments = splitLegacyVideoPrompt(content);
  if (segments.length === 0) return { before: content.trim(), segments, after: "" };
  const pattern = /^镜头\s*([0-9]+)\s*[：:]/gmu;
  const matches = [...content.matchAll(pattern)];
  const firstIndex = matches[0]?.index ?? 0;
  const lastMatch = matches[matches.length - 1];
  const lastStart = lastMatch?.index ?? 0;
  const lastEnd = lastStart + (lastMatch?.[0].length ?? 0);
  const lastSegmentText = content.slice(lastStart);
  const trailingBreak = /\n\s*\n/u.exec(lastSegmentText);
  let after = "";
  if (trailingBreak) {
    after = lastSegmentText.slice((trailingBreak.index ?? 0) + trailingBreak[0].length).trim();
  }
  const segmentEnd = after ? content.length - after.length : content.length;
  const before = content.slice(0, firstIndex).trim();
  // 重新按边界切一次，保证 before/segments/after 三者拼接等于原文。
  const rebuilt: Array<{ number: number; text: string }> = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const number = Number.parseInt(match[1] ?? "", 10);
    if (!Number.isFinite(number)) continue;
    const start = match.index ?? 0;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? content.length) : segmentEnd;
    rebuilt.push({ number, text: stripTrailingNewlines(content.slice(start, end)) });
  }
  void lastEnd;
  return { before, segments: rebuilt, after };
}

/** 把整镜视频提示词拆成「镜头N：」片段。 */
export function splitLegacyVideoPrompt(content: string): Array<{ number: number; text: string }> {
  const pattern = /^镜头\s*([0-9]+)\s*[：:]/gmu;
  const matches = [...content.matchAll(pattern)];
  const segments: Array<{ number: number; text: string }> = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const number = Number.parseInt(match[1] ?? "", 10);
    if (!Number.isFinite(number)) continue;
    const start = match.index ?? 0;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? content.length) : content.length;
    segments.push({ number, text: stripTrailingNewlines(content.slice(start, end)) });
  }
  return segments;
}

/* ------------------------------ 预览 ------------------------------ */

/**
 * 扫描旧 03/04/05，逐文件给出迁移计划。不写任何文件。
 */
export async function buildMigrationPreview(projectRoot: string): Promise<MigrationPreview> {
  const issues: VerificationIssue[] = [];
  const entries: MigrationPreviewEntry[] = [];

  const resolution = await resolveContentMode(projectRoot);
  if (resolution.mode === "content-tree") {
    issues.push({
      code: "content-legacy-and-tree-coexist",
      message:
        "这个项目已经声明内容树格式（content.format_version = " +
        String(resolution.version ?? CONTENT_FORMAT_VERSION) +
        "），不需要再迁移；如需重来，请先人工确认内容树与旧目录的取舍。",
      path: "project.config.yaml"
    });
    return { projectRoot, canApply: false, entries, issues };
  }
  if (resolution.issues.length > 0) {
    return { projectRoot, canApply: false, entries, issues: resolution.issues };
  }

  const graph = await buildShotGraph(projectRoot);
  // 判定「有没有可迁移内容」必须看镜头数，不能看文件数：新建项目自带 03/04/05 的空白模板，
  // 文件数永远大于 0，但模板里没有镜头编号，拆不出任何镜头。
  if (graph.shots.length === 0) {
    issues.push({
      code: "content-tree-missing",
      message: "没有找到任何旧格式镜头文件（03/04/05 里只有空白模板），也没有内容树；没有可迁移的内容。",
      path: STEP_DIR_BY_NUMBER[3]
    });
    return { projectRoot, canApply: false, entries, issues };
  }

  const shotsById = new Map(graph.shots.map((shot) => [shot.id, shot]));

  for (const shot of graph.shots) {
    const groupDirectoryName = shot.groupId
      ? graph.groups.find((group) => group.id === shot.groupId)?.directoryName ?? "镜头组-001"
      : "镜头组-001";
    const shotDirectoryName = `镜头-${String(shot.files.find((file) => file.step === 3)?.fileName.match(/(\d+)/u)?.[1] ?? shot.id.replace(/[^0-9]/gu, "")).padStart(3, "0")}`;
    const targetDirectory = shotDirectoryRelPath(groupDirectoryName, shotDirectoryName);
    const legacyShotFile = shot.files.find((file) => file.step === 3);
    const targetShotRelPath = path.posix.join(targetDirectory, `00_${shotDirectoryName}.md`);

    if (legacyShotFile) {
      entries.push({
        sourceRelPath: normalizeRelPath(legacyShotFile.relPath),
        targetRelPath: targetShotRelPath,
        action: "create",
        reason: "镜头正文拆成「镜头汇总」与各「单分镜」文件",
        snapshotRelPath: snapshotRelPath(normalizeRelPath(legacyShotFile.relPath))
      });
      for (const segment of shot.storyboardSegments) {
        entries.push({
          sourceRelPath: normalizeRelPath(legacyShotFile.relPath),
          targetRelPath: path.posix.join(targetDirectory, `分镜-${String(segment).padStart(2, "0")}.md`),
          action: "create",
          reason: `旧文件里的「### 分镜 ${segment}」拆成独立文件`,
          snapshotRelPath: snapshotRelPath(normalizeRelPath(legacyShotFile.relPath))
        });
      }
    }

    for (const imageFile of shot.imagePrompts) {
      const mapped = legacyKeyframeSegment(imageFile.content);
      const target =
        mapped === null
          ? path.posix.join(targetDirectory, "分镜-01.md")
          : path.posix.join(targetDirectory, `分镜-${String(mapped).padStart(2, "0")}.md`);
      entries.push({
        sourceRelPath: normalizeRelPath(imageFile.relPath),
        targetRelPath: target,
        action: mapped === null ? "conflict" : "merge",
        reason:
          mapped === null
            ? "旧图片提示词没有写「对应分镜」，无法判断该并入哪一段，需要人工指定"
            : `并入分镜 ${mapped} 的「关键帧」部分；这个旧路径之后会放按内容树重新生成的 04 执行文件，原文完整保留在「已迁移」快照里`,
        snapshotRelPath: snapshotRelPath(normalizeRelPath(imageFile.relPath))
      });
    }

    const videoFile = shot.files.find((file) => file.step === 5);
    if (videoFile) {
      entries.push({
        sourceRelPath: normalizeRelPath(videoFile.relPath),
        targetRelPath: targetShotRelPath,
        action: "merge",
        reason:
          "整镜视频提示词并入「镜头汇总」的完整视频提示词，并按镜头段拆到各分镜；这个旧路径之后会放按内容树重新生成的 05 执行文件，原文完整保留在「已迁移」快照里",
        snapshotRelPath: snapshotRelPath(normalizeRelPath(videoFile.relPath))
      });
    }
  }

  const seen = new Set<string>();
  for (const entry of entries) {
    const key = entry.sourceRelPath + "->" + entry.targetRelPath;
    if (seen.has(key)) continue;
    seen.add(key);
  }

  if (entries.some((entry) => entry.action === "conflict")) {
    issues.push({
      code: "content-identity-invalid",
      message: "有旧文件无法自动判断归属（见标记为 conflict 的行），需要人工处理后再迁移。",
      path: STEP_DIR_BY_NUMBER[4]
    });
  }

  void shotsById;
  return { projectRoot, canApply: true, entries, issues };
}

/** 预览的可读输出（命令行直接打印）。 */
export function renderMigrationPreview(preview: MigrationPreview): string {
  const lines: string[] = [];
  lines.push("迁移预览（未写入任何文件）");
  if (preview.entries.length === 0) {
    lines.push("  没有可迁移的旧文件。");
  } else {
    const counts = { create: 0, merge: 0, conflict: 0 };
    for (const entry of preview.entries) counts[entry.action] += 1;
    lines.push(
      "  共 " +
        String(preview.entries.length) +
        " 条：新建 " +
        String(counts.create) +
        "，合并 " +
        String(counts.merge) +
        "，冲突 " +
        String(counts.conflict) +
        "。"
    );
    lines.push("");
    for (const entry of preview.entries) {
      lines.push(`  [${entry.action}] ${entry.sourceRelPath}`);
      lines.push(`         -> ${entry.targetRelPath}`);
      if (entry.reason) lines.push(`            ${entry.reason}`);
      lines.push(`        旧文件另存为只读快照：${entry.snapshotRelPath}`);
    }
  }
  if (preview.issues.length > 0) {
    lines.push("");
    lines.push("  需要注意：");
    for (const issue of preview.issues) lines.push(`  ! [${issue.code}] ${issue.message}`);
  }
  lines.push("");
  lines.push(
    preview.canApply
      ? "确认无误后加 --apply --yes 才会真正写入；旧文件不会被删除，只会在「" + MIGRATED_SNAPSHOT_DIRECTORY + "」里多一份只读快照。"
      : "当前状态不能直接迁移，先处理上面的提示。"
  );
  return lines.join("\n");
}

/* ------------------------------ 执行 ------------------------------ */

/** 快照首行：标注迁移日期与原路径，读的人一眼知道它从哪来、还算不算数。 */
function snapshotBanner(sourceRelPath: string, today: string): string {
  return "> 已迁移：本文件是 " + today + " 从 " + sourceRelPath + " 迁移的只读快照，不再参与当前检查。\n\n";
}

/** 保留在原位的旧 03 正文原件首行标注：和快照首行同一句式，只把「快照」换成「原件」。 */
const KEPT_LEGACY_BANNER_PREFIX = "> 已迁移：";

function keptLegacyBanner(today: string): string {
  return (
    KEPT_LEGACY_BANNER_PREFIX +
    "本文件是 " +
    today +
    " 迁移到「" +
    CONTENT_ROOT_DIRECTORY +
    "/」时保留在原位的旧正文原件，非当前正文，正文以「" +
    CONTENT_ROOT_DIRECTORY +
    "/」为准，不再参与当前检查。\n\n"
  );
}

/** 同一天里重跑迁移时的冲突后缀：.conflict-1、.conflict-2 … */
async function conflictSnapshotRelPath(projectRoot: string, snapshotRelPath: string): Promise<string> {
  for (let index = 1; index < 100; index += 1) {
    const candidate = snapshotRelPath + ".conflict-" + String(index);
    if (!(await fs.pathExists(path.join(projectRoot, candidate)))) return candidate;
  }
  return snapshotRelPath + ".conflict-" + String(Date.now());
}

async function writeSnapshot(projectRoot: string, entry: MigrationPreviewEntry): Promise<string | null> {
  const sourceAbs = path.join(projectRoot, entry.sourceRelPath);
  if (!(await fs.pathExists(sourceAbs))) return null;
  const original = await fs.readFile(sourceAbs, "utf8");
  const banner = snapshotBanner(entry.sourceRelPath, new Date().toISOString().slice(0, 10));
  const next = banner + original;

  let targetRelPath = entry.snapshotRelPath;
  const existingAbs = path.join(projectRoot, targetRelPath);
  if (await fs.pathExists(existingAbs)) {
    const existing = await fs.readFile(existingAbs, "utf8");
    // 已有一模一样的快照就不重复写；内容不同则另存，绝不覆盖已有快照。
    if (existing === next) return null;
    targetRelPath = await conflictSnapshotRelPath(projectRoot, entry.snapshotRelPath);
  }

  const targetAbs = path.join(projectRoot, targetRelPath);
  await fs.ensureDir(path.dirname(targetAbs));
  await fs.writeFile(targetAbs, next, "utf8");
  return targetRelPath;
}

/**
 * 旧 03 正文原件留在原位时补一行标注。
 *
 * 03 在迁移后不再被生成器覆盖，原件就停在原位；不标注的话，读的人分不清它和「内容/」里
 * 哪一份算数。04／05 的原件位置会被按内容树重新生成的执行文件占用，没有「原位旧正文」这回事，
 * 所以只处理 03。已经有标注的跳过，重跑迁移不会叠加。
 */
async function markKeptLegacyOriginals(projectRoot: string, preview: MigrationPreview): Promise<string[]> {
  const marked: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set<string>();
  for (const entry of preview.entries) {
    const relPath = normalizeRelPath(entry.sourceRelPath);
    if (seen.has(relPath)) continue;
    seen.add(relPath);
    if (relPath.split("/")[0] !== STEP_DIR_BY_NUMBER[3]) continue;
    const absPath = path.join(projectRoot, relPath);
    if (!(await fs.pathExists(absPath))) continue;
    const original = await fs.readFile(absPath, "utf8");
    if (original.startsWith(KEPT_LEGACY_BANNER_PREFIX)) continue;
    await fs.writeFile(absPath, keptLegacyBanner(today) + original, "utf8");
    marked.push(relPath);
  }
  return marked;
}

/** 旧镜头文件 H1 冒号后面的展示名，例如「# 镜头 001：清晨前的邀请」→「清晨前的邀请」。 */
function legacyShotTitle(content: string): string | null {
  const heading = content.split(/\r?\n/u).find((line) => /^#\s+\S/u.test(line));
  if (!heading) return null;
  const text = heading.replace(/^#\s+/u, "").trim();
  const matched = /[：:]/u.exec(text);
  if (!matched) return null;
  const name = text.slice(matched.index + 1).trim();
  return name.length > 0 ? name : null;
}

/** 旧镜头文件里写的目标时长，例如「- 目标时长：15 秒」→「15秒」。 */
function legacyTargetDuration(content: string): string | null {
  const matched = /(?:目标时长|计划时长)\s*[：:]\s*([0-9]+\s*(?:秒|s))/u.exec(content);
  return matched ? matched[1].replace(/\s+/gu, "") : null;
}

function storyboardFileContent(number: number, segmentText: string, keyframeSection: string, shotFileName: string): string {
  const padded = String(number).padStart(2, "0");
  return [
    `# 分镜-${padded}`,
    "",
    `> 所属镜头：[${shotFileName}](${shotFileName}) ｜ 顺序：第 ${String(number)} 段`,
    "",
    "## 一、本段画面与动作",
    "",
    segmentText.trim(),
    "",
    "## 二、本段关键帧",
    "",
    keyframeSection.trim(),
    "",
    "## 三、视频提示词",
    "",
    `${F}text`,
    "",
    `${F}`,
    ""
  ].join("\n");
}

async function setContentFormatVersion(projectRoot: string): Promise<void> {
  const configPath = path.join(projectRoot, "project.config.yaml");
  if (!(await fs.pathExists(configPath))) return;
  const raw = await fs.readFile(configPath, "utf8");
  const lines = raw.split(/\r?\n/u);
  const contentIndex = lines.findIndex((line) => /^content\s*:/u.test(line));
  if (contentIndex >= 0) {
    let insertAt = contentIndex + 1;
    while (insertAt < lines.length && /^\s+\S/u.test(lines[insertAt] ?? "")) insertAt += 1;
    lines.splice(insertAt, 0, `  format_version: ${String(CONTENT_FORMAT_VERSION)}`);
  } else {
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    lines.push("content:", `  format_version: ${String(CONTENT_FORMAT_VERSION)}`, "");
  }
  await fs.writeFile(configPath, lines.join("\n"), "utf8");
}

/**
 * 按预览写入迁移结果。
 *
 * 顺序：先建内容树 → 再写只读快照 → 最后才改 format_version。
 */
export async function applyMigration(projectRoot: string, preview: MigrationPreview): Promise<MigrationApplyResult> {
  const written: string[] = [];
  const issues: VerificationIssue[] = [];
  if (!preview.canApply) {
    return { ok: false, summary: "预览不允许迁移，未写入任何文件。", written, issues: preview.issues };
  }

  const graph = await buildShotGraph(projectRoot);
  for (const shot of graph.shots) {
    const groupDirectoryName = shot.groupId
      ? graph.groups.find((group) => group.id === shot.groupId)?.directoryName ?? "镜头组-001"
      : "镜头组-001";
    const numeric = shot.files.find((file) => file.step === 3)?.fileName.match(/(\d+)/u)?.[1] ?? shot.id.replace(/[^0-9]/gu, "");
    const shotDirectoryName = `镜头-${numeric.padStart(3, "0")}`;
    const targetDirectory = shotDirectoryRelPath(groupDirectoryName, shotDirectoryName);
    const absDirectory = path.join(projectRoot, targetDirectory);
    await fs.ensureDir(absDirectory);

    const legacyShotFile = shot.files.find((file) => file.step === 3);
    const segments = legacyShotFile ? legacyStoryboardSegments(legacyShotFile.content) : [];
    const segmentTexts = new Map(segments.map((segment) => [segment.number, segment.text]));

    const videoFile = shot.files.find((file) => file.step === 5);
    const videoCopyable = videoFile ? legacyFencedBlock(videoFile.content) : null;
    const videoParts = videoCopyable ? splitLegacyVideoPromptParts(videoCopyable) : { before: "", segments: [], after: "" };
    const videoByNumber = new Map(videoParts.segments.map((segment) => [segment.number, segment.text]));
    // 旧 05 里没有按「镜头N：」分段时，整段正文就是这一镜的完整视频提示词：
    // 不能丢，否则镜头汇总与 05 执行文件会缺正文。
    const wholeVideoPrompt = videoCopyable && videoParts.segments.length === 0 ? videoCopyable.trim() : "";

    for (const number of shot.storyboardSegments) {
      // 同一分镜可能挂多张关键帧：全部迁入并按旧编号排序（不再只取第一张）。
      const keyframeFiles = shot.imagePrompts
        .filter((file) => legacyKeyframeSegment(file.content) === number)
        .sort((a, b) => legacyKeyframeNumber(a.fileName) - legacyKeyframeNumber(b.fileName));
      const keyframeSection =
        keyframeFiles.length > 0
          ? keyframeFiles
              .map((keyframeFile) =>
                [
                  // 关键帧用四级标题：三级会和「## 二、本段关键帧」一起被当成小节边界，```关键帧区块就取不到内容。
                  // 编号沿用旧 04 文件名里的编号（整镜唯一、跨分镜不重启），不按分镜重排。
                  `#### 关键帧 ${String(legacyKeyframeNumber(keyframeFile.fileName)).padStart(2, "0")}`,
                  "",
                  `- 对应分镜：分镜 ${String(number)}`,
                  `- 关键时刻：${legacyKeyframeMoment(keyframeFile.content) ?? "（迁移时未标注）"}`,
                  "",
                  `${F}text`,
                  legacyFencedBlock(keyframeFile.content) ?? "（旧文件里没有可复制的提示词，需要补写）",
                  `${F}`,
                  ""
                ].join("\n")
              )
              .join("\n")
          : "本段没有单独关键帧。\n";
      const body = storyboardFileContent(
        number,
        segmentTexts.get(number) ?? "（旧文件里没有这一段正文，需要补写）",
        keyframeSection,
        `00_${shotDirectoryName}.md`
      );
      const segmentPrompt = videoByNumber.get(number) ?? "";
      const withPrompt = body.replace(
        /## 三、视频提示词\n\n```text\n\n```/u,
        "## 三、视频提示词\n\n" + F + "text\n" + segmentPrompt + "\n" + F
      );
      const relPath = path.posix.join(targetDirectory, `分镜-${String(number).padStart(2, "0")}.md`);
      await fs.writeFile(path.join(projectRoot, relPath), withPrompt, "utf8");
      written.push(relPath);
    }

    // 镜头级公共内容（素材绑定、总体任务、收束段）落在人工区块里；镜头段交给整理自动拼装。
    // 旧 05 没有「镜头N：」分段时，把整段正文放进前段，保证整镜正文不丢。
    const manualBefore =
      wholeVideoPrompt ||
      videoParts.before ||
      "（整镜公共说明，例如素材绑定与总体任务；整理时不会覆盖这里。）";
    const manualSegments =
      wholeVideoPrompt || videoParts.segments.length === 0
        ? "（整理后会自动填入按顺序拼装的各镜头段）"
        : videoParts.segments.map((segment) => segment.text).join("\n\n");
    const manualAfter =
      wholeVideoPrompt || !videoParts.after ? "（整镜收束段，例如「无配乐、无字幕」；整理时不会覆盖这里。）" : videoParts.after;

    const shotRelPath = path.posix.join(targetDirectory, `00_${shotDirectoryName}.md`);
    // 展示名与目标时长从旧文件带过来：总表与 04／05 执行文件都要用，丢了就只能显示编号和「—」。
    const legacyContent = legacyShotFile?.content ?? "";
    const shotTitle = legacyShotTitle(legacyContent) ?? shot.storyboard?.[0]?.title ?? "";
    const shotDuration = legacyTargetDuration(legacyContent);
    const shotContent = [
      `# 镜头 ${numeric}：${shotTitle}`.replace(/：$/u, ""),
      "",
      `> 所属场与组：${sceneDirectoryForLegacy()} ｜ ${groupDirectoryName}`,
      "",
      ...(shotDuration ? ["- 目标时长：" + shotDuration, ""] : []),
      renderAutoBlock("分镜速览", "| 顺序 | 分镜 | 动作与拍法（一句话） | 打开 |\n| --- | --- | --- | --- |"),
      "",
      renderAutoBlock("图片提示词", "（整理后会自动填入各分镜的关键帧提示词）"),
      "",
      renderManualBlock("视频提示词前段", manualBefore),
      "",
      renderAutoBlock("镜头段拼装", manualSegments),
      "",
      renderManualBlock("视频提示词后段", manualAfter),
      ""
    ].join("\n");
    await fs.writeFile(path.join(projectRoot, shotRelPath), shotContent, "utf8");
    written.push(shotRelPath);

    const groupOverviewRelPath = path.posix.join("内容", sceneDirectoryForLegacy(), groupDirectoryName, "00_镜头组总览.md");
    if (!(await fs.pathExists(path.join(projectRoot, groupOverviewRelPath)))) {
      await fs.ensureDir(path.dirname(path.join(projectRoot, groupOverviewRelPath)));
      await fs.writeFile(
        path.join(projectRoot, groupOverviewRelPath),
        ["# " + groupDirectoryName + " 镜头组总览", "", "## 这一组讲什么", "", "（写这一组在故事里的位置与作用。）", "", renderAutoBlock("组镜头表", "| 顺序 | 镜头 | 内容 | 分镜数 | 打开 |\n| --- | --- | --- | --- | --- |"), ""].join("\n"),
        "utf8"
      );
      written.push(groupOverviewRelPath);
    }
  }

  const sceneOverviewRelPath = path.posix.join("内容", sceneDirectoryForLegacy(), "00_场总览.md");
  if (!(await fs.pathExists(path.join(projectRoot, sceneOverviewRelPath)))) {
    await fs.ensureDir(path.dirname(path.join(projectRoot, sceneOverviewRelPath)));
    // 与 content assemble 共用同一份场总览骨架：标题「场-001 场总览」带「对应剧本」小节，
    // 迁移项目与新建项目符合同一份内容树契约。
    await fs.writeFile(path.join(projectRoot, sceneOverviewRelPath), sceneOverviewSkeleton("scene-001"), "utf8");
    written.push(sceneOverviewRelPath);
  }

  for (const entry of preview.entries) {
    const writtenSnapshot = await writeSnapshot(projectRoot, entry);
    if (writtenSnapshot !== null && !written.includes(writtenSnapshot)) written.push(writtenSnapshot);
  }

  await setContentFormatVersion(projectRoot);
  written.push("project.config.yaml");

  // 旧 03／04／05 原件已在「已迁移/」留了只读快照，所以这里可以直接重建执行文件：
  // force 只影响自动区块与整份生成文件，人工区块（视频提示词前段／后段）不会被覆盖；
  // 被覆盖的旧文件在写入前会备份到 .tmp/content-backup/。
  const assembled = await assembleContentTree(projectRoot, { force: true });
  for (const change of assembled.changes) {
    if (change.kind !== "unchanged" && !written.includes(change.relPath)) written.push(change.relPath);
  }
  issues.push(...assembled.issues);

  // 03 原件既不被生成器覆盖、也不该被悄悄删掉：给它加一行标注，说明它不是当前正文。
  const markedOriginals = await markKeptLegacyOriginals(projectRoot, preview);

  const { config } = await readProjectConfig(projectRoot);
  const version = config?.content?.format_version ?? null;
  if (version !== CONTENT_FORMAT_VERSION) {
    issues.push({
      code: "unsupported-content-format",
      message: "迁移后 project.config.yaml 的 content.format_version 没有写成 " + String(CONTENT_FORMAT_VERSION) + "，请人工确认。",
      path: "project.config.yaml"
    });
  }

  const tree = await buildContentTree(projectRoot);
  issues.push(...tree.issues);

  const summaryLines = [
    "迁移完成",
    "  写入 " + String(written.length) + " 个文件；旧文件没有删除，已另存为「" + MIGRATED_SNAPSHOT_DIRECTORY + "」下的只读快照。",
    "  已按内容树重新整理总表与 04/05 执行文件。"
  ];
  if (markedOriginals.length > 0) {
    summaryLines.push(
      "  已给 " +
        String(markedOriginals.length) +
        " 个留在原位的旧 " +
        STEP_DIR_BY_NUMBER[3] +
        " 正文原件加上「已迁移」标注：" +
        markedOriginals.join("、")
    );
  }
  if (issues.length > 0) {
    summaryLines.push("  需要注意 " + String(issues.length) + " 条：");
    for (const issue of issues) summaryLines.push("  ! [" + issue.code + "] " + issue.message);
  }

  return { ok: issues.every((issue) => issue.code !== "content-tree-incomplete"), summary: summaryLines.join("\n"), written, issues };
}

void getContentBlockBody;
void parseContentBlocks;
