import fs from "fs-extra";
import path from "node:path";

import { STEP_DIR_BY_NUMBER } from "./constants.js";
import {
  buildContentTree,
  getContentBlockBody,
  renderAutoBlock,
  renderManualBlock,
  replaceContentBlockBody,
  resolveContentMode,
  sceneDirectoryName,
  shotGroupDirectoryName,
  type ContentMode
} from "./content-tree.js";
import { orderedShots } from "./content-assemble.js";
import { mediaDurationSeconds } from "./media-duration.js";
import {
  listMediaRecords,
  mediaIdentityCanonicalKey,
  mediaOutputDirectory,
  videoPurpose,
  type MediaIdentity,
  type MediaRecord
} from "./media-records.js";
import { primaryMediaCandidate } from "./media-human-state.js";
import type { VerificationIssue } from "./types.js";

/* ------------------------------------------------------------------ *
 * 粗剪顺序表（D1）：顺序与选用的唯一文件事实源（CLI 工作流侧）。
 *
 * 口径（用户 2026-10-24 拍板）：
 * - 文件固定在 `06_执行计划/00_粗剪顺序表.md`；
 * - 与将来桌面 App 的排序不共用：桌面按 D-360 存应用内部数据，互不读写；
 * - 只从「当前选用且人工已审可用」的版本读入；未审版本标注「未审试用」，
 *   不改变素材记录的审核状态；没有可用视频的镜头明确标「缺素材」。
 *
 * 「成片顺序」列允许手改数字调整顺序；刷新按镜头身份保留手改顺序，
 * 新增镜头排在最后；`--check` 只校验不写盘。
 * ------------------------------------------------------------------ */

export const ROUGH_CUT_PLAN_FILE = path.posix.join(STEP_DIR_BY_NUMBER[6], "00_粗剪顺序表.md");
const TABLE_BLOCK_NAME = "粗剪顺序";
const MANUAL_BLOCK_NAME = "调整记录";

/** 镜头稳定身份的人读写法（表格「镜头」列，也是行的匹配键）。 */
export function roughCutShotKey(shot: { sceneId: string; groupId: string; shotId: string }): string {
  return sceneDirectoryName(shot.sceneId) + "/" + shotGroupDirectoryName(shot.groupId) + "/" + shot.shotId.replace(/^shot-/u, "镜头-");
}

export interface RoughCutRow {
  /** 成片顺序（1 起；文件中可手改，刷新按镜头身份保留）。 */
  cutOrder: number;
  /** 内容树观看顺序（watchOrder ?? shotNumber）。 */
  watchOrder: number;
  shotKey: string;
  storyboardNames: string[];
  /** 当前选用的视频文件名；缺素材时 null。 */
  videoFile: string | null;
  /**
   * 选用的素材记录身份（运行时携带，不写入顺序表）。
   *
   * 已下载文件的取径口径以记录身份为唯一标准（与素材记录自检同源）：
   * 文件放在 outputs/video/<记录对象编号>/ 下，不按镜头内部编号另找一路径。
   */
  videoIdentity: MediaIdentity | null;
  /** 选用状态：accepted=已审可用；unreviewed=未审试用；missing=缺素材（含已审不可用）。 */
  availability: "accepted" | "unreviewed" | "missing";
  /** 探测到的视频时长（秒）；未知为 undefined。 */
  durationSeconds: number | undefined;
  /** 成片起止（秒；按当前成片顺序累计，缺素材段不计长）。 */
  startSeconds: number | undefined;
  endSeconds: number | undefined;
}

export interface RoughCutPlanResult {
  ok: boolean;
  mode: ContentMode;
  rows: RoughCutRow[];
  issues: VerificationIssue[];
}

function shotLabelOf(shotId: string): string {
  return shotId.replace(/^shot-/u, "镜头-");
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return String(minutes).padStart(2, "0") + ":" + seconds.toFixed(1).padStart(4, "0");
}

