/**
 * 素材审阅（B3）：把「素材记录/」里的素材记录投影成 Obsidian 观看层页面。
 *
 * 素材记录仍然是唯一事实源；这里只生成只读展示页面：
 * - 一个总览页（mediaReviewIndexPath），按类别分组列出全部素材；
 * - 每条素材一个单条页（mediaReviewPagePath），展示身份、当前选用与全部候选。
 *
 * 项目里没有「素材记录/」目录（或目录里没有可解析的素材记录）时不生成任何文件，
 * 导出结果与新增本模块之前完全一致。
 */
import fs from "fs-extra";
import path from "node:path";

import {
  describeMediaCandidateState,
  describeMediaFile,
  formatMediaCandidate,
  formatMediaVersion,
  mediaCategoryLabels,
  mediaDownloadStatusLabels,
  mediaIdentityKey,
  mediaOutputDirectory,
  mediaPlatformStatusLabels,
  mediaRecordGuideFileName,
  mediaRecordPath,
  mediaRecordsDirectory,
  mediaReviewStatusLabels,
  mediaSelectionLabels,
  mediaSourceLabels,
  mediaTimecodeSeconds,
  parseMediaRecord,
  type MediaCandidateRecord,
  type MediaCategory,
  type MediaIdentity,
  type MediaRecord
} from "../media-records.js";
import {
  deriveCandidateHumanState,
  humanReviewStateLabels,
  primaryMediaCandidate,
  summarizeHumanReviewStates,
  type HumanReviewState
} from "../media-human-state.js";
import { wikiLinkTargetForVaultPath } from "./markdown.js";
import { mediaReviewCategoryDirectory, mediaReviewDirectory, mediaReviewIndexPath, mediaReviewPagePath } from "./routes.js";
import type { ObsidianGeneratedFile } from "./types.js";

/** 总览页的分类顺序与 mediaCategoryLabels 保持一致。 */
const categoryOrder: readonly MediaCategory[] = ["character", "scene", "prop", "style", "keyframe", "video"];

function escapeCell(value: string): string {
  return value.split("\n").join(" ").split("\r").join(" ").split("|").join("｜").trim();
}

function mediaPagePathFor(record: MediaRecord): string {
  const identity = record.identity;
  return mediaReviewPagePath(identity.category, identity.objectId, identity.purpose);
}

function mediaFileRelativePath(record: MediaRecord, candidate: MediaCandidateRecord): string {
  return mediaOutputDirectory(record.identity) + "/" + candidate.fileName;
}

/**
 * 素材副本在 vault 内的根目录。刻意不放进 routes.ts 的页面目录里：
 * 05_素材审阅/参考素材 与 05_素材审阅/关键帧 存放的是页面，素材副本另起 _素材/ 子树。
 */
const mediaAssetsDirectory = "_素材";

/** 一条需要复制进 vault 的素材文件。 */
export interface MediaReviewAsset {
  /** 源文件在项目内的绝对路径（复制源）。 */
  sourcePath: string;
  /** 源文件在项目内的相对路径（POSIX，用于「文件缺失」提示）。 */
  relativePath: string;
  /** 复制到 vault 之后的 vault 内相对路径。 */
  vaultPath: string;
  /** 页面里应使用的 vault 内 wiki 嵌入目标。 */
  embedTarget: string;
  /** 源文件当前是否存在；不存在时只提示「文件缺失」，不复制也不抛错。 */
  exists: boolean;
}

/** 素材副本的 vault 内路径：05_素材审阅/_素材/<类别目录>/<objectId>/<文件名>。 */
function mediaAssetVaultPath(record: MediaRecord, candidate: MediaCandidateRecord): string {
  const identity = record.identity;
  const categoryDirectory = path.posix.basename(mediaReviewCategoryDirectory(identity.category));
  return [mediaReviewDirectory, mediaAssetsDirectory, categoryDirectory, identity.objectId, candidate.fileName].join("/");
}

/**
 * 算出「需要复制进 vault 的素材文件」清单。
 *
 * 外部 vault 里没有项目的 outputs/ 目录，所以页面不能再用项目相对路径嵌入；
 * 这份清单同时被页面渲染（决定嵌入目标）和导出流程（真正复制）使用。
 * 没有素材记录时返回空数组，导出行为与新增本功能之前完全一致。
 */
export async function planMediaReviewAssets(projectRoot: string): Promise<MediaReviewAsset[]> {
  const records = await readProjectMediaRecords(projectRoot);
  return planAssetsForRecords(projectRoot, records);
}

