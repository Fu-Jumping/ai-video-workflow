import crypto from "node:crypto";
import fs from "fs-extra";
import path from "node:path";

import { parseYaml, stringifyYaml } from "./yaml.js";
import type { VerificationIssue } from "./types.js";

/**
 * 素材记录（B0／B1／B2）。
 *
 * 事实源是项目内可读的 Markdown 记录：frontmatter 存机器可读字段，正文存中文表格。
 * 不另建一份可被手改的“当前状态”文件；任何索引都从这些记录重建。
 * 稳定身份＝类别＋对象编号＋用途，展示名可改而身份键不变。
 */

const fence = String.fromCharCode(96).repeat(3);

export const mediaRecordSchemaVersion = 1;

export const outputsDirectory = "outputs";
export const outputsReferencesDirectory = "outputs/references";
export const outputsImagesDirectory = "outputs/images";
export const outputsVideoDirectory = "outputs/video";
export const assetLibraryDirectory = "assets/library";
export const mediaRecordsDirectory = "素材记录";
export const generationBatchesDirectory = "素材记录/生成批次";
export const workRecordsDirectory = "工作记录";
export const pendingProposalDirectory = "工作记录/修改提案/待确认";
export const handledProposalDirectory = "工作记录/修改提案/已处理";
export const workRecordExploreDirectory = "工作记录/探索";
export const workRecordHandoverDirectory = "工作记录/交接";
export const workRecordGuideFileName = "00_工作记录说明.md";
export const workRecordProposalTemplateFileName = "00_修改提案模板.md";
export const workRecordHandoverTemplateFileName = "00_交接模板.md";
export const mediaRecordGuideFileName = "00_素材记录说明.md";

export const mediaProjectDirectories = [
  outputsDirectory,
  outputsReferencesDirectory,
  outputsImagesDirectory,
  outputsVideoDirectory,
  assetLibraryDirectory,
  mediaRecordsDirectory,
  generationBatchesDirectory,
  workRecordsDirectory,
  pendingProposalDirectory,
  handledProposalDirectory,
  workRecordExploreDirectory,
  workRecordHandoverDirectory
] as const;

export const mediaCategoryLabels = {
  character: "角色",
  scene: "场景",
  prop: "道具",
  style: "风格",
  keyframe: "关键帧",
  video: "视频"
} as const;

export type MediaCategory = keyof typeof mediaCategoryLabels;

export const referenceMediaCategories: readonly MediaCategory[] = ["character", "scene", "prop", "style"];

export const videoPurpose = "视频";

export const mediaPlatformStatusLabels = {
  "not-generated": "未生成",
  generating: "生成中",
  completed: "平台已完成",
  failed: "平台失败",
  unknown: "状态未知"
} as const;

export const mediaDownloadStatusLabels = {
  "not-downloaded": "未下载",
  downloaded: "已下载",
  failed: "下载失败",
  unknown: "下载状态未知"
} as const;

export const mediaReviewStatusLabels = {
  unreviewed: "未审",
  accepted: "已审可用",
  rejected: "已审不可用"
} as const;

export const mediaSelectionLabels = {
  yes: "是",
  no: "否"
} as const;

export const mediaSourceLabels = {
  generated: "生成",
  edited: "改图",
  imported: "导入",
  external: "外部依赖"
} as const;

export const mediaBatchModeLabels = {
  generate: "生成",
  edit: "改图",
  import: "导入"
} as const;

export type MediaPlatformStatus = keyof typeof mediaPlatformStatusLabels;
export type MediaDownloadStatus = keyof typeof mediaDownloadStatusLabels;
export type MediaReviewStatus = keyof typeof mediaReviewStatusLabels;
export type MediaSource = keyof typeof mediaSourceLabels;
export type MediaBatchMode = keyof typeof mediaBatchModeLabels;

/** 三类失败态：远端状态未知、远端明确失败、生成成功但本地保存失败。 */
export type MediaFailureClass = "remote-unknown" | "remote-failed" | "local-save-failed";

export const mediaFailureClassLabels: Record<MediaFailureClass, string> = {
  "remote-unknown": "远端状态未知",
  "remote-failed": "远端明确失败",
  "local-save-failed": "生成成功但本地保存失败"
};

function reverseLabels<T extends Record<string, string>>(labels: T): Map<string, keyof T> {
  const map = new Map<string, keyof T>();
  for (const key of Object.keys(labels) as Array<keyof T>) {
    map.set(labels[key], key);
  }
  return map;
}

const platformStatusByLabel = reverseLabels(mediaPlatformStatusLabels);
const downloadStatusByLabel = reverseLabels(mediaDownloadStatusLabels);
const reviewStatusByLabel = reverseLabels(mediaReviewStatusLabels);
const sourceByLabel = reverseLabels(mediaSourceLabels);
const batchModeByLabel = reverseLabels(mediaBatchModeLabels);
const failureClassByLabel = reverseLabels(mediaFailureClassLabels);