/** 读取一个镜头的视频选用信息；无记录/无候选返回 null。 */
function currentVideoForShot(
  records: Map<string, MediaRecord>,
  shot: { shotId: string }
): { record: MediaRecord; file: string; accepted: boolean } | null {
  const key = mediaIdentityCanonicalKey({ category: "video", objectId: shot.shotId, purpose: videoPurpose });
  const record = records.get(key);
  if (!record) return null;
  const candidate = primaryMediaCandidate(record);
  if (!candidate) return null;
  return { record, file: candidate.fileName, accepted: candidate.reviewStatus === "accepted" };
}

/** 从内容树与素材记录构建顺序表行（默认按观看顺序，起止未累计）。 */
export async function buildRoughCutRows(projectRoot: string): Promise<{ rows: RoughCutRow[]; issues: VerificationIssue[] }> {
  const issues: VerificationIssue[] = [];
  const tree = await buildContentTree(projectRoot);
  issues.push(...tree.issues);
  const records = new Map<string, MediaRecord>();
  for (const record of await listMediaRecords(projectRoot)) {
    records.set(mediaIdentityCanonicalKey(record.identity), record);
  }

  const rows: RoughCutRow[] = orderedShots(tree).map((shot) => {
    const current = currentVideoForShot(records, shot);
    let availability: RoughCutRow["availability"] = "missing";
    let videoFile: string | null = null;
    // 取径与素材记录自检同源：按记录身份（如 镜头-001）拼目录，不再按镜头内部编号（shot-001）另找一路径。
    let videoIdentity: MediaIdentity | null = null;
    let durationSeconds: number | undefined;
    if (current === null) {
      // 无素材记录或无候选：缺素材。
    } else if (current.accepted) {
      availability = "accepted";
      videoFile = current.file;
      videoIdentity = current.record.identity;
    } else {
      const currentCandidate = primaryMediaCandidate(current.record)!;
      if (currentCandidate.reviewStatus === "rejected") {
        // 当前选用已审不可用：算缺素材。
      } else if (current.record.candidates.some((candidate) => candidate.reviewStatus === "accepted")) {
        // 有已审候选但当前选用的不是它：提示换选，不当「未审试用」。
        availability = "missing";
      } else {
        // 当前选用未审：用户要求试用时可见，标注不改审核状态。
        availability = "unreviewed";
        videoFile = current.file;
        videoIdentity = current.record.identity;
      }
    }
    if (videoFile !== null && videoIdentity !== null) {
      const absPath = path.join(projectRoot, mediaOutputDirectory(videoIdentity), videoFile);
      durationSeconds = mediaDurationSeconds(absPath);
    }
    return {
      cutOrder: 0,
      watchOrder: shot.document.watchOrder ?? shot.document.shotNumber,
      shotKey: roughCutShotKey(shot),
      storyboardNames: shot.storyboards.map((storyboard) => storyboard.document.storyboardId.replace(/^storyboard-/u, "分镜-")),
      videoFile,
      videoIdentity,
      availability,
      durationSeconds,
      startSeconds: undefined,
      endSeconds: undefined
    };
  });
  return { rows, issues };
}

function assignCutOrders(rows: RoughCutRow[], ordersByKey: Map<string, number>): RoughCutRow[] {
  let nextOrder = 1;
  const ordered = [...rows];
  // 先按旧表保留的手改顺序排，没有旧值的镜头按观看顺序接在后面。
  const withOld = ordered.filter((row) => ordersByKey.has(row.shotKey));
  const withoutOld = ordered.filter((row) => !ordersByKey.has(row.shotKey));
  withOld.sort((left, right) => (ordersByKey.get(left.shotKey) ?? 0) - (ordersByKey.get(right.shotKey) ?? 0));
  withoutOld.sort((left, right) => left.watchOrder - right.watchOrder || left.shotKey.localeCompare(right.shotKey));
  for (const row of [...withOld, ...withoutOld]) {
    row.cutOrder = ordersByKey.get(row.shotKey) ?? nextOrder;
    nextOrder += 1;
  }
  // 保证最终编号连续：按 cutOrder 排序后重编（手改跳号、重复在这里归一）。
  withOld.concat(withoutOld)
    .sort((left, right) => left.cutOrder - right.cutOrder)
    .forEach((row, index) => {
      row.cutOrder = index + 1;
    });
  return [...rows].sort((left, right) => left.cutOrder - right.cutOrder);
}