async function planAssetsForRecords(projectRoot: string, records: MediaRecord[]): Promise<MediaReviewAsset[]> {
  const assets = new Map<string, MediaReviewAsset>();
  for (const record of records) {
    for (const candidate of record.candidates) {
      const vaultPath = mediaAssetVaultPath(record, candidate);
      if (assets.has(vaultPath)) {
        continue;
      }
      const relativePath = mediaFileRelativePath(record, candidate);
      const sourcePath = path.join(projectRoot, ...relativePath.split("/"));
      assets.set(vaultPath, {
        sourcePath,
        relativePath,
        vaultPath,
        embedTarget: wikiLinkTargetForVaultPath(vaultPath),
        exists: await fs.pathExists(sourcePath)
      });
    }
  }
  return [...assets.values()];
}

function linkToIndexPage(label: string): string {
  return "[[" + wikiLinkTargetForVaultPath(mediaReviewIndexPath) + "|" + label + "]]";
}

function linkToRecordPage(record: MediaRecord, label?: string): string {
  return "[[" + wikiLinkTargetForVaultPath(mediaPagePathFor(record)) + "|" + (label ?? record.displayName) + "]]";
}

/** 候选在展示层的稳定键：身份键 + 文件名。 */
export function mediaCandidateKey(identity: MediaIdentity, fileName: string): string {
  return mediaIdentityKey(identity) + "|" + fileName;
}

/** 素材审阅页一次构建的展示数据：记录、素材副本、按候选索引与四态。 */
export interface MediaReviewDisplay {
  records: MediaRecord[];
  /** vaultPath -> asset */
  assets: Map<string, MediaReviewAsset>;
  /** mediaCandidateKey(identity,fileName) -> asset */
  assetsByCandidate: Map<string, MediaReviewAsset>;
  /** mediaCandidateKey(identity,fileName) -> 四态 */
  humanStates: Map<string, HumanReviewState>;
}

/**
 * 读取全部素材记录、规划素材副本，并按候选计算当前文件哈希与四态。
 *
 * 导出流程只调用这一次：素材页、镜头页与分镜页共用同一份哈希结果，
 * 不在各处重复读记录或重复算哈希。
 */
export async function buildMediaReviewDisplay(projectRoot: string): Promise<MediaReviewDisplay> {
  const records = await readProjectMediaRecords(projectRoot);
  const assets = new Map<string, MediaReviewAsset>();
  for (const asset of await planAssetsForRecords(projectRoot, records)) {
    assets.set(asset.vaultPath, asset);
  }
  const assetsByCandidate = new Map<string, MediaReviewAsset>();
  const humanStates = new Map<string, HumanReviewState>();
  for (const record of records) {
    for (const candidate of record.candidates) {
      const key = mediaCandidateKey(record.identity, candidate.fileName);
      const asset = assets.get(mediaAssetVaultPath(record, candidate));
      if (asset) {
        assetsByCandidate.set(key, asset);
      }
      const described = asset && asset.exists ? await describeMediaFile(asset.sourcePath) : undefined;
      humanStates.set(key, deriveCandidateHumanState({ candidate, currentSha256: described?.sha256 }));
    }
  }
  return { records, assets, assetsByCandidate, humanStates };
}

/** 一条素材记录的主候选四态；没有主候选时按「还没准备好」处理。 */
export function recordHumanReviewState(
  record: MediaRecord,
  humanStates: Map<string, HumanReviewState>
): HumanReviewState {
  const candidate = primaryMediaCandidate(record);
  if (!candidate) {
    return "not-ready";
  }
  return humanStates.get(mediaCandidateKey(record.identity, candidate.fileName)) ?? "not-ready";
}

function selectedCandidate(record: MediaRecord): MediaCandidateRecord | undefined {
  return primaryMediaCandidate(record);
}

function describeCurrentSelection(record: MediaRecord): string {
  const selected = selectedCandidate(record);
  if (!selected) {
    return "尚未选用";
  }
  return formatMediaVersion(selected.version) + " / " + formatMediaCandidate(selected.candidate);
}

function compareRecords(left: MediaRecord, right: MediaRecord): number {
  const leftIndex = categoryOrder.indexOf(left.identity.category);
  const rightIndex = categoryOrder.indexOf(right.identity.category);
  if (leftIndex !== rightIndex) {
    return leftIndex - rightIndex;
  }
  const byObject = left.identity.objectId.localeCompare(right.identity.objectId, "zh-Hans-CN");
  return byObject !== 0 ? byObject : left.identity.purpose.localeCompare(right.identity.purpose, "zh-Hans-CN");
}