export interface MediaIdentity {
  category: MediaCategory;
  /** 稳定对象编号，例如 角色-001 / 镜头-015。展示编号改变时这里不变。 */
  objectId: string;
  /** 用途，例如 造型-01 / 环境全景 / 关键帧-01；视频固定为 视频。 */
  purpose: string;
}

export function mediaIdentityKey(identity: MediaIdentity): string {
  return identity.category + ":" + identity.objectId + "/" + identity.purpose;
}

/** 人读编号前缀 → 内部编号前缀。长的先匹配，避免「镜头组-001」被当成「镜头」。 */
const mediaObjectIdPrefixes: ReadonlyArray<{ prefix: string; canonical: string }> = [
  { prefix: "镜头组", canonical: "group" },
  { prefix: "镜头", canonical: "shot" },
  { prefix: "场", canonical: "scene" }
];

const canonicalObjectIdPattern = /^(shot|scene|group)-(\d+)$/u;
const canonicalKeyframePurposePattern = /^(?:关键帧|keyframe)[\s_-]*(\d+)$/u;

function padDigits(digits: string, width: number): string {
  return String(Number.parseInt(digits, 10)).padStart(width, "0");
}

/**
 * 读取匹配用的规范化对象编号。
 *
 * 素材记录的稳定身份写作人读编号（镜头-001 / 场-001 / 镜头组-001），
 * 内容树内部用 shot-001 / scene-001 / group-001；读取匹配时两种写法统一。
 * 记录文件、路径与已存的编号一律不改，展示仍用记录里的原值。
 * 其他对象编号（如 角色-001）原样返回，不猜语义。
 */
export function canonicalMediaObjectId(objectId: string): string {
  const trimmed = objectId.trim();
  for (const { prefix, canonical } of mediaObjectIdPrefixes) {
    const head = prefix + "-";
    if (!trimmed.startsWith(head)) continue;
    const digits = trimmed.slice(head.length);
    if (/^\d+$/u.test(digits)) {
      return canonical + "-" + padDigits(digits, 3);
    }
  }
  const internal = canonicalObjectIdPattern.exec(trimmed);
  if (internal) {
    return internal[1] + "-" + padDigits(internal[2]!, 3);
  }
  return objectId;
}

/**
 * 读取匹配用的规范化用途。只归一关键帧（关键帧-01 / 关键帧 01 / keyframe-01），
 * 视频与其他类别保持原样。
 */
export function canonicalMediaPurpose(category: MediaCategory, purpose: string): string {
  if (category !== "keyframe") return purpose;
  const matched = canonicalKeyframePurposePattern.exec(purpose.trim());
  if (!matched) return purpose;
  return "keyframe-" + padDigits(matched[1]!, 2);
}

/** 读取匹配键：身份经规范化后比较；记录文件键与路径仍用 mediaIdentityKey。 */
export function mediaIdentityCanonicalKey(identity: MediaIdentity): string {
  return (
    identity.category +
    ":" +
    canonicalMediaObjectId(identity.objectId) +
    "/" +
    canonicalMediaPurpose(identity.category, identity.purpose)
  );
}

/** 人读页面上的用途写法：关键帧统一显示为「关键帧 01」，其他类别原样返回。 */
export function mediaPurposeDisplayName(category: MediaCategory, purpose: string): string {
  if (category !== "keyframe") return purpose;
  const matched = canonicalKeyframePurposePattern.exec(purpose.trim());
  if (!matched) return purpose;
  return "关键帧 " + padDigits(matched[1]!, 2);
}

export function parseMediaIdentityKey(key: string): MediaIdentity | undefined {
  const match = key.trim().match(/^([a-z-]+):([^/]+)\/(.+)$/u);
  if (!match) return undefined;
  const category = match[1] as MediaCategory;
  if (!(category in mediaCategoryLabels)) return undefined;
  return { category, objectId: match[2], purpose: match[3] };
}