function accumulateTimeline(rows: RoughCutRow[]): void {
  let cursor = 0;
  for (const row of rows) {
    if (row.videoFile !== null && row.durationSeconds !== undefined) {
      row.startSeconds = cursor;
      row.endSeconds = cursor + row.durationSeconds;
      cursor = row.endSeconds;
    } else {
      row.startSeconds = undefined;
      row.endSeconds = undefined;
    }
  }
}

function renderRow(row: RoughCutRow): string {
  const status =
    row.availability === "accepted"
      ? "✅ 可用"
      : row.availability === "unreviewed"
        ? "⚠️ 未审试用（不改审核状态）"
        : "❌ 缺素材";
  const version = row.videoFile ?? "—";
  const duration = row.durationSeconds !== undefined ? row.durationSeconds.toFixed(1) + " 秒" : row.videoFile !== null ? "未知" : "—";
  const timeline = row.startSeconds !== undefined && row.endSeconds !== undefined ? formatClock(row.startSeconds) + " – " + formatClock(row.endSeconds) : "—";
  return (
    "| " +
    [String(row.cutOrder), String(row.watchOrder), row.shotKey, row.storyboardNames.join("、") || "—", version, duration, timeline, status].join(" | ") +
    " |"
  );
}

const TABLE_HEADER =
  "| 成片顺序 | 观看顺序 | 镜头 | 分镜 | 选用版本 | 时长 | 成片起止 | 状态 |\n| --- | --- | --- | --- | --- | --- | --- | --- |";

function renderPlanDocument(rows: RoughCutRow[]): string {
  const table = [TABLE_HEADER, ...rows.map(renderRow)].join("\n");
  const header = [
    "# 粗剪顺序表",
    "",
    "> 本表由 `roughcut plan` 生成，是命令行工作流的顺序与选用记录（桌面 App 不读它，桌面排序仍存应用内部数据）。",
    "> 只从「当前选用且人工已审可用」的版本读入；「⚠️ 未审试用」表示用户要求试用未审版本，不改变素材记录的审核状态；「❌ 缺素材」的镜头在素材包与草稿中占位但不含素材。",
    "> 「成片顺序」列可以直接手改数字调整顺序（缺素材段不计入起止时长）；改完请跑 `roughcut plan --check --project <项目路径>` 校验。",
    ""
  ];
  return header.join("\n") + renderAutoBlock(TABLE_BLOCK_NAME, table) + "\n" + renderManualBlock(MANUAL_BLOCK_NAME, "（这里记录调整原因，例如为什么换版本、为什么改顺序；工具刷新不会覆盖本区块。）") + "\n";
}

/** 从既有顺序表读「镜头 → 成片顺序」与既有选用文件名（用于校验）。 */
export async function readRoughCutTableRows(
  projectRoot: string
): Promise<{ cutOrders: Map<string, number>; files: Map<string, string | null>; raw: string } | null> {
  const absPath = path.join(projectRoot, ROUGH_CUT_PLAN_FILE);
  if (!(await fs.pathExists(absPath))) return null;
  const raw = await fs.readFile(absPath, "utf8");
  const body = getContentBlockBody(raw, TABLE_BLOCK_NAME);
  if (body === null) return null;
  const cutOrders = new Map<string, number>();
  const files = new Map<string, string | null>();
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || trimmed.includes("---")) continue;
    const cells = trimmed.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 8 || cells[2] === "镜头") continue;
    const cutOrder = Number.parseInt(cells[0] ?? "", 10);
    if (!Number.isFinite(cutOrder)) continue;
    const shotKey = cells[2] ?? "";
    cutOrders.set(shotKey, cutOrder);
    files.set(shotKey, cells[4] === "—" ? null : cells[4]);
  }
  return { cutOrders, files, raw };
}

/**
 * 生成或刷新顺序表：按镜头身份保留人工改过的成片顺序，版本与状态按素材记录当前值更新。
 */