/** 读取项目里全部素材记录；目录不存在时返回空数组。 */
export async function readProjectMediaRecords(projectRoot: string): Promise<MediaRecord[]> {
  const recordsRoot = path.join(projectRoot, mediaRecordsDirectory);
  if (!(await fs.pathExists(recordsRoot))) {
    return [];
  }
  const entries = await fs.readdir(recordsRoot, { withFileTypes: true });
  const records: MediaRecord[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name === mediaRecordGuideFileName) {
      continue;
    }
    const raw = await fs.readFile(path.join(recordsRoot, entry.name), "utf8");
    const record = parseMediaRecord(raw);
    if (record) {
      records.push(record);
    }
  }
  return records.sort(compareRecords);
}

/** 校验用：每条素材记录应当存在的那一页，以及它对应的素材记录。 */
export async function expectedMediaReviewPages(
  projectRoot: string
): Promise<{ pagePath: string; recordPath: string }[]> {
  const records = await readProjectMediaRecords(projectRoot);
  return records.map((record) => ({
    pagePath: mediaPagePathFor(record),
    recordPath: mediaRecordPath(record.identity)
  }));
}

function renderIndexRow(record: MediaRecord, humanStates: Map<string, HumanReviewState>): string {
  const selected = selectedCandidate(record);
  const humanState = humanStateFor(record, selected, humanStates);
  const cells = [
    escapeCell(record.displayName),
    escapeCell(describeCurrentSelection(record)),
    selected ? mediaPlatformStatusLabels[selected.platformStatus] : "-",
    selected ? mediaDownloadStatusLabels[selected.downloadStatus] : "-",
    selected ? mediaReviewStatusLabels[selected.reviewStatus] : "-",
    selected && selected.selected ? mediaSelectionLabels.yes : mediaSelectionLabels.no,
    humanReviewStateLabels[humanState],
    linkToRecordPage(record, "打开单条页")
  ];
  return "| " + cells.join(" | ") + " |";
}

function humanStateFor(
  record: MediaRecord,
  candidate: MediaCandidateRecord | undefined,
  humanStates: Map<string, HumanReviewState>
): HumanReviewState {
  if (!candidate) {
    return "not-ready";
  }
  return humanStates.get(mediaCandidateKey(record.identity, candidate.fileName)) ?? "not-ready";
}

function renderIndexCategorySection(
  category: MediaCategory,
  bucket: MediaRecord[],
  order: number,
  humanStates: Map<string, HumanReviewState>
): string {
  const heading = "## " + order + ". " + mediaCategoryLabels[category];
  if (bucket.length === 0) {
    return heading + "\n\n- 暂无" + mediaCategoryLabels[category] + "素材记录。\n";
  }
  const rows = [
    "| 展示名 | 当前选用 | 平台状态 | 下载状态 | 审核状态 | 是否选用 | 人工审核 | 单条页 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...bucket.map((record) => renderIndexRow(record, humanStates))
  ];
  return heading + "\n\n" + rows.join("\n") + "\n";
}

function renderIndexPage(records: MediaRecord[], humanStates: Map<string, HumanReviewState>): ObsidianGeneratedFile {
  const grouped = new Map<MediaCategory, MediaRecord[]>();
  for (const category of categoryOrder) {
    grouped.set(category, []);
  }
  for (const record of records) {
    grouped.get(record.identity.category)?.push(record);
  }
  const summary = categoryOrder
    .map((category) => mediaCategoryLabels[category] + " " + (grouped.get(category)?.length ?? 0) + " 条")
    .join(" / ");
  const sections = categoryOrder.map((category, index) =>
    renderIndexCategorySection(category, grouped.get(category) ?? [], index + 1, humanStates)
  );
  const content = [
    "# 素材总览",
    "",
    "素材记录（" + mediaRecordsDirectory + "/）是素材的唯一事实源；本页与每条素材页只是它的只读展示，审核结论请写回素材记录。",
    "",
    "- 素材记录数：" + records.length,
    "- 分类：" + summary,
    "- 人工审核：" + humanReviewStateLabels["not-ready"] + " / " + humanReviewStateLabels.waiting + " / " +
      humanReviewStateLabels.accepted + " / " + humanReviewStateLabels["needs-recheck"],
    "",
    ...sections
  ].join("\n");
  return { vaultPath: mediaReviewIndexPath, content };
}