const mediaSegmentPattern = /^[^\\/:*?"<>|\r\n]{1,60}$/u;

export function isSafeMediaSegment(value: string): boolean {
  return mediaSegmentPattern.test(value) && value !== "." && value !== "..";
}

export function formatMediaVersion(version: number): string {
  return "v" + String(Math.trunc(version)).padStart(3, "0");
}

export function formatMediaCandidate(candidate: number): string {
  return "c" + String(Math.trunc(candidate)).padStart(2, "0");
}

/** 文件名主干：对象＋用途＋版本＋候选。视频没有用途段。 */
export function mediaFileStem(identity: MediaIdentity, version: number, candidate: number): string {
  const parts = [identity.objectId];
  if (identity.purpose && identity.purpose !== videoPurpose) {
    parts.push(identity.purpose);
  }
  parts.push(formatMediaVersion(version), formatMediaCandidate(candidate));
  return parts.join("_");
}

export interface ParsedMediaFileName {
  objectId: string;
  purpose?: string;
  version: number;
  candidate: number;
  extension: string;
}

export function parseMediaFileName(fileName: string): ParsedMediaFileName | undefined {
  const match = fileName.match(/^(.+)_(v[0-9]{3,})_(c[0-9]{2,})(\.[A-Za-z0-9]+)$/u);
  if (!match) return undefined;
  const stem = match[1];
  const extension = match[4];
  const segments = stem.split("_");
  const objectId = segments.shift();
  if (!objectId) return undefined;
  const version = Number.parseInt(match[2].slice(1), 10);
  const candidate = Number.parseInt(match[3].slice(1), 10);
  if (!Number.isFinite(version) || !Number.isFinite(candidate)) return undefined;
  return {
    objectId,
    ...(segments.length > 0 ? { purpose: segments.join("_") } : {}),
    version,
    candidate,
    extension
  };
}

const minutesSecondsPattern = /^(\d{2}):([0-5]\d)$/u;
const hoursMinutesSecondsPattern = /^(\d{2}):([0-5]\d):([0-5]\d)$/u;

/**
 * 把记录里的时间位置文字换算成秒数，供嵌入写法 `![[file.mp4#t=<秒>]]` 使用。
 * 只认 `MM:SS` 与 `HH:MM:SS` 两种写法；空值或格式不认识返回 undefined，
 * 页面仍然显示原始文字。
 */
export function mediaTimecodeSeconds(timecode?: string): number | undefined {
  const text = timecode?.trim();
  if (!text) {
    return undefined;
  }
  const short = minutesSecondsPattern.exec(text);
  if (short) {
    return Number.parseInt(short[1]!, 10) * 60 + Number.parseInt(short[2]!, 10);
  }
  const long = hoursMinutesSecondsPattern.exec(text);
  if (long) {
    return Number.parseInt(long[1]!, 10) * 3600 + Number.parseInt(long[2]!, 10) * 60 + Number.parseInt(long[3]!, 10);
  }
  return undefined;
}

export function mediaOutputDirectory(identity: MediaIdentity): string {
  if (identity.category === "keyframe") {
    return outputsImagesDirectory + "/" + identity.objectId + "/" + identity.purpose;
  }
  if (identity.category === "video") {
    return outputsVideoDirectory + "/" + identity.objectId;
  }
  return (
    outputsReferencesDirectory +
    "/" +
    mediaCategoryLabels[identity.category] +
    "/" +
    identity.objectId +
    "/" +
    identity.purpose
  );
}

export function mediaLibraryDirectory(objectId: string): string {
  return assetLibraryDirectory + "/" + objectId;
}

function mediaRecordStem(identity: MediaIdentity): string {
  return identity.purpose === videoPurpose || !identity.purpose
    ? identity.objectId + "_" + videoPurpose
    : identity.objectId + "_" + identity.purpose;
}

export function mediaRecordPath(identity: MediaIdentity): string {
  return mediaRecordsDirectory + "/" + mediaRecordStem(identity) + ".md";
}

export function mediaBatchRecordPath(identity: MediaIdentity, version: number): string {
  return generationBatchesDirectory + "/" + mediaRecordStem(identity) + "_" + formatMediaVersion(version) + ".md";
}

export interface MediaCandidateRecord {
  version: number;
  candidate: number;
  fileName: string;
  platformStatus: MediaPlatformStatus;
  downloadStatus: MediaDownloadStatus;
  reviewStatus: MediaReviewStatus;
  selected: boolean;
  taskId?: string;
  bytes?: number;
  sha256?: string;
  failureClass?: MediaFailureClass;
  note?: string;
  /** 视频在成片里的时间位置（MM:SS 或 HH:MM:SS）；关键帧等图片候选不写。 */
  timecode?: string;
}

export interface MediaRecord {
  identity: MediaIdentity;
  displayName: string;
  source: MediaSource;
  currentSelection?: string;
  candidates: MediaCandidateRecord[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export function describeMediaCandidateState(candidate: MediaCandidateRecord): string {
  if (candidate.selected) {
    return "已选用";
  }
  if (candidate.platformStatus === "not-generated") {
    return "没有生成";
  }
  if (candidate.platformStatus === "unknown") {
    return "状态未知";
  }
  if (candidate.platformStatus === "failed") {
    return "生成失败";
  }
  if (candidate.platformStatus === "generating") {
    return "生成中";
  }
  if (candidate.downloadStatus !== "downloaded") {
    return "生成了但没下载";
  }
  return "下载了但尚未选用";
}

export function isMediaCandidateComplete(candidate: MediaCandidateRecord): boolean {
  return candidate.downloadStatus === "downloaded" && candidate.bytes !== undefined && candidate.bytes > 0;
}

function frontmatterBlock(content: string): { frontmatter: Record<string, unknown>; body: string } | undefined {
  if (!content.startsWith("---\n")) return undefined;
  const end = content.indexOf("\n---\n", 4);
  if (end < 0) return undefined;
  const raw = content.slice(4, end);
  const body = content.slice(end + 5);
  try {
    const parsed = parseYaml<unknown>(raw);
    if (!parsed || typeof parsed !== "object") return undefined;
    return { frontmatter: parsed as Record<string, unknown>, body };
  } catch {
    return undefined;
  }
}

function asText(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "是" || value === "true";
}

function stripVersionPrefix(value: string | undefined): string | undefined {
  return value ? value.replace(/^v/u, "") : undefined;
}

function stripCandidatePrefix(value: string | undefined): string | undefined {
  return value ? value.replace(/^c/u, "") : undefined;
}

export function renderMediaRecord(record: MediaRecord): string {
  const identity = record.identity;
  const frontmatter = {
    记录类型: "素材",
    记录版本: mediaRecordSchemaVersion,
    身份键: mediaIdentityKey(identity),
    类别: mediaCategoryLabels[identity.category],
    对象编号: identity.objectId,
    用途: identity.purpose,
    展示名: record.displayName,
    来源: mediaSourceLabels[record.source],
    当前选用: record.currentSelection ?? "未选",
    创建时间: record.createdAt,
    更新时间: record.updatedAt,
    候选: record.candidates.map((candidate) => ({
      版本: formatMediaVersion(candidate.version),
      候选: formatMediaCandidate(candidate.candidate),
      文件: candidate.fileName,
      平台: mediaPlatformStatusLabels[candidate.platformStatus],
      下载: mediaDownloadStatusLabels[candidate.downloadStatus],
      审核: mediaReviewStatusLabels[candidate.reviewStatus],
      选用: candidate.selected ? mediaSelectionLabels.yes : mediaSelectionLabels.no,
      ...(candidate.failureClass ? { 失败类型: mediaFailureClassLabels[candidate.failureClass] } : {}),
      ...(candidate.taskId ? { 任务编号: candidate.taskId } : {}),
      ...(candidate.bytes !== undefined ? { 字节: candidate.bytes } : {}),
      ...(candidate.sha256 ? { 哈希: candidate.sha256 } : {}),
      ...(candidate.timecode ? { 时间位置: candidate.timecode } : {}),
      ...(candidate.note ? { 说明: candidate.note } : {})
    }))
  };

  const rows = record.candidates.map((candidate) => {
    const cells = [
      formatMediaVersion(candidate.version),
      formatMediaCandidate(candidate.candidate),
      candidate.fileName,
      candidate.timecode ?? "-",
      mediaPlatformStatusLabels[candidate.platformStatus],
      mediaDownloadStatusLabels[candidate.downloadStatus],
      mediaReviewStatusLabels[candidate.reviewStatus],
      candidate.selected ? mediaSelectionLabels.yes : mediaSelectionLabels.no,
      describeMediaCandidateState(candidate),
      candidate.note ?? ""
    ];
    return "| " + cells.join(" | ") + " |";
  });

  const table =
    rows.length > 0
      ? [
          "| 版本 | 候选 | 文件 | 时间位置 | 平台 | 下载 | 审核 | 选用 | 当前状态 | 说明 |",
          "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
          ...rows
        ].join("\n")
      : "> 还没有候选。提交一次任务后这里会出现版本与候选。";

  return [
    "---",
    stringifyYaml(frontmatter).trimEnd(),
    "---",
    "",
    "# " + (record.displayName || identity.objectId),
    "",
    "身份键：" + mediaIdentityKey(identity) + "（展示名改变不影响这个键）",
    "",
    "## 版本与候选",
    "",
    table,
    "",
    "## 说明",
    "",
    record.notes?.trim() || "生成成功和下载成功属于任务状态，不能顶替人工判断；审核与选用只由用户确认后写入。",
    ""
  ].join("\n");
}

export function parseMediaRecord(content: string): MediaRecord | undefined {
  const block = frontmatterBlock(content);
  if (!block) return undefined;
  const data = block.frontmatter;
  if (asText(data["记录类型"]) !== "素材") return undefined;

  const keyText = asText(data["身份键"]);
  const identity = keyText ? parseMediaIdentityKey(keyText) : undefined;
  if (!identity) return undefined;

  const rawCandidates = Array.isArray(data["候选"]) ? data["候选"] : [];
  const candidates: MediaCandidateRecord[] = [];
  for (const entry of rawCandidates) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const version = asNumber(stripVersionPrefix(asText(item["版本"])));
    const candidate = asNumber(stripCandidatePrefix(asText(item["候选"])));
    const fileName = asText(item["文件"]);
    if (version === undefined || candidate === undefined || !fileName) continue;
    const failureLabel = asText(item["失败类型"]);
    const failureClass = failureLabel ? failureClassByLabel.get(failureLabel) : undefined;
    const bytes = asNumber(item["字节"]);
    const sha256 = asText(item["哈希"]);
    const timecode = asText(item["时间位置"]);
    const note = asText(item["说明"]);
    const taskId = asText(item["任务编号"]);
    candidates.push({
      version,
      candidate,
      fileName,
      platformStatus: platformStatusByLabel.get(asText(item["平台"]) ?? "") ?? "unknown",
      downloadStatus: downloadStatusByLabel.get(asText(item["下载"]) ?? "") ?? "unknown",
      reviewStatus: reviewStatusByLabel.get(asText(item["审核"]) ?? "") ?? "unreviewed",
      selected: asBoolean(item["选用"]),
      ...(taskId ? { taskId } : {}),
      ...(bytes !== undefined ? { bytes } : {}),
      ...(sha256 ? { sha256 } : {}),
      ...(failureClass ? { failureClass: failureClass as MediaFailureClass } : {}),
      ...(timecode ? { timecode } : {}),
      ...(note ? { note } : {})
    });
  }

  const selection = asText(data["当前选用"]);
  return {
    identity,
    displayName: asText(data["展示名"]) ?? identity.objectId,
    source: sourceByLabel.get(asText(data["来源"]) ?? "") ?? "generated",
    ...(selection && selection !== "未选" ? { currentSelection: selection } : {}),
    candidates,
    ...(asText(data["说明"]) ? { notes: asText(data["说明"]) } : {}),
    createdAt: asText(data["创建时间"]) ?? "",
    updatedAt: asText(data["更新时间"]) ?? ""
  };
}

export async function readMediaRecord(projectRoot: string, identity: MediaIdentity): Promise<MediaRecord | undefined> {
  const recordFile = path.join(projectRoot, mediaRecordPath(identity));
  if (!(await fs.pathExists(recordFile))) return undefined;
  return parseMediaRecord(await fs.readFile(recordFile, "utf8"));
}

export async function writeMediaRecord(projectRoot: string, record: MediaRecord): Promise<string> {
  const recordFile = path.join(projectRoot, mediaRecordPath(record.identity));
  await fs.ensureDir(path.dirname(recordFile));
  await fs.writeFile(recordFile, renderMediaRecord(record), "utf8");
  return recordFile;
}

export interface MediaBatchCandidate {
  candidate: number;
  fileName?: string;
  complete: boolean;
  note?: string;
}

export interface MediaBatchRecord {
  identity: MediaIdentity;
  version: number;
  mode: MediaBatchMode;
  editSource?: string;
  prompt: string;
  references: Array<{ order: number; fileName: string; purpose?: string }>;
  platform?: string;
  model?: string;
  aspect?: string;
  duration?: string;
  submittedAt?: string;
  taskId?: string;
  expectedCount?: number;
  actualCount?: number;
  candidates: MediaBatchCandidate[];
  sources: Array<{ kind: string; path: string }>;
  createdAt: string;
}

export function renderMediaBatchRecord(record: MediaBatchRecord): string {
  const frontmatter = {
    记录类型: "生成批次",
    记录版本: mediaRecordSchemaVersion,
    身份键: mediaIdentityKey(record.identity),
    批次: mediaRecordStem(record.identity) + "_" + formatMediaVersion(record.version),
    轮次: formatMediaVersion(record.version),
    方式: mediaBatchModeLabels[record.mode],
    ...(record.editSource ? { 改图来源: record.editSource } : {}),
    平台: record.platform ?? "未知",
    模型: record.model ?? "未知",
    画幅: record.aspect ?? "未知",
    时长: record.duration ?? "未知",
    提交时间: record.submittedAt ?? "未知",
    任务编号: record.taskId ?? "未知",
    期望数量: record.expectedCount ?? "未知",
    实际数量: record.actualCount ?? "未知",
    创建时间: record.createdAt,
    参考图: record.references.map((reference) => ({
      顺序: reference.order,
      文件: reference.fileName,
      ...(reference.purpose ? { 用途: reference.purpose } : {})
    })),
    候选: record.candidates.map((candidate) => ({
      候选: formatMediaCandidate(candidate.candidate),
      ...(candidate.fileName ? { 文件: candidate.fileName } : {}),
      完整: candidate.complete ? mediaSelectionLabels.yes : mediaSelectionLabels.no,
      ...(candidate.note ? { 说明: candidate.note } : {})
    })),
    引用来源: record.sources.map((source) => ({ 类型: source.kind, 路径: source.path }))
  };

  const referenceLines =
    record.references.length > 0
      ? record.references
          .slice()
          .sort((a, b) => a.order - b.order)
          .map(
            (reference) =>
              reference.order + ". " + reference.fileName + (reference.purpose ? "（" + reference.purpose + "）" : "")
          )
          .join("\n")
      : "> 本次没有参考图。";

  const candidateLines =
    record.candidates.length > 0
      ? record.candidates
          .map(
            (candidate) =>
              "- " +
              formatMediaCandidate(candidate.candidate) +
              "：" +
              (candidate.fileName ?? "未保存") +
              (candidate.complete ? "" : "（不完整，不登记为完整文件）") +
              (candidate.note ? " — " + candidate.note : "")
          )
          .join("\n")
      : "> 还没有返回结果。";

  const sourceLines =
    record.sources.length > 0
      ? record.sources.map((source) => "- " + source.kind + "：" + source.path).join("\n")
      : "> 未知。";

  return [
    "---",
    stringifyYaml(frontmatter).trimEnd(),
    "---",
    "",
    "# 提交批次 " + mediaRecordStem(record.identity) + " " + formatMediaVersion(record.version),
    "",
    "## 提交材料",
    "",
    "### 实际提交的提示词",
    "",
    fence + "text",
    record.prompt.trim() || "（未记录）",
    fence,
    "",
    "### 参考图与顺序",
    "",
    referenceLines,
    "",
    "### 平台参数",
    "",
    "- 平台：" + (record.platform ?? "未知"),
    "- 模型：" + (record.model ?? "未知"),
    "- 画幅：" + (record.aspect ?? "未知"),
    "- 时长：" + (record.duration ?? "未知"),
    "",
    "## 结果",
    "",
    candidateLines,
    "",
    "## 当时引用的来源",
    "",
    sourceLines,
    "",
    "> 这份批次记录固定当时的提示词与参考图版本；上游文件后来更新时，这里不跟着改写。",
    ""
  ].join("\n");
}

export function parseMediaBatchRecord(content: string): MediaBatchRecord | undefined {
  const block = frontmatterBlock(content);
  if (!block) return undefined;
  const data = block.frontmatter;
  if (asText(data["记录类型"]) !== "生成批次") return undefined;
  const keyText = asText(data["身份键"]);
  const identity = keyText ? parseMediaIdentityKey(keyText) : undefined;
  if (!identity) return undefined;
  const version = asNumber(stripVersionPrefix(asText(data["轮次"])));
  if (version === undefined) return undefined;

  const references = (Array.isArray(data["参考图"]) ? data["参考图"] : [])
    .map((entry) => {
      if (!entry || typeof entry !== "object") return undefined;
      const item = entry as Record<string, unknown>;
      const fileName = asText(item["文件"]);
      const order = asNumber(item["顺序"]);
      if (!fileName || order === undefined) return undefined;
      const purpose = asText(item["用途"]);
      return { order, fileName, ...(purpose ? { purpose } : {}) };
    })
    .filter((entry): entry is { order: number; fileName: string; purpose?: string } => entry !== undefined);

  const candidates = (Array.isArray(data["候选"]) ? data["候选"] : [])
    .map((entry) => {
      if (!entry || typeof entry !== "object") return undefined;
      const item = entry as Record<string, unknown>;
      const candidate = asNumber(stripCandidatePrefix(asText(item["候选"])));
      if (candidate === undefined) return undefined;
      const fileName = asText(item["文件"]);
      const note = asText(item["说明"]);
      return {
        candidate,
        ...(fileName ? { fileName } : {}),
        complete: asBoolean(item["完整"]),
        ...(note ? { note } : {})
      };
    })
    .filter((entry): entry is MediaBatchCandidate => entry !== undefined);

  const sources = (Array.isArray(data["引用来源"]) ? data["引用来源"] : [])
    .map((entry) => {
      if (!entry || typeof entry !== "object") return undefined;
      const item = entry as Record<string, unknown>;
      const sourcePath = asText(item["路径"]);
      if (!sourcePath) return undefined;
      return { kind: asText(item["类型"]) ?? "未知", path: sourcePath };
    })
    .filter((entry): entry is { kind: string; path: string } => entry !== undefined);

  const platform = asText(data["平台"]);
  const model = asText(data["模型"]);
  const aspect = asText(data["画幅"]);
  const duration = asText(data["时长"]);
  const submittedAt = asText(data["提交时间"]);
  const taskId = asText(data["任务编号"]);
  const expectedCount = asNumber(data["期望数量"]);
  const actualCount = asNumber(data["实际数量"]);
  const editSource = asText(data["改图来源"]);

  return {
    identity,
    version,
    mode: batchModeByLabel.get(asText(data["方式"]) ?? "") ?? "generate",
    ...(editSource ? { editSource } : {}),
    prompt: "",
    references,
    ...(platform && platform !== "未知" ? { platform } : {}),
    ...(model && model !== "未知" ? { model } : {}),
    ...(aspect && aspect !== "未知" ? { aspect } : {}),
    ...(duration && duration !== "未知" ? { duration } : {}),
    ...(submittedAt && submittedAt !== "未知" ? { submittedAt } : {}),
    ...(taskId && taskId !== "未知" ? { taskId } : {}),
    ...(expectedCount !== undefined ? { expectedCount } : {}),
    ...(actualCount !== undefined ? { actualCount } : {}),
    candidates,
    sources,
    createdAt: asText(data["创建时间"]) ?? ""
  };
}

const mediaLocks = new Map<string, Promise<unknown>>();

async function withMediaLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = mediaLocks.get(key) ?? Promise.resolve();
  const run = previous.then(task, task);
  mediaLocks.set(
    key,
    run.then(
      () => undefined,
      () => undefined
    )
  );
  return run;
}

export function nextMediaVersion(existingVersions: readonly number[]): number {
  let max = 0;
  for (const version of existingVersions) {
    if (Number.isFinite(version) && version > max) {
      max = Math.trunc(version);
    }
  }
  return max + 1;
}

export async function existingMediaVersions(projectRoot: string, identity: MediaIdentity): Promise<number[]> {
  const versions = new Set<number>();
  const record = await readMediaRecord(projectRoot, identity);
  for (const candidate of record?.candidates ?? []) {
    versions.add(candidate.version);
  }
  const outputDir = path.join(projectRoot, mediaOutputDirectory(identity));
  if (await fs.pathExists(outputDir)) {
    for (const entry of await fs.readdir(outputDir)) {
      const parsed = parseMediaFileName(entry);
      if (parsed) versions.add(parsed.version);
    }
  }
  const batchDir = path.join(projectRoot, generationBatchesDirectory);
  if (await fs.pathExists(batchDir)) {
    const prefix = mediaRecordStem(identity) + "_v";
    for (const entry of await fs.readdir(batchDir)) {
      if (!entry.startsWith(prefix) || !entry.endsWith(".md")) continue;
      const middle = entry.slice(prefix.length, entry.length - 3);
      const parsed = Number.parseInt(middle, 10);
      if (Number.isFinite(parsed)) versions.add(parsed);
    }
  }
  return [...versions].sort((a, b) => a - b);
}

/**
 * 分配下一轮提交编号。先写批次提交材料，因此两个并行任务不会拿到同一个 v 号；
 * 失败轮次同样占用编号，不回收。
 */
export async function reserveMediaBatch(
  projectRoot: string,
  batch: Omit<MediaBatchRecord, "version" | "createdAt"> & { createdAt?: string }
): Promise<MediaBatchRecord> {
  const identity = batch.identity;
  return withMediaLock(mediaIdentityKey(identity), async () => {
    const version = nextMediaVersion(await existingMediaVersions(projectRoot, identity));
    const record: MediaBatchRecord = {
      ...batch,
      version,
      createdAt: batch.createdAt ?? new Date().toISOString()
    };
    const batchFile = path.join(projectRoot, mediaBatchRecordPath(identity, version));
    await fs.ensureDir(path.dirname(batchFile));
    await fs.writeFile(batchFile, renderMediaBatchRecord(record), "utf8");
    return record;
  });
}

export interface MediaTarget {
  version: number;
  candidate: number;
  fileName: string;
  filePath: string;
  relativePath: string;
}

/** 为某一轮分配候选落点。已存在的目标文件不会被覆盖，候选号顺延。 */
export async function allocateMediaTarget(
  projectRoot: string,
  identity: MediaIdentity,
  version: number,
  extension: string
): Promise<MediaTarget> {
  const normalizedExtension = extension.startsWith(".") ? extension : "." + extension;
  return withMediaLock(mediaIdentityKey(identity), async () => {
    const directory = mediaOutputDirectory(identity);
    const absoluteDir = path.join(projectRoot, directory);
    await fs.ensureDir(absoluteDir);
    const existing = new Set(await fs.readdir(absoluteDir));
    let candidate = 1;
    for (;;) {
      const fileName = mediaFileStem(identity, version, candidate) + normalizedExtension;
      if (!existing.has(fileName)) {
        return {
          version,
          candidate,
          fileName,
          filePath: path.join(absoluteDir, fileName),
          relativePath: directory + "/" + fileName
        };
      }
      candidate += 1;
    }
  });
}

export function mediaFileSha256(content: Buffer | string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export async function describeMediaFile(filePath: string): Promise<{ bytes: number; sha256: string } | undefined> {
  if (!(await fs.pathExists(filePath))) return undefined;
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) return undefined;
  return { bytes: stat.size, sha256: mediaFileSha256(await fs.readFile(filePath)) };
}

/**
 * 素材记录自检。项目里没有 素材记录/ 时完全不介入，不影响既有项目。
 */
export async function verifyMediaRecords(projectRoot: string, issues: VerificationIssue[]): Promise<void> {
  const recordsRoot = path.join(projectRoot, mediaRecordsDirectory);
  if (!(await fs.pathExists(recordsRoot))) return;

  const seenKeys = new Map<string, string>();
  const entries = await fs.readdir(recordsRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name === mediaRecordGuideFileName) continue;
    const relPath = mediaRecordsDirectory + "/" + entry.name;
    const content = await fs.readFile(path.join(recordsRoot, entry.name), "utf8");
    const record = parseMediaRecord(content);
    if (!record) {
      issues.push({
        code: "invalid-media-record",
        message: "素材记录无法解析：" + entry.name,
        path: relPath
      });
      continue;
    }

    const key = mediaIdentityKey(record.identity);
    const previous = seenKeys.get(key);
    if (previous) {
      issues.push({
        code: "duplicate-media-record",
        message: "同一身份键出现在两份记录里：" + key + "（" + previous + " 与 " + relPath + "）",
        path: relPath
      });
    } else {
      seenKeys.set(key, relPath);
    }

    const expectedPath = mediaRecordPath(record.identity);
    if (expectedPath !== relPath) {
      issues.push({
        code: "media-record-identity-mismatch",
        message: "记录文件名与身份键不一致：" + relPath + " 应为 " + expectedPath,
        path: relPath
      });
    }

    const versions = new Set<number>();
    for (const candidate of record.candidates) {
      if (versions.has(candidate.version)) {
        issues.push({
          code: "duplicate-media-version",
          message: "同一轮次出现两次：" + formatMediaVersion(candidate.version),
          path: relPath
        });
      }
      versions.add(candidate.version);

      if (candidate.downloadStatus === "downloaded") {
        const filePath = path.join(projectRoot, mediaOutputDirectory(record.identity), candidate.fileName);
        const described = await describeMediaFile(filePath);
        if (!described) {
          issues.push({
            code: "media-record-missing-file",
            message: "记录写已下载但文件不存在：" + candidate.fileName,
            path: relPath
          });
        } else if (described.bytes === 0) {
          issues.push({
            code: "media-record-empty-file",
            message: "下载到的文件是空文件，不能登记为完整文件：" + candidate.fileName,
            path: relPath
          });
        } else if (candidate.bytes !== undefined && candidate.bytes !== described.bytes) {
          // 半文件：下载中断会留下大小不符的文件，记录里的字节数就是当时写下的完整大小。
          issues.push({
            code: "media-record-size-mismatch",
            message:
              "文件大小与记录不符，可能是下载未完成的半文件：" +
              candidate.fileName +
              "（记录 " +
              candidate.bytes +
              " 字节，实际 " +
              described.bytes +
              " 字节）",
            path: relPath
          });
        }
      }
    }

    if (
      record.currentSelection &&
      !record.candidates.some((candidate) => candidate.fileName === record.currentSelection)
    ) {
      issues.push({
        code: "media-record-selection-missing",
        message: "当前选用指向不存在的候选：" + record.currentSelection,
        path: relPath
      });
    }
  }
}

