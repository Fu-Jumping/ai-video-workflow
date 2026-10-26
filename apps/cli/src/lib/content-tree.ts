import fs from "fs-extra";
import path from "node:path";

import {
  CONTENT_ROOT_DIRECTORY,
  CONTENT_SHOT_OVERVIEW_FILE,
  CONTENT_STORYBOARD_OVERVIEW_FILE,
  MAX_KEYFRAMES_PER_SHOT,
  MAX_STORYBOARD_SEGMENTS,
  MIGRATED_SNAPSHOT_DIRECTORY,
  SCENE_DIRECTORY_PREFIX,
  SCENE_OVERVIEW_FILE,
  SHOT_DIRECTORY_PREFIX,
  SHOT_GROUP_DIRECTORY_PREFIX,
  SHOT_GROUP_OVERVIEW_FILE,
  STORYBOARD_FILE_PREFIX
} from "./constants.js";
import { contentFormatVersion, isSupportedContentFormatVersion, readProjectConfig } from "./project-config.js";
import type { ContentMode, VerificationIssue } from "./types.js";

/* ------------------------------------------------------------------ *
 * 内容树：稳定身份、区块标记、单分镜与镜头文件解析、整镜正文拼装
 * ------------------------------------------------------------------ */

/** 内容树读取模式判定结果。所有读取方只走这一个入口，不自行判断格式。 */
export interface ContentModeResolution {
  mode: ContentMode;
  version: number | null;
  contentRoot: string;
  contentRootExists: boolean;
  issues: VerificationIssue[];
}

function padNumber(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}

/* ------------------------------ 稳定身份 ------------------------------ */

const SCENE_DIRECTORY_PATTERN = /^场[-_ ]?(\d{1,4})$/u;
const SHOT_GROUP_DIRECTORY_PATTERN = /^镜头组[-_ ]?(\d{1,4})$/u;
const SHOT_DIRECTORY_PATTERN = /^镜头[-_ ]?(\d{1,4})$/u;
const STORYBOARD_FILE_PATTERN = /^分镜[-_ ]?(\d{1,3})\.md$/u;
const KEYFRAME_HEADING_PATTERN = /^#{2,5}\s*关键帧\s*0*(\d{1,3})\s*$/u;

/** 场-001 → scene-001；不匹配返回 null。 */
export function sceneIdFromDirectory(name: string): string | null {
  const matched = SCENE_DIRECTORY_PATTERN.exec(name.trim());
  if (!matched) return null;
  return `scene-${padNumber(Number(matched[1]), 3)}`;
}

/** 镜头组-001 → group-001；不匹配返回 null。 */
export function shotGroupIdFromDirectory(name: string): string | null {
  const matched = SHOT_GROUP_DIRECTORY_PATTERN.exec(name.trim());
  if (!matched) return null;
  return `group-${padNumber(Number(matched[1]), 3)}`;
}

/** 镜头-001 → shot-001；不匹配返回 null。 */
export function shotIdFromDirectory(name: string): string | null {
  const matched = SHOT_DIRECTORY_PATTERN.exec(name.trim());
  if (!matched) return null;
  return `shot-${padNumber(Number(matched[1]), 3)}`;
}

/** 分镜-01.md → storyboard-01；不匹配返回 null。 */
export function storyboardIdFromFileName(fileName: string): string | null {
  const matched = STORYBOARD_FILE_PATTERN.exec(fileName.trim());
  if (!matched) return null;
  return `storyboard-${padNumber(Number(matched[1]), 2)}`;
}

export function sceneDirectoryName(sceneId: string): string {
  return SCENE_DIRECTORY_PREFIX + sceneId.replace(/^scene-/u, "");
}

export function shotGroupDirectoryName(groupId: string): string {
  return SHOT_GROUP_DIRECTORY_PREFIX + groupId.replace(/^group-/u, "");
}

export function shotDirectoryName(shotId: string): string {
  return SHOT_DIRECTORY_PREFIX + shotId.replace(/^shot-/u, "");
}

export function storyboardFileName(storyboardId: string): string {
  return STORYBOARD_FILE_PREFIX + storyboardId.replace(/^storyboard-/u, "") + ".md";
}

/** 编号部分转数字：shot-001 → 1；无法解析返回 null。 */
export function idNumber(id: string): number | null {
  const matched = /(\d+)$/u.exec(id);
  return matched ? Number(matched[1]) : null;
}