export async function refreshRoughCutPlan(projectRoot: string): Promise<RoughCutPlanResult> {
  const issues: VerificationIssue[] = [];
  const resolution = await resolveContentMode(projectRoot);
  if (resolution.mode !== "content-tree" || !resolution.contentRootExists) {
    return { ok: false, mode: resolution.mode, rows: [], issues: resolution.issues };
  }
  issues.push(...resolution.issues);
  const { rows } = await buildRoughCutRows(projectRoot);
  const existing = await readRoughCutTableRows(projectRoot);
  const ordered = assignCutOrders(rows, existing?.cutOrders ?? new Map());
  accumulateTimeline(ordered);

  const absPath = path.join(projectRoot, ROUGH_CUT_PLAN_FILE);
  const document = renderPlanDocument(ordered);
  if (existing !== null && existing.raw.includes(`avw:auto:start name=${TABLE_BLOCK_NAME}`)) {
    const replaced = replaceContentBlockBody(existing.raw, TABLE_BLOCK_NAME, tableBody(ordered));
    if (replaced !== null) {
      await fs.outputFile(absPath, replaced, "utf8");
      return { ok: issues.length === 0, mode: resolution.mode, rows: ordered, issues };
    }
  }
  await fs.outputFile(absPath, document, "utf8");
  return { ok: issues.length === 0, mode: resolution.mode, rows: ordered, issues };
}

function tableBody(rows: RoughCutRow[]): string {
  return [TABLE_HEADER, ...rows.map(renderRow)].join("\n") + "\n";
}

/** 校验已有序顺序表：行完整、顺序连续、选用版本与素材记录一致。只读不写。 */
export async function checkRoughCutPlan(projectRoot: string): Promise<RoughCutPlanResult> {
  const issues: VerificationIssue[] = [];
  const resolution = await resolveContentMode(projectRoot);
  if (resolution.mode !== "content-tree" || !resolution.contentRootExists) {
    return { ok: false, mode: resolution.mode, rows: [], issues: resolution.issues };
  }
  const existing = await readRoughCutTableRows(projectRoot);
  if (existing === null) {
    issues.push({
      code: "roughcut-plan-mismatch",
      message: "缺少「" + ROUGH_CUT_PLAN_FILE + "」；请先跑 `roughcut plan --project <项目路径>` 生成顺序表。",
      path: ROUGH_CUT_PLAN_FILE
    });
    return { ok: false, mode: resolution.mode, rows: [], issues };
  }
  const { rows } = await buildRoughCutRows(projectRoot);
  const treeShots = new Set(rows.map((row) => row.shotKey));
  for (const shotKey of existing.cutOrders.keys()) {
    if (!treeShots.has(shotKey)) {
      issues.push({
        code: "roughcut-plan-mismatch",
        message: "顺序表里的「" + shotKey + "」不在当前内容树中；请刷新顺序表（roughcut plan），不要手写不存在的镜头。",
        path: ROUGH_CUT_PLAN_FILE
      });
    }
  }
  for (const row of rows) {
    if (!existing.cutOrders.has(row.shotKey)) {
      issues.push({
        code: "roughcut-plan-mismatch",
        message: "顺序表缺少镜头「" + row.shotKey + "」；请刷新顺序表（roughcut plan）补行，不要让镜头悄悄缺席。",
        path: ROUGH_CUT_PLAN_FILE
      });
    }
  }
  const orders = [...existing.cutOrders.values()];
  const sorted = [...orders].sort((left, right) => left - right);
  const expected = Array.from({ length: orders.length }, (_, index) => index + 1);
  if (sorted.join(",") !== expected.join(",")) {
    issues.push({
      code: "roughcut-plan-mismatch",
      message: "「成片顺序」列应是从 1 开始的连续编号，当前为：" + orders.slice().sort((a, b) => a - b).join("、") + "；请修正或刷新顺序表。",
      path: ROUGH_CUT_PLAN_FILE
    });
  }
  // 选用版本与素材记录比对：不同说明素材记录已变（换选/新版本），顺序表需要刷新。
  const byKey = new Map(rows.map((row) => [row.shotKey, row]));
  for (const [shotKey, file] of existing.files) {
    const current = byKey.get(shotKey);
    if (!current) continue;
    if ((current.videoFile ?? null) !== file) {
      issues.push({
        code: "roughcut-plan-mismatch",
        message:
          "镜头「" + shotKey + "」的选用版本已从「" + (file ?? "—") + "」变为「" + (current.videoFile ?? "—") +
          "」（素材记录为当前事实）；请刷新顺序表（roughcut plan），素材更换后旧粗剪按快照追溯、不会被静默更新。",
        path: ROUGH_CUT_PLAN_FILE
      });
    }
  }
  // 以表内顺序重排并累计起止，作为校验时的展示数据返回。
  const orderedRows = rows
    .map((row) => ({ ...row, cutOrder: existing.cutOrders.get(row.shotKey) ?? Number.MAX_SAFE_INTEGER }))
    .sort((left, right) => left.cutOrder - right.cutOrder)
    .map((row, index) => ({ ...row, cutOrder: index + 1 }));
  accumulateTimeline(orderedRows);
  for (const row of orderedRows) {
    if (row.availability === "missing") {
      // 缺素材是有意占位（用户已在顺序表确认），单独的码：素材包导出放行、清单里标缺。
      issues.push({
        code: "roughcut-missing-material",
        message: "镜头「" + row.shotKey + "」缺素材（当前选用不是已审可用的视频）；已按占位记录，交付时将明确标缺，不会偷偷换版本。",
        path: ROUGH_CUT_PLAN_FILE
      });
    }
  }
  return { ok: issues.length === 0, mode: resolution.mode, rows: orderedRows, issues };
}