/**
 * 读出项目里全部素材记录（B2 的只读入口）。
 * 记录目录不存在时返回空数组，不报错。
 */
export async function listMediaRecords(projectRoot: string): Promise<MediaRecord[]> {
  const recordsRoot = path.join(projectRoot, mediaRecordsDirectory);
  if (!(await fs.pathExists(recordsRoot))) return [];
  const entries = await fs.readdir(recordsRoot, { withFileTypes: true });
  const records: MediaRecord[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name === mediaRecordGuideFileName) continue;
    const record = parseMediaRecord(await fs.readFile(path.join(recordsRoot, entry.name), "utf8"));
    if (record) records.push(record);
  }
  records.sort((left, right) => {
    const keyLeft = mediaIdentityKey(left.identity);
    const keyRight = mediaIdentityKey(right.identity);
    return keyLeft === keyRight ? 0 : keyLeft < keyRight ? -1 : 1;
  });
  return records;
}

/**
 * 把全部素材记录渲染成一份人能读的清单。
 * 四种状态分别显示，不合并成“已完成”。
 */
export function renderMediaOverview(records: readonly MediaRecord[]): string {
  const lines: string[] = [];
  lines.push("素材记录：" + records.length + " 条");
  if (records.length === 0) {
    lines.push("项目里还没有素材记录。生成或导入一次素材后，这里会出现登记项。");
    return lines.join("\n");
  }

  const byCategory = new Map<string, MediaRecord[]>();
  for (const record of records) {
    const label = mediaCategoryLabels[record.identity.category];
    const bucket = byCategory.get(label);
    if (bucket) {
      bucket.push(record);
    } else {
      byCategory.set(label, [record]);
    }
  }

  for (const [label, bucket] of byCategory) {
    lines.push("");
    lines.push("## " + label + "（" + bucket.length + " 条）");
    for (const record of bucket) {
      const selection = record.currentSelection
        ? record.candidates.find((candidate) => candidate.fileName === record.currentSelection)
        : undefined;
      lines.push("- " + record.displayName + "（" + mediaIdentityKey(record.identity) + "）");
      lines.push(
        "  当前选用：" +
          (selection
            ? formatMediaVersion(selection.version) + formatMediaCandidate(selection.candidate) + " " + selection.fileName
            : "未选")
      );
      for (const candidate of record.candidates) {
        const parts = [
          formatMediaVersion(candidate.version) + formatMediaCandidate(candidate.candidate),
          "平台 " + mediaPlatformStatusLabels[candidate.platformStatus],
          "下载 " + mediaDownloadStatusLabels[candidate.downloadStatus],
          "审核 " + mediaReviewStatusLabels[candidate.reviewStatus],
          "选用 " + (candidate.selected ? mediaSelectionLabels.yes : mediaSelectionLabels.no)
        ];
        if (candidate.failureClass) parts.push("失败类型 " + mediaFailureClassLabels[candidate.failureClass]);
        lines.push("    " + parts.join("｜") + "　" + describeMediaCandidateState(candidate));
      }
    }
  }
  return lines.join("\n");
}