/** 取 H1 标题冒号后的展示名；没有冒号时取标题全文。展示名可改，不影响身份。 */
export function displayNameFromTitle(titleLine: string | null): string | null {
  if (!titleLine) return null;
  const text = titleLine.replace(/^#\s*/u, "").trim();
  if (text.length === 0) return null;
  const separatorIndex = text.search(/[：:]/u);
  const name = separatorIndex >= 0 ? text.slice(separatorIndex + 1) : text;
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function firstHeading(content: string): string | null {
  // 行尾可带 \r（整文件 CRLF 的文件，J9）；标题内容本身不含行终止符。
  const matched = /^#\s+[^\r\n]+\r?$/mu.exec(content);
  return matched ? matched[0].replace(/\r$/u, "") : null;
}

/* ------------------------------ 区块标记 ------------------------------ */

export type ContentBlockKind = "auto" | "manual";

export interface ContentBlock {
  kind: ContentBlockKind;
  name: string;
  /** 开始标记行在原文中的起始下标。 */
  start: number;
  /** 结束标记行的结束下标。 */
  end: number;
  /** 区块内部正文（不含标记行）。 */
  body: string;
}

const BLOCK_START_PATTERN = /^<!--\s*avw:(auto|manual):start\s+name=(.+?)\s*-->\s*$/u;
const BLOCK_END_PATTERN = /^<!--\s*avw:(auto|manual):end\s+name=(.+?)\s*-->\s*$/u;

export interface ContentBlockParseResult {
  blocks: ContentBlock[];
  issues: VerificationIssue[];
}

/**
 * 解析自动／人工区块标记。
 *
 * 标记必须成对、同名、按出现顺序闭合；自动区块内部不得再嵌标记。
 * 标记缺失或不成对时报 content-block-marker-invalid，刷新时拒绝写入。
 */
export function parseContentBlocks(content: string, relPath: string): ContentBlockParseResult {
  const blocks: ContentBlock[] = [];
  const issues: VerificationIssue[] = [];
  const openStack: Array<{ kind: ContentBlockKind; name: string; startIndex: number; bodyStart: number }> = [];

  let cursor = 0;
  for (const line of content.split("\n")) {
    const lineStart = cursor;
    const lineEnd = cursor + line.length;
    cursor = lineEnd + 1;

    const startMatched = BLOCK_START_PATTERN.exec(line);
    if (startMatched) {
      const kind = startMatched[1] as ContentBlockKind;
      const name = startMatched[2];
      if (kind === "auto" && openStack.some((entry) => entry.kind === "auto")) {
        issues.push({
          code: "content-block-marker-invalid",
          message: `自动区块「${name}」嵌在另一个自动区块内；自动区块不得嵌套。`,
          path: relPath
        });
      }
      openStack.push({ kind, name, startIndex: lineStart, bodyStart: lineEnd + 1 });
      continue;
    }

    const endMatched = BLOCK_END_PATTERN.exec(line);
    if (endMatched) {
      const kind = endMatched[1] as ContentBlockKind;
      const name = endMatched[2];
      const top = openStack.pop();
      if (!top || top.kind !== kind || top.name !== name) {
        issues.push({
          code: "content-block-marker-invalid",
          message: `区块结束标记「${name}」没有匹配的开始标记，或与最近一个开始标记不同名。`,
          path: relPath
        });
        continue;
      }
      blocks.push({
        kind,
        name,
        start: top.startIndex,
        end: lineEnd,
        body: content.slice(top.bodyStart, lineStart).replace(/\n$/u, "")
      });
    }
  }

  for (const leftover of openStack) {
    issues.push({
      code: "content-block-marker-invalid",
      message: `区块「${leftover.name}」只有开始标记，没有结束标记。`,
      path: relPath
    });
  }

  const seen = new Map<string, number>();
  for (const block of blocks) {
    const key = block.kind + ":" + block.name;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const [key, count] of seen) {
    if (count > 1) {
      issues.push({
        code: "content-block-marker-invalid",
        message: `区块「${key.split(":")[1]}」在同一个文件里出现了 ${count} 次；同一文件内区块名必须唯一。`,
        path: relPath
      });
    }
  }

  blocks.sort((left, right) => left.start - right.start);
  return { blocks, issues };
}

export function findContentBlock(content: string, name: string): ContentBlock | null {
  const { blocks } = parseContentBlocks(content, "");
  return blocks.find((block) => block.name === name) ?? null;
}

/** 取区块正文；不存在返回 null。 */
export function getContentBlockBody(content: string, name: string): string | null {
  return findContentBlock(content, name)?.body ?? null;
}

/**
 * 用新正文替换已有区块（保留两行标记）；区块不存在时返回 null（调用方据此判断「需要新建」）。
 *
 * 只换区块内部正文，标记行原样按标准写法重写，保证重复刷新结果稳定。
 */
export function replaceContentBlockBody(content: string, name: string, body: string): string | null {
  const block = findContentBlock(content, name);
  if (!block) return null;
  const head = content.slice(0, block.start);
  const tail = content.slice(block.end);
  const startLine =
    "<!-- avw:" + block.kind + ":start name=" + block.name + " -->";
  const endLine = "<!-- avw:" + block.kind + ":end name=" + block.name + " -->";
  const inner = body.replace(/\n+$/u, "");
  return head + startLine + "\n" + inner + "\n" + endLine + tail;
}

export function renderAutoBlock(name: string, body: string): string {
  return [
    "<!-- avw:auto:start name=" + name + " -->",
    body.replace(/\n+$/u, ""),
    "<!-- avw:auto:end name=" + name + " -->"
  ].join("\n");
}

export function renderManualBlock(name: string, body: string): string {
  return [
    "<!-- avw:manual:start name=" + name + " -->",
    body.replace(/\n+$/u, ""),
    "<!-- avw:manual:end name=" + name + " -->"
  ].join("\n");
}

/* ------------------------------ 单分镜解析 ------------------------------ */

export interface StoryboardKeyframe {
  /** keyframe-01 */
  id: string;
  number: number;
  /** 「对应分镜」声明的分镜序号；缺失为 null。 */
  mappedSegment: number | null;
  /** 「关键时刻」说明。 */
  moment: string | null;
  /** 关键帧图片提示词正文（代码块内容），没有代码块时为 null。 */
  prompt: string | null;
  /**
   * 可复制提示词（关键帧小节里的第二个代码块）。
   *
   * 中文完整版本与可复制提示词分开存：gpt-image-2 项目两者同为中文，第二段可省略；
   * midjourney 项目可复制提示词必须是英文，写在第二段。
   */
  copyablePrompt: string | null;
  /** 整个关键帧小节原文。 */
  raw: string;
}

export interface StoryboardDocument {
  relPath: string;
  fileName: string;
  storyboardId: string;
  storyboardNumber: number;
  title: string | null;
  displayName: string | null;
  /** 第一部分：本段正文。 */
  bodySection: string;
  /** 本段景别与拍法（一句话），用于分镜总表；缺失为 null。 */
  shotSize: string | null;
  /** 第二部分：关键帧区块。 */
  keyframeSection: string;
  /** 第三部分：视频提示词。 */
  promptSection: string;
  keyframes: StoryboardKeyframe[];
  /** 视频提示词正文片段（代码块内容），缺失为 null。 */
  videoPromptSegment: string | null;
  issues: VerificationIssue[];
}

const SECTION_HEADING_PATTERN = /^(#{2,3})\s+(.+)$/u;
const FENCE_PATTERN = /\u0060{3,}[^\n]*\n([\s\S]*?)\u0060{3,}/u;

interface RawSection {
  heading: string;
  level: number;
  body: string;
}

function splitSections(content: string): RawSection[] {
  const sections: RawSection[] = [];
  let current: { heading: string; level: number; bodyLines: string[] } | null = null;
  // 整文件 CRLF 时行尾带 \r，会让 SECTION_HEADING_PATTERN 的 (.+)$ 失配（J9）；切行时一并归一。
  for (const line of content.split(/\r?\n/u)) {
    const matched = SECTION_HEADING_PATTERN.exec(line);
    if (matched) {
      if (current) sections.push({ heading: current.heading, level: current.level, body: current.bodyLines.join("\n") });
      current = { heading: matched[2].trim(), level: matched[1].length, bodyLines: [] };
      continue;
    }
    if (current) current.bodyLines.push(line);
  }
  if (current) sections.push({ heading: current.heading, level: current.level, body: current.bodyLines.join("\n") });
  return sections;
}

/**
 * 人工区块正文常常整段包在一个代码块围栏里；拼装整镜正文前先脱掉这层外壳。
 *
 * 只有「整段恰好就是一个代码块」时才脱壳，正文里夹带代码块的保持原样。
 */
export function unwrapFencedBlock(body: string | null): string {
  if (body === null) return "";
  const trimmed = body.trim();
  const matched = /^\u0060{3,}[^\n]*\n([\s\S]*?)\u0060{3,}$/u.exec(trimmed);
  return (matched ? matched[1] : trimmed).replace(/\n+$/u, "");
}

function fencedTextBlock(section: string): string | null {
  const matched = FENCE_PATTERN.exec(section);
  return matched ? matched[1].replace(/\n+$/u, "") : null;
}

/** 取小节里全部代码块，按出现顺序；用于「中文完整版本 + 可复制提示词」两段写法。 */
function fencedTextBlocks(section: string): string[] {
  const blocks: string[] = [];
  const pattern = /\u0060{3,}[^\n]*\n([\s\S]*?)\u0060{3,}/gu;
  for (const matched of section.matchAll(pattern)) {
    blocks.push((matched[1] ?? "").replace(/\n+$/u, ""));
  }
  return blocks;
}

/** 从正文里取「**标签**：值」形式的单行事实；取不到返回 null。 */
export function labeledLine(body: string, labels: readonly string[]): string | null {
  for (const label of labels) {
    const matched = new RegExp("^[\\s>*\\-]*\\**" + label + "\\**\\s*[：:]\\s*(.+)$", "mu").exec(body);
    if (matched) {
      const value = matched[1].trim();
      if (value.length > 0) return value;
    }
  }
  return null;
}

function findSectionByKeywords(sections: RawSection[], keywords: string[]): RawSection | null {
  for (const section of sections) {
    if (keywords.every((keyword) => section.heading.includes(keyword))) return section;
  }
  return null;
}

function findSectionByAnyKeyword(sections: RawSection[], keywords: string[]): RawSection | null {
  for (const section of sections) {
    if (keywords.some((keyword) => section.heading.includes(keyword))) return section;
  }
  return null;
}

function buildKeyframe(source: { id: string; number: number; lines: string[] }): StoryboardKeyframe {
  const raw = source.lines.join("\n");
  const mapped = /对应分镜\s*[：:]\s*(?:分镜\s*)?(\d+)/u.exec(raw);
  const momentMatched = /关键时刻\s*[：:]\s*(.+)$/mu.exec(raw);
  const blocks = fencedTextBlocks(raw);
  return {
    id: source.id,
    number: source.number,
    mappedSegment: mapped ? Number(mapped[1]) : null,
    moment: momentMatched ? momentMatched[1].trim() : null,
    prompt: blocks[0] ?? null,
    copyablePrompt: blocks[1] ?? null,
    raw: raw.trim()
  };
}

function parseKeyframes(keyframeSection: string): StoryboardKeyframe[] {
  const keyframes: StoryboardKeyframe[] = [];
  let current: { id: string; number: number; lines: string[] } | null = null;
  for (const line of keyframeSection.split("\n")) {
    const matched = KEYFRAME_HEADING_PATTERN.exec(line);
    if (matched) {
      if (current) keyframes.push(buildKeyframe(current));
      const number = Number(matched[1]);
      current = { id: "keyframe-" + padNumber(number, 2), number, lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) keyframes.push(buildKeyframe(current));
  return keyframes;
}

/**
 * 解析单分镜文件。固定三部分：本段正文、关键帧区块、视频提示词。
 *
 * 三部分按小节标题关键词识别（兼容「本段正文／本段画面与动作」这类写法），
 * 缺失任何一部分都会记一条 content-identity-invalid，避免半文件被当成完整文件读。
 */
export function parseStoryboardDocument(relPath: string, content: string): StoryboardDocument {
  const fileName = path.basename(relPath);
  const storyboardId = storyboardIdFromFileName(fileName) ?? fileName.replace(/\.md$/u, "");
  const storyboardNumber = idNumber(storyboardId) ?? 0;
  const issues: VerificationIssue[] = [];
  const sections = splitSections(content);

  const bodySection =
    findSectionByKeywords(sections, ["本段", "正文"]) ?? findSectionByKeywords(sections, ["本段", "画面"]);
  const keyframeSection = findSectionByAnyKeyword(sections, ["关键帧"]);
  const promptSection = findSectionByAnyKeyword(sections, ["视频提示词"]);

  if (!bodySection) {
    issues.push({
      code: "content-identity-invalid",
      message: "缺少「本段正文」区块；单分镜必须固定三部分（本段正文、关键帧、视频提示词）。",
      path: relPath
    });
  }
  if (!keyframeSection) {
    issues.push({
      code: "content-identity-invalid",
      message: "缺少「关键帧」区块；单分镜必须固定三部分（本段正文、关键帧、视频提示词）。",
      path: relPath
    });
  }
  if (!promptSection) {
    issues.push({
      code: "content-identity-invalid",
      message: "缺少「视频提示词」区块；单分镜必须固定三部分（本段正文、关键帧、视频提示词）。",
      path: relPath
    });
  }

  const keyframes = keyframeSection ? parseKeyframes(keyframeSection.body) : [];
  const videoPromptSegment = promptSection ? fencedTextBlock(promptSection.body) : null;
  if (promptSection && videoPromptSegment === null) {
    issues.push({
      code: "content-identity-invalid",
      message: "「视频提示词」区块里没有代码块；本段视频提示词正文必须写在代码块里，便于整镜拼装。",
      path: relPath
    });
  }

  const title = firstHeading(content);
  return {
    relPath,
    fileName,
    storyboardId,
    storyboardNumber,
    title,
    displayName: displayNameFromTitle(title),
    bodySection: bodySection?.body.trim() ?? "",
    shotSize: bodySection
      ? labeledLine(bodySection.body, ["景别与视角", "景别与拍法", "景别"])
      : null,
    keyframeSection: keyframeSection?.body.trim() ?? "",
    promptSection: promptSection?.body.trim() ?? "",
    keyframes,
    videoPromptSegment,
    issues
  };
}

/* ------------------------------ 镜头文件解析 ------------------------------ */

export interface ShotDocument {
  relPath: string;
  fileName: string;
  /** 文件原文（刷新与一致性检查需要）。 */
  raw: string;
  shotId: string;
  shotNumber: number;
  title: string | null;
  displayName: string | null;
  /** 观看顺序（- 观看顺序：N）；缺失为 null，由调用方回退到镜头编号。 */
  watchOrder: number | null;
  targetDuration: string | null;
  /** 分镜速览（自动区块）。 */
  segmentDigest: string | null;
  /** 图片提示词（自动区块）。 */
  imagePrompt: string | null;
  /** 镜头段拼装（自动区块）。 */
  segmentsBody: string | null;
  /** 视频提示词前段（人工区块）。 */
  promptBefore: string | null;
  /** 视频提示词后段（人工区块）。 */
  promptAfter: string | null;
  issues: VerificationIssue[];
}

const WATCH_ORDER_PATTERN = /^\s*[-*]\s*观看顺序\s*[：:]\s*(\d+)\s*$/mu;
const DURATION_PATTERN = /(?:目标时长|计划时长)\s*[：:]\s*([0-9]+\s*秒|[0-9]+\s*s)/u;

/** 解析镜头汇总文件（00_镜头-NNN.md）。 */
export function parseShotDocument(relPath: string, content: string): ShotDocument {
  const fileName = path.basename(relPath);
  const directoryName = path.basename(path.dirname(relPath));
  const shotId = shotIdFromDirectory(directoryName) ?? fileName.replace(/\.md$/u, "");
  const shotNumber = idNumber(shotId) ?? 0;
  const issues: VerificationIssue[] = [];

  const blockResult = parseContentBlocks(content, relPath);
  issues.push(...blockResult.issues);

  const watchOrderMatched = WATCH_ORDER_PATTERN.exec(content);
  const durationMatched = DURATION_PATTERN.exec(content);
  const title = firstHeading(content);

  return {
    relPath,
    fileName,
    raw: content,
    shotId,
    shotNumber,
    title,
    displayName: displayNameFromTitle(title),
    watchOrder: watchOrderMatched ? Number(watchOrderMatched[1]) : null,
    targetDuration: durationMatched ? durationMatched[1].replace(/\s+/gu, "") : null,
    segmentDigest: getContentBlockBody(content, "分镜速览"),
    imagePrompt: getContentBlockBody(content, "图片提示词"),
    segmentsBody: getContentBlockBody(content, "镜头段拼装"),
    promptBefore: getContentBlockBody(content, "视频提示词前段"),
    promptAfter: getContentBlockBody(content, "视频提示词后段"),
    issues
  };
}

/* ------------------------------ 整镜正文拼装 ------------------------------ */

export interface ShotPromptAssembly {
  /** 拼装后的整镜完整正文；无法拼装时为 null。 */
  text: string | null;
  /** 逐段结果，供差异定位与总表统计。 */
  segments: Array<{ storyboardId: string; number: number; text: string }>;
  issues: VerificationIssue[];
}

const SEGMENT_PREFIX_PATTERN = /^镜头\s*(\d+)\s*[：:]/u;

/**
 * 把单分镜的视频提示词片段按分镜序号拼成整镜正文。
 *
 * 规则：分镜序号必须 1..N 连续；片段已带「镜头N：」且 N 一致时原样保留，
 * N 不一致时报 content-segment-prefix-mismatch；未带前缀时补上。
 */
export function assembleShotVideoPrompt(shot: ShotDocument, storyboards: StoryboardDocument[]): ShotPromptAssembly {
  const issues: VerificationIssue[] = [];
  const ordered = [...storyboards].sort((left, right) => left.storyboardNumber - right.storyboardNumber);

  if (ordered.length === 0) {
    issues.push({
      code: "content-identity-invalid",
      message: "镜头 " + shot.shotId + " 目录下没有任何分镜文件；每个镜头至少要有 1 个分镜。",
      path: shot.relPath
    });
    return { text: null, segments: [], issues };
  }

  if (ordered.length > MAX_STORYBOARD_SEGMENTS) {
    issues.push({
      code: "invalid-storyboard-segment-count",
      message:
        "镜头 " + shot.shotId + " 有 " + String(ordered.length) + " 个分镜，超过上限 " + String(MAX_STORYBOARD_SEGMENTS) + " 个。",
      path: shot.relPath
    });
  }

  for (let index = 0; index < ordered.length; index += 1) {
    const expected = index + 1;
    if (ordered[index].storyboardNumber !== expected) {
      issues.push({
        code: "invalid-storyboard-segment-count",
        message:
          "镜头 " + shot.shotId + " 的分镜序号必须从 1 连续排到 " + String(ordered.length) + "，实际第 " + String(expected) +
          " 位是分镜-" + padNumber(ordered[index].storyboardNumber, 2) + "。",
        path: ordered[index].relPath
      });
    }
  }

  const segments: Array<{ storyboardId: string; number: number; text: string }> = [];
  for (const storyboard of ordered) {
    const raw = unwrapFencedBlock(storyboard.videoPromptSegment);
    if (raw.length === 0) {
      issues.push({
        code: "content-identity-invalid",
        message: "分镜 " + storyboard.storyboardId + " 没有视频提示词正文片段；整镜正文无法拼装。",
        path: storyboard.relPath
      });
      continue;
    }
    const prefixMatched = SEGMENT_PREFIX_PATTERN.exec(raw);
    let text: string;
    if (prefixMatched) {
      const declared = Number(prefixMatched[1]);
      if (declared !== storyboard.storyboardNumber) {
        issues.push({
          code: "content-segment-prefix-mismatch",
          message:
            "分镜 " + storyboard.storyboardId + " 的片段以「镜头" + String(declared) + "：」开头，但它的分镜序号是 " +
            String(storyboard.storyboardNumber) + "；前缀与序号必须一致。",
          path: storyboard.relPath
        });
        continue;
      }
      text = raw;
    } else {
      text = "镜头" + String(storyboard.storyboardNumber) + "：" + raw;
    }
    segments.push({ storyboardId: storyboard.storyboardId, number: storyboard.storyboardNumber, text });
  }

  if (segments.length === 0) {
    return { text: null, segments, issues };
  }

  const parts = [
    unwrapFencedBlock(shot.promptBefore),
    segments.map((segment) => segment.text).join("\n\n"),
    unwrapFencedBlock(shot.promptAfter)
  ].filter((part) => part.length > 0);

  return { text: parts.join("\n\n"), segments, issues };
}

/* ------------------------------ 关键帧映射校验 ------------------------------ */

/** 关键帧上限：1..min(4, max(分镜数,1))；保持现行口径，不重新定值。 */
export function keyframeLimitForSegmentCount(segmentCount: number): number {
  return Math.min(MAX_KEYFRAMES_PER_SHOT, Math.max(segmentCount, 1));
}

export function validateShotKeyframes(shot: ShotDocument, storyboards: StoryboardDocument[]): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  const segmentNumbers = new Set(storyboards.map((storyboard) => storyboard.storyboardNumber));
  const limit = keyframeLimitForSegmentCount(segmentNumbers.size);
  const allKeyframes = storyboards.flatMap((storyboard) =>
    storyboard.keyframes.map((keyframe) => ({ storyboard, keyframe }))
  );

  if (allKeyframes.length > limit) {
    issues.push({
      code: "invalid-keyframe-mapping",
      message:
        "镜头 " + shot.shotId + " 有 " + String(allKeyframes.length) + " 张关键帧，超过上限 " + String(limit) +
        " 张（不超过 4 张，也不超过分镜数）。",
      path: shot.relPath
    });
  }

  // 关键帧编号整镜唯一、跨分镜连续不重启：同一镜头里两个分镜各写「关键帧 01」
  // 会让 04 执行文件路径互相争用（同 relPath 双渲染），整理与校验永不收敛。
  const keyframesByNumber = new Map<number, Array<{ storyboard: StoryboardDocument; keyframe: StoryboardKeyframe }>>();
  for (const entry of allKeyframes) {
    const sameNumber = keyframesByNumber.get(entry.keyframe.number) ?? [];
    sameNumber.push(entry);
    keyframesByNumber.set(entry.keyframe.number, sameNumber);
  }
  for (const [number, entries] of keyframesByNumber) {
    if (entries.length <= 1) continue;
    const locations = entries
      .map((entry) => "分镜-" + padNumber(entry.storyboard.storyboardNumber, 2))
      .join("、");
    issues.push({
      code: "invalid-keyframe-mapping",
      message:
        "镜头 " + shot.shotId + " 里关键帧编号 " + padNumber(number, 2) + " 被 " + String(entries.length) +
        " 个分镜重复使用（" + locations + "）；关键帧编号必须整镜连续、跨分镜不重启，请把重复的编号改成不重复的新编号。",
      path: entries[0]!.storyboard.relPath
    });
  }

  for (const entry of allKeyframes) {
    const keyframe = entry.keyframe;
    const storyboard = entry.storyboard;
    if (keyframe.mappedSegment === null) {
      issues.push({
        code: "invalid-keyframe-mapping",
        message: "关键帧 " + keyframe.id + " 没有写「对应分镜：N」。",
        path: storyboard.relPath
      });
      continue;
    }
    if (!segmentNumbers.has(keyframe.mappedSegment)) {
      issues.push({
        code: "invalid-keyframe-mapping",
        message:
          "关键帧 " + keyframe.id + " 对应的分镜 " + String(keyframe.mappedSegment) + " 不在本镜头（本镜头分镜为 " +
          [...segmentNumbers].sort((left, right) => left - right).join("、") + "）。",
        path: storyboard.relPath
      });
    }
    if (!keyframe.moment) {
      issues.push({
        code: "invalid-keyframe-mapping",
        message: "关键帧 " + keyframe.id + " 没有写「关键时刻」。",
        path: storyboard.relPath
      });
    }
  }

  return issues;
}

/* ------------------------------ 内容树构建 ------------------------------ */

export interface ContentTreeStoryboard {
  relPath: string;
  document: StoryboardDocument;
}

export interface ContentTreeShot {
  sceneId: string;
  groupId: string;
  shotId: string;
  /** 镜头目录相对项目根的路径。 */
  directoryRelPath: string;
  /** 镜头汇总文件相对项目根的路径。 */
  relPath: string;
  document: ShotDocument;
  storyboards: ContentTreeStoryboard[];
  /** 拼装结果。 */
  assembly: ShotPromptAssembly;
  issues: VerificationIssue[];
}

export interface ContentTreeGroup {
  sceneId: string;
  groupId: string;
  directoryRelPath: string;
  overviewRelPath: string;
  shots: ContentTreeShot[];
}

export interface ContentTreeScene {
  sceneId: string;
  directoryRelPath: string;
  overviewRelPath: string;
  groups: ContentTreeGroup[];
}

export interface ContentTree {
  projectRoot: string;
  contentRoot: string;
  shotOverviewRelPath: string;
  storyboardOverviewRelPath: string;
  scenes: ContentTreeScene[];
  groups: ContentTreeGroup[];
  shots: ContentTreeShot[];
  issues: VerificationIssue[];
}

async function listDirectories(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function listMarkdownFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => entry.name)
    .sort();
}

/**
 * 判断某个旧格式文件是否已经在「已迁移/」里留下只读快照。
 *
 * 迁移不删除用户文件，原件仍留在 03／04／05 原路径；但只要快照存在，原件就只是历史副本，
 * 不再参与链接检查、一致性校验与 Obsidian 投影（规范 §7.8），否则同一段正文会被当成两套当前原文。
 */
export async function hasMigrationSnapshot(projectRoot: string, projectRelPath: string): Promise<boolean> {
  const snapshotDir = path.join(projectRoot, MIGRATED_SNAPSHOT_DIRECTORY, path.dirname(projectRelPath));
  if (!(await fs.pathExists(snapshotDir))) return false;
  const base = path.basename(projectRelPath);
  const entries = await fs.readdir(snapshotDir);
  return entries.some((entry) => entry === base || entry.startsWith(base + ".conflict-"));
}

/**
 * 判定项目当前的正文读取模式。
 *
 * 缺 content.format_version → legacy；=1 → content-tree；其他数值 → 不支持（记错误，不降级猜测）。
 */
export async function resolveContentMode(projectRoot: string): Promise<ContentModeResolution> {
  const issues: VerificationIssue[] = [];
  const { config } = await readProjectConfig(projectRoot);
  const version = contentFormatVersion(config);
  const contentRoot = path.join(projectRoot, CONTENT_ROOT_DIRECTORY);
  const contentRootExists = await fs.pathExists(contentRoot);

  if (!isSupportedContentFormatVersion(version)) {
    issues.push({
      code: "unsupported-content-format",
      message:
        "project.config.yaml 声明的内容树格式版本 " + String(version) +
        " 本工具还不支持；请升级工具或改回受支持的版本（缺这个键的旧项目按旧格式读取，不受影响）。",
      path: "project.config.yaml"
    });
    return { mode: "legacy", version, contentRoot, contentRootExists, issues };
  }

  if (version === null) {
    return { mode: "legacy", version, contentRoot, contentRootExists, issues };
  }

  if (!contentRootExists) {
    issues.push({
      code: "content-tree-missing",
      message:
        "project.config.yaml 声明了 content.format_version=" + String(version) + "，但项目根没有「" +
        CONTENT_ROOT_DIRECTORY + "/」目录。",
      path: "project.config.yaml"
    });
  }

  return { mode: "content-tree", version, contentRoot, contentRootExists, issues };
}

/**
 * 读取整个内容树。
 *
 * 结构固定：内容/{00_镜头总表.md, 01_分镜总表.md, 场-XXX/{00_场总览.md, 镜头组-XXX/{00_镜头组总览.md, 镜头-NNN/{00_镜头-NNN.md, 分镜-NN.md}}}}。
 * 目录名、文件名、层级不匹配时记 content-identity-invalid，不猜测别名。
 */
export async function buildContentTree(projectRoot: string): Promise<ContentTree> {
  const contentRoot = path.join(projectRoot, CONTENT_ROOT_DIRECTORY);
  const issues: VerificationIssue[] = [];
  const scenes: ContentTreeScene[] = [];
  const allGroups: ContentTreeGroup[] = [];
  const allShots: ContentTreeShot[] = [];

  const shotOverviewRelPath = toPosix(path.join(CONTENT_ROOT_DIRECTORY, CONTENT_SHOT_OVERVIEW_FILE));
  const storyboardOverviewRelPath = toPosix(path.join(CONTENT_ROOT_DIRECTORY, CONTENT_STORYBOARD_OVERVIEW_FILE));

  if (!(await fs.pathExists(contentRoot))) {
    return {
      projectRoot,
      contentRoot,
      shotOverviewRelPath,
      storyboardOverviewRelPath,
      scenes,
      groups: [],
      shots: [],
      issues: [
        {
          code: "content-tree-missing",
          message: "项目根没有「" + CONTENT_ROOT_DIRECTORY + "/」目录。",
          path: CONTENT_ROOT_DIRECTORY
        }
      ]
    };
  }

  for (const requiredFile of [CONTENT_SHOT_OVERVIEW_FILE, CONTENT_STORYBOARD_OVERVIEW_FILE]) {
    if (!(await fs.pathExists(path.join(contentRoot, requiredFile)))) {
      issues.push({
        code: "content-tree-incomplete",
        message: "内容树缺少总表「" + requiredFile + "」。",
        path: toPosix(path.join(CONTENT_ROOT_DIRECTORY, requiredFile))
      });
    }
  }

  for (const sceneDirectory of await listDirectories(contentRoot)) {
    const sceneId = sceneIdFromDirectory(sceneDirectory);
    if (!sceneId) {
      if (sceneDirectory === MIGRATED_SNAPSHOT_DIRECTORY) continue;
      issues.push({
        code: "content-identity-invalid",
        message: "内容树根下的目录「" + sceneDirectory + "」不是场目录；场目录必须命名为 场-001 这种形式。",
        path: toPosix(path.join(CONTENT_ROOT_DIRECTORY, sceneDirectory))
      });
      continue;
    }

    const sceneDirAbs = path.join(contentRoot, sceneDirectory);
    const sceneOverviewRelPath = toPosix(path.join(CONTENT_ROOT_DIRECTORY, sceneDirectory, SCENE_OVERVIEW_FILE));
    if (!(await fs.pathExists(path.join(sceneDirAbs, SCENE_OVERVIEW_FILE)))) {
      issues.push({
        code: "content-tree-incomplete",
        message: "场 " + sceneId + " 缺少总览文件「" + SCENE_OVERVIEW_FILE + "」。",
        path: toPosix(path.join(CONTENT_ROOT_DIRECTORY, sceneDirectory))
      });
    }

    const scene: ContentTreeScene = {
      sceneId,
      directoryRelPath: toPosix(path.join(CONTENT_ROOT_DIRECTORY, sceneDirectory)),
      overviewRelPath: sceneOverviewRelPath,
      groups: []
    };

    for (const groupDirectory of await listDirectories(sceneDirAbs)) {
      const groupId = shotGroupIdFromDirectory(groupDirectory);
      if (!groupId) {
        issues.push({
          code: "content-identity-invalid",
          message:
            "场 " + sceneId + " 下的目录「" + groupDirectory + "」不是镜头组目录；镜头组目录必须命名为 镜头组-001 这种形式。",
          path: toPosix(path.join(CONTENT_ROOT_DIRECTORY, sceneDirectory, groupDirectory))
        });
        continue;
      }

      const groupDirAbs = path.join(sceneDirAbs, groupDirectory);
      const groupOverviewRelPath = toPosix(
        path.join(CONTENT_ROOT_DIRECTORY, sceneDirectory, groupDirectory, SHOT_GROUP_OVERVIEW_FILE)
      );
      if (!(await fs.pathExists(path.join(groupDirAbs, SHOT_GROUP_OVERVIEW_FILE)))) {
        issues.push({
          code: "content-tree-incomplete",
          message: "镜头组 " + groupId + " 缺少总览文件「" + SHOT_GROUP_OVERVIEW_FILE + "」。",
          path: toPosix(path.join(CONTENT_ROOT_DIRECTORY, sceneDirectory, groupDirectory))
        });
      }

      const group: ContentTreeGroup = {
        sceneId,
        groupId,
        directoryRelPath: toPosix(path.join(CONTENT_ROOT_DIRECTORY, sceneDirectory, groupDirectory)),
        overviewRelPath: groupOverviewRelPath,
        shots: []
      };

      for (const shotDirectory of await listDirectories(groupDirAbs)) {
        const shotId = shotIdFromDirectory(shotDirectory);
        if (!shotId) {
          issues.push({
            code: "content-identity-invalid",
            message:
              "镜头组 " + groupId + " 下的目录「" + shotDirectory + "」不是镜头目录；镜头目录必须命名为 镜头-001 这种形式。",
            path: toPosix(path.join(CONTENT_ROOT_DIRECTORY, sceneDirectory, groupDirectory, shotDirectory))
          });
          continue;
        }

        const shotDirAbs = path.join(groupDirAbs, shotDirectory);
        const shotFileName = "00_" + shotDirectory + ".md";
        const shotFileRelPath = toPosix(
          path.join(CONTENT_ROOT_DIRECTORY, sceneDirectory, groupDirectory, shotDirectory, shotFileName)
        );
        const shotFileAbs = path.join(shotDirAbs, shotFileName);
        if (!(await fs.pathExists(shotFileAbs))) {
          issues.push({
            code: "content-tree-incomplete",
            message: "镜头 " + shotId + " 缺少汇总文件「" + shotFileName + "」。",
            path: toPosix(path.join(CONTENT_ROOT_DIRECTORY, sceneDirectory, groupDirectory, shotDirectory))
          });
        }

        const shotContent = (await fs.pathExists(shotFileAbs)) ? await fs.readFile(shotFileAbs, "utf8") : "";
        const shotDocument = parseShotDocument(shotFileRelPath, shotContent);

        const storyboards: ContentTreeStoryboard[] = [];
        for (const markdownFile of await listMarkdownFiles(shotDirAbs)) {
          if (markdownFile === shotFileName) continue;
          const storyboardRelPath = toPosix(
            path.join(CONTENT_ROOT_DIRECTORY, sceneDirectory, groupDirectory, shotDirectory, markdownFile)
          );
          if (!storyboardIdFromFileName(markdownFile)) {
            issues.push({
              code: "content-identity-invalid",
              message:
                "镜头 " + shotId + " 目录下的文件「" + markdownFile + "」不是分镜文件；分镜文件必须命名为 分镜-01.md 这种形式。",
              path: storyboardRelPath
            });
            continue;
          }
          const storyboardContent = await fs.readFile(path.join(shotDirAbs, markdownFile), "utf8");
          storyboards.push({
            relPath: storyboardRelPath,
            document: parseStoryboardDocument(storyboardRelPath, storyboardContent)
          });
        }

        storyboards.sort((left, right) => left.document.storyboardNumber - right.document.storyboardNumber);
        const storyboardDocuments = storyboards.map((storyboard) => storyboard.document);

        const assembly = assembleShotVideoPrompt(shotDocument, storyboardDocuments);
        const shotIssues: VerificationIssue[] = [...shotDocument.issues, ...assembly.issues];
        for (const storyboard of storyboards) shotIssues.push(...storyboard.document.issues);
        shotIssues.push(...validateShotKeyframes(shotDocument, storyboardDocuments));

        const shot: ContentTreeShot = {
          sceneId,
          groupId,
          shotId,
          directoryRelPath: toPosix(path.join(CONTENT_ROOT_DIRECTORY, sceneDirectory, groupDirectory, shotDirectory)),
          relPath: shotFileRelPath,
          document: shotDocument,
          storyboards,
          assembly,
          issues: shotIssues
        };
        group.shots.push(shot);
        allShots.push(shot);
        issues.push(...shotIssues);
      }

      if (group.shots.length === 0) {
        issues.push({
          code: "content-tree-incomplete",
          message: "镜头组 " + groupId + " 下没有任何镜头目录。",
          path: group.directoryRelPath
        });
      }

      scene.groups.push(group);
      allGroups.push(group);
    }

    if (scene.groups.length === 0) {
      issues.push({
        code: "content-tree-incomplete",
        message: "场 " + sceneId + " 下没有任何镜头组目录。",
        path: scene.directoryRelPath
      });
    }

    scenes.push(scene);
  }

  const shotIds = new Set<string>();
  for (const shot of allShots) {
    if (shotIds.has(shot.shotId)) {
      issues.push({
        code: "duplicate-shot-id",
        message: "镜头编号 " + shot.shotId + " 在内容树里出现了不止一次；镜头编号必须全局唯一。",
        path: shot.relPath
      });
    }
    shotIds.add(shot.shotId);
  }

  return {
    projectRoot,
    contentRoot,
    shotOverviewRelPath,
    storyboardOverviewRelPath,
    scenes,
    groups: allGroups,
    shots: allShots,
    issues
  };
}