/** 顺序表的可读摘要（命令行输出用）。 */
export function renderRoughCutSummary(result: RoughCutPlanResult): string {  const lines: string[] = [];
  lines.push("粗剪顺序表（" + ROUGH_CUT_PLAN_FILE + "）");
  for (const row of result.rows) {
    const status = row.availability === "accepted" ? "可用" : row.availability === "unreviewed" ? "未审试用" : "缺素材";
    const timeline = row.startSeconds !== undefined && row.endSeconds !== undefined ? formatClock(row.startSeconds) + "–" + formatClock(row.endSeconds) : "—";
    lines.push(
      "  " + String(row.cutOrder).padStart(2, " ") + ". " + row.shotKey + "｜" + (row.videoFile ?? "缺素材") + "｜" + timeline + "｜" + status
    );
  }
  if (result.issues.length > 0) {
    lines.push("  需要注意 " + String(result.issues.length) + " 条：");
    for (const issue of result.issues) {
      lines.push("  ! [" + issue.code + "] " + issue.message);
    }
  } else {
    lines.push("  校验通过：镜头齐全、顺序连续、选用版本与素材记录一致。");
  }
  return lines.join("\n");
}

/* ------------------------------ D2：素材包导出 ------------------------------ */

export const MEDIA_PACK_MANIFEST_FILE = "00_素材包清单.md";

export interface MediaPackSegment {
  directoryName: string;
  row: RoughCutRow;
  /** 复制进片段目录的文件名；缺素材段为空。 */
  copiedFiles: string[];
}

export interface MediaPackResult {
  ok: boolean;
  outDir: string;
  segments: MediaPackSegment[];
  manifestPath: string;
  /** 粗剪顺序说明（D3 受阻时的手工搭建退路交付物）。 */
  instructionsPath: string;
  issues: VerificationIssue[];
}

/** 片段目录名：成片顺序两位编号 + 镜头目录名（稳定身份），缺素材段加后缀。 */
export function mediaPackSegmentDirectoryName(row: RoughCutRow): string {
  return String(row.cutOrder).padStart(2, "0") + "_" + (row.shotKey.split("/")[2] ?? row.shotKey) + (row.availability === "missing" ? "_缺素材" : "");
}

/**
 * 导出素材包（D2）：按顺序表把「顺序定稿那一刻」的当前选用版本复制成
 * 成片顺序编号的片段子文件夹，顶层附清单。只读动作：只新增文件，
 * 不移动、不改名、不改写项目里的创作正文与素材记录；同名冲突先列出、绝不覆盖。
 */