function renderCandidateRow(candidate: MediaCandidateRecord, humanState: HumanReviewState): string {
  const cells = [
    formatMediaVersion(candidate.version),
    formatMediaCandidate(candidate.candidate),
    escapeCell(candidate.fileName),
    mediaPlatformStatusLabels[candidate.platformStatus],
    mediaDownloadStatusLabels[candidate.downloadStatus],
    mediaReviewStatusLabels[candidate.reviewStatus],
    candidate.selected ? mediaSelectionLabels.yes : mediaSelectionLabels.no,
    humanReviewStateLabels[humanState],
    escapeCell(describeMediaCandidateState(candidate)),
    escapeCell(candidate.note ?? (candidate.failureClass ? "失败分类：" + candidate.failureClass : "-"))
  ];
  return "| " + cells.join(" | ") + " |";
}

function renderCandidateFileSection(record: MediaRecord, assets: Map<string, MediaReviewAsset>): string[] {
  if (record.candidates.length === 0) {
    return ["- 暂无候选。"];
  }
  const blocks: string[] = [];
  for (const candidate of record.candidates) {
    const relativePath = mediaFileRelativePath(record, candidate);
    const asset = assets.get(mediaAssetVaultPath(record, candidate));
    const seconds = record.identity.category === "video" ? mediaTimecodeSeconds(candidate.timecode) : undefined;
    const embed = asset?.exists
      ? "![[" + asset.embedTarget + (seconds !== undefined ? "#t=" + String(seconds) : "") + "]]"
      : "文件缺失：" + relativePath;
    blocks.push("### " + formatMediaVersion(candidate.version) + " / " + formatMediaCandidate(candidate.candidate), "", embed);
    if (candidate.timecode) {
      blocks.push("", "时间位置：" + candidate.timecode);
    }
    if (seconds !== undefined) {
      blocks.push("", "> 时间位置只作文字提示：Obsidian 播放器是否按 #t= 跳到该时间点取决于实际环境。");
    }
  }
  return blocks;
}

function renderRecordPage(
  record: MediaRecord,
  assets: Map<string, MediaReviewAsset>,
  humanStates: Map<string, HumanReviewState>
): ObsidianGeneratedFile {
  const identity = record.identity;
  const selected = selectedCandidate(record);
  const selectedState = humanStateFor(record, selected, humanStates);
  const candidateTable = [
    "| 版本 | 候选 | 文件 | 平台 | 下载 | 审核 | 选用 | 人工审核 | 当前状态 | 说明 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...record.candidates.map((candidate) =>
      renderCandidateRow(candidate, humanStateFor(record, candidate, humanStates))
    )
  ];
  const fileBlocks = renderCandidateFileSection(record, assets);
  const selectionLines = selected
    ? [
        "- 选用：**" + describeCurrentSelection(record) + "**（" + selected.fileName + "）",
        "- 平台状态：" + mediaPlatformStatusLabels[selected.platformStatus],
        "- 下载状态：" + mediaDownloadStatusLabels[selected.downloadStatus],
        "- 审核状态：" + mediaReviewStatusLabels[selected.reviewStatus],
        "- 人工审核：**" + humanReviewStateLabels[selectedState] + "**"
      ]
    : ["- 尚未选用任何候选。", "- 人工审核：**" + humanReviewStateLabels[humanStateFor(record, undefined, humanStates)] + "**"];
  const content = [
    "# " + record.displayName,
    "",
    "返回：" + linkToIndexPage("素材总览"),
    "",
    "## 1. 身份",
    "",
    "- 类别：" + mediaCategoryLabels[identity.category],
    "- 对象编号：" + identity.objectId,
    "- 用途：" + identity.purpose,
    "- 身份键：" + mediaIdentityKey(identity),
    "- 素材记录：" + mediaRecordPath(identity),
    "- 来源：" + (mediaSourceLabels[record.source] ?? record.source),
    "",
    "## 2. 当前选用",
    "",
    ...selectionLines,
    "",
    "## 3. 候选",
    "",
    ...(record.candidates.length > 0 ? candidateTable : ["- 暂无候选。"]),
    "",
    "## 4. 候选文件",
    "",
    ...fileBlocks,
    ...(record.notes ? ["", "## 5. 备注", "", record.notes] : [])
  ].join("\n");
  return { vaultPath: mediaPagePathFor(record), content };
}

/** 生成素材审阅页；没有素材记录时返回空数组（导出结果不变）。 */
export async function renderMediaReviewFiles(
  projectRoot: string,
  display?: MediaReviewDisplay
): Promise<ObsidianGeneratedFile[]> {
  const resolved = display ?? (await buildMediaReviewDisplay(projectRoot));
  if (resolved.records.length === 0) {
    return [];
  }
  const files: ObsidianGeneratedFile[] = [renderIndexPage(resolved.records, resolved.humanStates)];
  for (const record of resolved.records) {
    files.push(renderRecordPage(record, resolved.assets, resolved.humanStates));
  }
  return files;
}