export async function exportMediaPack(projectRoot: string, outDir: string): Promise<MediaPackResult> {
  const issues: VerificationIssue[] = [];
  const checked = await checkRoughCutPlan(projectRoot);
  const blocking = checked.issues.filter((issue) => issue.code === "roughcut-plan-mismatch");
  if (blocking.length > 0) {
    return {
      ok: false,
      outDir,
      segments: [],
      manifestPath: path.join(outDir, MEDIA_PACK_MANIFEST_FILE),
      instructionsPath: path.join(outDir, "01_粗剪顺序说明.md"),
      issues: blocking
    };
  }

  // 同名冲突先列出：清单与任何片段目录已存在即拒绝，绝不覆盖。
  const conflicts: string[] = [];
  const manifestPath = path.join(outDir, MEDIA_PACK_MANIFEST_FILE);
  if (await fs.pathExists(manifestPath)) conflicts.push(MEDIA_PACK_MANIFEST_FILE);
  const planned = checked.rows.map((row) => ({ row, directoryName: mediaPackSegmentDirectoryName(row) }));
  for (const segment of planned) {
    if (await fs.pathExists(path.join(outDir, segment.directoryName))) conflicts.push(segment.directoryName + "/");
  }
  if (conflicts.length > 0) {
    issues.push({
      code: "media-pack-conflict",
      message: "导出目录「" + outDir + "」里已存在同名内容：" + conflicts.join("、") + "；为不覆盖任何已有文件，本次未导出。请换一个目录或先人工清理。",
      path: outDir
    });
    return { ok: false, outDir, segments: [], manifestPath, instructionsPath: path.join(outDir, "01_粗剪顺序说明.md"), issues };
  }

  await fs.ensureDir(outDir);
  const segments: MediaPackSegment[] = [];
  for (const segment of planned) {
    const row = segment.row;
    const segmentDir = path.join(outDir, segment.directoryName);
    await fs.ensureDir(segmentDir);
    const copiedFiles: string[] = [];
    if (row.videoFile !== null) {
      // 与素材记录自检同源：优先用行上携带的记录身份取径；缺失时按 shotKey 的人读编号（镜头-NNN）回退。
      const fallbackObjectId = row.shotKey.split("/")[2] ?? row.shotKey;
      const identity =
        row.videoIdentity ?? { category: "video" as const, objectId: fallbackObjectId, purpose: videoPurpose };
      const source = path.join(projectRoot, mediaOutputDirectory(identity), row.videoFile);
      if (await fs.pathExists(source)) {
        await fs.copy(source, path.join(segmentDir, row.videoFile));
        copiedFiles.push(row.videoFile);
      } else {
        issues.push({
          code: "media-pack-conflict",
          message: "镜头「" + row.shotKey + "」的选用文件「" + row.videoFile + "」在项目里不存在（" + mediaOutputDirectory(identity) + "）；片段目录已建并写入缺文件说明。",
          path: segment.directoryName
        });
      }
    }
    if (copiedFiles.length === 0) {
      await fs.writeFile(
        path.join(segmentDir, "缺素材说明.md"),
        [
          "# 缺素材说明",
          "",
          "- 镜头：" + row.shotKey,
          "- 分镜：" + (row.storyboardNames.join("、") || "—"),
          "- 状态：顺序表确认时明确标缺（当前选用不是已审可用的视频）。",
          "- 处理：本片段在素材包与草稿中占位；不偷偷换用其他版本，补齐素材后请刷新顺序表并重新导出。",
          ""
        ].join("\n"),
        "utf8"
      );
    }
    segments.push({ directoryName: segment.directoryName, row, copiedFiles });
  }

  const manifest = renderMediaPackManifest(checked.rows, segments);
  await fs.writeFile(manifestPath, manifest, "utf8");
  const instructionsPath = path.join(outDir, "01_粗剪顺序说明.md");
  await fs.writeFile(instructionsPath, renderRoughCutInstructions(segments), "utf8");
  return { ok: true, outDir, segments, manifestPath, instructionsPath, issues };
}

/**
 * 粗剪顺序说明（D3 受阻时的退路交付物）：拿着素材包在剪映里手工搭建时照着做。
 * 只描述顺序、时长与素材文件，不代做任何剪映操作；产物按未定稿材料对待（D-365）。
 */
function renderRoughCutInstructions(segments: MediaPackSegment[]): string {
  const lines: string[] = [
    "# 粗剪顺序说明",
    "",
    "> 这份说明配合本素材包使用：在剪映里新建一个空草稿，按下面的顺序把各片段文件夹里的视频依次拖上时间轴。",
    "> 本产物是未定稿的粗剪材料：缺素材段用占位并保留标记，不要把粗剪当定稿使用或宣传。",
    "",
    "## 搭建步骤",
    "",
    "1. 剪映新建草稿（建议命名带日期，例如「粗剪-<日期>」）。",
    "2. 按下表的顺序，把每个片段文件夹里的视频文件导入并拖上时间轴；视频自带原声保留，不要静音。",
    "3. 「❌ 缺素材」的片段没有视频：在对应位置放一个占位（剪映素材库的黑色场或颜色卡），时长按分镜预期目测掌握，并保留片段文件夹里的「缺素材说明.md」备查。",
    "4. 需要对白/字幕时再另行添加——本包没有对白音频与字幕记录，清单里已如实标注。",
    "5. 剪完先自查：顺序与本表一致、总时长接近「成片起止」合计、缺素材段保持占位标记。",
    "",
    "## 顺序与时长",
    "",
    "| 顺序 | 片段文件夹 | 镜头 | 视频文件 | 时长 | 成片起止 | 状态 |",
    "| --- | --- | --- | --- | --- | --- | --- |"
  ];
  let cursor = 0;
  for (const segment of segments) {
    const row = segment.row;
    const timeline =
      row.startSeconds !== undefined && row.endSeconds !== undefined
        ? formatClock(row.startSeconds) + " – " + formatClock(row.endSeconds)
        : "—";
    lines.push(
      "| " +
        [
          String(row.cutOrder),
          segment.directoryName + "/",
          row.shotKey,
          row.videoFile ?? "（缺素材，用占位）",
          row.durationSeconds !== undefined ? row.durationSeconds.toFixed(1) + " 秒" : "—",
          timeline,
          row.availability === "accepted" ? "✅ 已审可用" : row.availability === "unreviewed" ? "⚠️ 未审试用" : "❌ 缺素材"
        ].join(" | ") +
        " |"
    );
    if (row.endSeconds !== undefined) cursor = row.endSeconds;
  }
  lines.push("");
  lines.push("全部可用片段合计约 " + cursor.toFixed(1) + " 秒（不含缺素材占位）。");
  lines.push("");
  return lines.join("\n");
}

/** 从镜头键取对象编号：场-001/镜头组-001/镜头-002 → shot-002。 */
export function rowShotObjectId(shotKey: string): string {
  const shotDirectoryName = shotKey.split("/")[2] ?? shotKey;
  const digits = shotDirectoryName.replace(/^镜头-?/u, "").padStart(3, "0");
  return "shot-" + digits;
}

function renderMediaPackManifest(rows: RoughCutRow[], segments: MediaPackSegment[]): string {
  const lines: string[] = [
    "# 素材包清单",
    "",
    "> 本包是粗剪顺序定稿那一刻的只读快照：只装当时的当前选用版本；之后素材记录再换选用，本包不自动更新、也不标记过期。",
    "> 原始素材仍按稳定镜头编号保存在项目里；本包内的片段只按成片顺序编号。对白音频与字幕当前没有记录载体，如实标注「无记录」。",
    "",
    "| 片段 | 来源镜头 | 分镜 | 文件版本 | 对白/字幕 | 时长与成片起止 | 状态 | 检查状态 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |"
  ];
  for (const segment of segments) {
    const row = segment.row;
    const status = row.availability === "accepted" ? "✅ 已审可用" : row.availability === "unreviewed" ? "⚠️ 未审试用" : "❌ 缺素材";
    const timeline =
      row.startSeconds !== undefined && row.endSeconds !== undefined
        ? row.durationSeconds?.toFixed(1) + " 秒（" + formatClock(row.startSeconds) + " – " + formatClock(row.endSeconds) + "）"
        : "—";
    lines.push(
      "| " +
        [
          segment.directoryName + "/",
          row.shotKey,
          row.storyboardNames.join("、") || "—",
          row.videoFile ?? "—",
          "无记录",
          timeline,
          status,
          status === "✅ 已审可用" ? "通过" : "已按占位/试用标注"
        ].join(" | ") +
        " |"
    );
  }
  lines.push("");
  return lines.join("\n");
}
