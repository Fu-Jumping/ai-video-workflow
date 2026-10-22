/**
 * 素材库备份与迁移（B6）。
 *
 * 目标：把一个项目里与素材相关的内容原样搬到另一个目录（换电脑／整目录搬迁），
 * 并在还原后能证明“每个文件的字节与 sha256 与清单一致、素材记录里的引用仍然有效”。
 *
 * 约定（沿用 media-records.ts）：
 * - 备份产物是目录树，不是压缩包；清单文件 备份清单.json 逐文件记录相对路径、字节数、sha256。
 * - 缓存、依赖、临时目录、IDE 私有目录与任何凭证类文件一律不进备份。
 * - 不联网、不调用任何平台、不消耗生成额度。
 */

import fs from "fs-extra";
import path from "node:path";

import {
  assetLibraryDirectory,
  describeMediaFile,
  mediaOutputDirectory,
  mediaRecordsDirectory,
  outputsDirectory,
  parseMediaRecord,
  workRecordsDirectory
} from "./media-records.js";

/** 清单文件名，放在备份目录根部。 */
export const backupManifestFileName = "备份清单.json";

/** 清单格式标识，用来拒绝不认识的文件。 */
export const backupFormatId = "avw-media-backup";

export const backupManifestSchemaVersion = 1;

export const projectConfigFileName = "project.config.yaml";

/** 参与备份的根条目：素材库、产出、素材记录、工作记录、项目配置。 */
export const backupRootEntries: readonly string[] = [
  assetLibraryDirectory,
  outputsDirectory,
  mediaRecordsDirectory,
  workRecordsDirectory,
  projectConfigFileName
];

/** 硬要求：这些目录名在任何层级都不进备份。 */
export const backupExcludedDirectoryNames: readonly string[] = [
  ".libtv",
  "node_modules",
  "dist",
  ".tmp",
  "tmp",
  "_views",
  ".obsidian",
  "coverage",
  ".git"
];

/** 硬要求：凭证／密钥类文件不进备份（按文件名判断）。 */
export const backupCredentialNamePatterns: readonly RegExp[] = [
  /^\.env(?:\.|$)/iu,
  /credential/iu,
  /secret/iu,
  /token/iu,
  /passw(?:or)?d/iu,
  /api[-_.]?key/iu,
  /^id_(?:rsa|dsa|ecdsa|ed25519)/iu,
  /\.(?:pem|key|pfx|p12|jks)$/iu
];

export function isBackupExcludedSegment(segment: string): boolean {
  if (backupExcludedDirectoryNames.includes(segment)) return true;
  return backupCredentialNamePatterns.some((pattern) => pattern.test(segment));
}

/** 相对路径里任何一段命中排除规则，整条路径都不进备份。 */
export function isBackupExcludedRelativePath(relativePath: string): boolean {
  return relativePath
    .split(/[\\/]+/u)
    .filter((segment) => segment.length > 0)
    .some(isBackupExcludedSegment);
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function compareName(left: { name: string }, right: { name: string }): number {
  return compareText(left.name, right.name);
}

/** child 是否就是 parent 或在 parent 之下。 */
function isInsideDirectory(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export interface BackupScanEntry {
  /** 相对项目根目录的路径，统一用 / 分隔。 */
  relativePath: string;
  bytes: number;
  sha256: string;
}

export interface BackupScanResult {
  entries: BackupScanEntry[];
  /** 被排除规则挡下的相对路径（目录以 / 结尾）。 */
  excluded: string[];
  /** 应该备份但源项目里不存在的根条目。 */
  missingRoots: string[];
  /** 符号链接、设备文件等不参与备份的条目。 */
  skipped: string[];
}

/**
 * 扫描项目里需要备份的文件，逐个算出字节数与 sha256。
 * 空项目（一个根条目都没有）返回空清单，不报错。
 */
export async function scanBackupEntries(
  projectRoot: string,
  options: { roots?: readonly string[] } = {}
): Promise<BackupScanResult> {
  const roots = options.roots ?? backupRootEntries;
  const entries: BackupScanEntry[] = [];
  const excluded: string[] = [];
  const missingRoots: string[] = [];
  const skipped: string[] = [];

  async function walkDirectory(absoluteDirectory: string, relativeDirectory: string): Promise<void> {
    const children = await fs.readdir(absoluteDirectory, { withFileTypes: true });
    children.sort(compareName);
    for (const child of children) {
      const relativePath = relativeDirectory + "/" + child.name;
      if (isBackupExcludedSegment(child.name)) {
        excluded.push(child.isDirectory() ? relativePath + "/" : relativePath);
        continue;
      }
      const absolutePath = path.join(absoluteDirectory, child.name);
      if (child.isDirectory()) {
        await walkDirectory(absolutePath, relativePath);
        continue;
      }
      if (!child.isFile()) {
        skipped.push(relativePath);
        continue;
      }
      const described = await describeMediaFile(absolutePath);
      if (!described) {
        skipped.push(relativePath);
        continue;
      }
      entries.push({ relativePath, bytes: described.bytes, sha256: described.sha256 });
    }
  }

  for (const root of roots) {
    const absoluteRoot = path.join(projectRoot, root);
    if (!(await fs.pathExists(absoluteRoot))) {
      missingRoots.push(root);
      continue;
    }
    const stat = await fs.stat(absoluteRoot);
    if (stat.isDirectory()) {
      await walkDirectory(absoluteRoot, root);
      continue;
    }
    const described = await describeMediaFile(absoluteRoot);
    if (described) {
      entries.push({ relativePath: root, bytes: described.bytes, sha256: described.sha256 });
    } else {
      skipped.push(root);
    }
  }

  entries.sort((left, right) => compareText(left.relativePath, right.relativePath));
  excluded.sort(compareText);
  skipped.sort(compareText);
  return { entries, excluded, missingRoots, skipped };
}

export interface MediaBackupManifest {
  format: string;
  schemaVersion: number;
  createdAt: string;
  /** 备份时的项目绝对目录，还原时用来改写记录里的绝对路径。 */
  sourceProjectRoot: string;
  entries: BackupScanEntry[];
  excluded: string[];
  totalBytes: number;
}

export function renderBackupManifest(manifest: MediaBackupManifest): string {
  const payload = {
    备份格式: manifest.format,
    清单版本: manifest.schemaVersion,
    生成时间: manifest.createdAt,
    源项目目录: manifest.sourceProjectRoot,
    文件数: manifest.entries.length,
    总字节: manifest.totalBytes,
    说明: "相对路径以项目根目录为基准、统一用 / 分隔；sha256 用于还原后逐文件校验。",
    文件: manifest.entries.map((entry) => ({
      相对路径: entry.relativePath,
      字节: entry.bytes,
      sha256: entry.sha256
    })),
    已排除: manifest.excluded
  };
  return JSON.stringify(payload, null, 2) + "\n";
}

function manifestText(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

function manifestNumber(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function parseBackupManifest(text: string): MediaBackupManifest | undefined {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const record = data as Record<string, unknown>;
  if (manifestText(record, "备份格式") !== backupFormatId) return undefined;

  const rawFiles = Array.isArray(record["文件"]) ? record["文件"] : [];
  const entries: BackupScanEntry[] = [];
  for (const item of rawFiles) {
    if (!item || typeof item !== "object") continue;
    const file = item as Record<string, unknown>;
    const relativePath = manifestText(file, "相对路径");
    const bytes = manifestNumber(file, "字节");
    const sha256 = manifestText(file, "sha256");
    if (!relativePath || bytes === undefined || !sha256) continue;
    entries.push({ relativePath, bytes, sha256 });
  }

  const rawExcluded = Array.isArray(record["已排除"]) ? record["已排除"] : [];
  const excluded: string[] = [];
  for (const item of rawExcluded) {
    if (typeof item === "string" && item.trim()) excluded.push(item.trim());
  }

  const totalBytes =
    manifestNumber(record, "总字节") ?? entries.reduce((sum, entry) => sum + entry.bytes, 0);

  return {
    format: backupFormatId,
    schemaVersion: manifestNumber(record, "清单版本") ?? backupManifestSchemaVersion,
    createdAt: manifestText(record, "生成时间") ?? "",
    sourceProjectRoot: manifestText(record, "源项目目录") ?? "",
    entries,
    excluded,
    totalBytes
  };
}

export async function readBackupManifest(backupRoot: string): Promise<MediaBackupManifest | undefined> {
  const manifestPath = path.join(backupRoot, backupManifestFileName);
  if (!(await fs.pathExists(manifestPath))) return undefined;
  return parseBackupManifest(await fs.readFile(manifestPath, "utf8"));
}

export interface CreateMediaBackupOptions {
  roots?: readonly string[];
  /** 便于测试固定生成时间。 */
  now?: Date;
}

export interface CreateMediaBackupResult {
  backupRoot: string;
  manifestPath: string;
  manifest: MediaBackupManifest;
  missingRoots: string[];
  excluded: string[];
  skipped: string[];
}

/**
 * 把一个项目的素材相关内容复制到 backupRoot，并写清单。
 * 备份目录不能放在项目里，也不能包含项目，避免自己复制自己。
 */
export async function createMediaBackup(
  projectRoot: string,
  backupRoot: string,
  options: CreateMediaBackupOptions = {}
): Promise<CreateMediaBackupResult> {
  const sourceRoot = path.resolve(projectRoot);
  const targetRoot = path.resolve(backupRoot);
  if (!(await fs.pathExists(sourceRoot))) {
    throw new Error("源项目目录不存在：" + sourceRoot);
  }
  if (isInsideDirectory(targetRoot, sourceRoot) || isInsideDirectory(sourceRoot, targetRoot)) {
    throw new Error("备份目录不能放在源项目目录里，也不能包含源项目目录：" + targetRoot);
  }

  const scan = await scanBackupEntries(sourceRoot, { roots: options.roots });
  const manifest: MediaBackupManifest = {
    format: backupFormatId,
    schemaVersion: backupManifestSchemaVersion,
    createdAt: (options.now ?? new Date()).toISOString(),
    sourceProjectRoot: sourceRoot,
    entries: scan.entries,
    excluded: scan.excluded,
    totalBytes: scan.entries.reduce((sum, entry) => sum + entry.bytes, 0)
  };

  for (const entry of scan.entries) {
    const destination = path.join(targetRoot, entry.relativePath);
    await fs.ensureDir(path.dirname(destination));
    await fs.copyFile(path.join(sourceRoot, entry.relativePath), destination);
  }

  await fs.ensureDir(targetRoot);
  const manifestPath = path.join(targetRoot, backupManifestFileName);
  await fs.writeFile(manifestPath, renderBackupManifest(manifest), "utf8");

  return {
    backupRoot: targetRoot,
    manifestPath,
    manifest,
    missingRoots: scan.missingRoots,
    excluded: scan.excluded,
    skipped: scan.skipped
  };
}

async function collectRelativeFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(absoluteDirectory: string, relativeDirectory: string): Promise<void> {
    const children = await fs.readdir(absoluteDirectory, { withFileTypes: true });
    children.sort(compareName);
    for (const child of children) {
      const relativePath = relativeDirectory ? relativeDirectory + "/" + child.name : child.name;
      const absolutePath = path.join(absoluteDirectory, child.name);
      if (child.isDirectory()) {
        await walk(absolutePath, relativePath);
        continue;
      }
      if (child.isFile()) files.push(relativePath);
    }
  }
  if (await fs.pathExists(root)) await walk(root, "");
  return files;
}

export type BackupIssueKind = "missing-manifest" | "missing" | "size-mismatch" | "hash-mismatch";

export interface BackupVerificationIssue {
  kind: BackupIssueKind;
  relativePath: string;
  message: string;
}

export interface BackupVerificationReport {
  backupRoot: string;
  manifestPath: string;
  manifest?: MediaBackupManifest;
  checked: number;
  issues: BackupVerificationIssue[];
  /** 清单里没有、但备份目录里多出来的文件。 */
  extraFiles: string[];
  lines: string[];
  ok: boolean;
}

/** 逐文件核对备份目录与清单：缺文件、字节数不符、哈希不符都单独列一条。 */
export async function verifyBackup(backupRoot: string): Promise<BackupVerificationReport> {
  const root = path.resolve(backupRoot);
  const manifestPath = path.join(root, backupManifestFileName);
  const issues: BackupVerificationIssue[] = [];
  const lines: string[] = [];

  const manifest = await readBackupManifest(root);
  if (!manifest) {
    issues.push({
      kind: "missing-manifest",
      relativePath: backupManifestFileName,
      message: "备份目录里没有可用的清单文件 " + backupManifestFileName + "，无法校验"
    });
    lines.push("备份清单：" + manifestPath + "（不存在或无法解析）");
    lines.push("结论：校验不通过，缺少清单文件");
    return {
      backupRoot: root,
      manifestPath,
      checked: 0,
      issues,
      extraFiles: [],
      lines,
      ok: false
    };
  }

  lines.push("备份清单：" + manifestPath);
  lines.push("清单记录：" + manifest.entries.length + " 个文件，共 " + manifest.totalBytes + " 字节");

  let checked = 0;
  for (const entry of manifest.entries) {
    checked += 1;
    const absolutePath = path.join(root, entry.relativePath);
    const described = await describeMediaFile(absolutePath);
    if (!described) {
      issues.push({
        kind: "missing",
        relativePath: entry.relativePath,
        message: "缺文件：" + entry.relativePath + "（清单有记录，备份里找不到）"
      });
      continue;
    }
    if (described.bytes !== entry.bytes) {
      issues.push({
        kind: "size-mismatch",
        relativePath: entry.relativePath,
        message:
          "字节数不符：" + entry.relativePath + "（清单 " + entry.bytes + "，实际 " + described.bytes + "）"
      });
      continue;
    }
    if (described.sha256 !== entry.sha256) {
      issues.push({
        kind: "hash-mismatch",
        relativePath: entry.relativePath,
        message:
          "哈希不符：" +
          entry.relativePath +
          "（清单 " +
          entry.sha256 +
          "，实际 " +
          described.sha256 +
          "）"
      });
    }
  }

  const manifestPaths = new Set(manifest.entries.map((entry) => entry.relativePath));
  const extraFiles = (await collectRelativeFiles(root)).filter(
    (relativePath) => relativePath !== backupManifestFileName && !manifestPaths.has(relativePath)
  );

  for (const issue of issues) {
    lines.push("[" + backupIssueKindLabels[issue.kind] + "] " + issue.message);
  }
  if (extraFiles.length > 0) {
    lines.push("提示：备份目录里有 " + extraFiles.length + " 个清单未记录的文件（不影响还原）");
    for (const relativePath of extraFiles) lines.push("  [额外文件] " + relativePath);
  }
  lines.push(
    issues.length === 0
      ? "结论：校验通过，" + checked + " 个文件与清单一致"
      : "结论：发现 " + issues.length + " 处问题，未通过校验"
  );

  return {
    backupRoot: root,
    manifestPath,
    manifest,
    checked,
    issues,
    extraFiles,
    lines,
    ok: issues.length === 0
  };
}

export const backupIssueKindLabels: Record<BackupIssueKind, string> = {
  "missing-manifest": "缺少清单",
  missing: "缺文件",
  "size-mismatch": "字节数不符",
  "hash-mismatch": "哈希不符"
};

export interface RestoreMediaBackupOptions {
  /** 默认 false：目标目录已有同名文件时跳过并逐条报告，不覆盖。 */
  allowOverwrite?: boolean;
  /** 默认 true：还原后把记录里指向旧位置的绝对路径改写成新位置。 */
  rewriteReferences?: boolean;
}

export interface RestoreReport {
  backupRoot: string;
  targetRoot: string;
  verification: BackupVerificationReport;
  /** 校验不通过时为 true，此时一个文件都不会写。 */
  aborted: boolean;
  restored: string[];
  skippedExisting: string[];
  rewrittenReferences: { relativePath: string; replacements: number }[];
  lines: string[];
  ok: boolean;
}

/**
 * 还原到另一个目录（模拟换电脑）。
 * 先校验再写：校验不通过直接中止，不做半截还原。
 */
export async function restoreMediaBackup(
  backupRoot: string,
  targetRoot: string,
  options: RestoreMediaBackupOptions = {}
): Promise<RestoreReport> {
  const sourceRoot = path.resolve(backupRoot);
  const destinationRoot = path.resolve(targetRoot);
  const allowOverwrite = options.allowOverwrite === true;
  const rewriteReferences = options.rewriteReferences !== false;

  if (sourceRoot === destinationRoot) {
    throw new Error("还原目标目录不能与备份目录相同：" + destinationRoot);
  }

  const verification = await verifyBackup(sourceRoot);
  const lines: string[] = [];
  lines.push("备份目录：" + sourceRoot);
  lines.push("还原到：" + destinationRoot);

  if (!verification.ok) {
    lines.push("还原前校验未通过，已中止，目标目录没有写入任何文件：");
    for (const issue of verification.issues) {
      lines.push("  [" + backupIssueKindLabels[issue.kind] + "] " + issue.message);
    }
    return {
      backupRoot: sourceRoot,
      targetRoot: destinationRoot,
      verification,
      aborted: true,
      restored: [],
      skippedExisting: [],
      rewrittenReferences: [],
      lines,
      ok: false
    };
  }

  const manifest = verification.manifest as MediaBackupManifest;
  const restored: string[] = [];
  const skippedExisting: string[] = [];

  for (const entry of manifest.entries) {
    const destination = path.join(destinationRoot, entry.relativePath);
    const source = path.join(sourceRoot, entry.relativePath);
    if (await fs.pathExists(destination)) {
      if (!allowOverwrite) {
        skippedExisting.push(entry.relativePath);
        continue;
      }
    }
    await fs.ensureDir(path.dirname(destination));
    await fs.copyFile(source, destination);
    restored.push(entry.relativePath);
  }

  const rewrittenReferences = rewriteReferences
    ? (await rewriteRestoredReferences(destinationRoot, [manifest.sourceProjectRoot], destinationRoot)).changed
    : [];

  lines.push("还原文件：" + restored.length + " 个");
  if (skippedExisting.length > 0) {
    lines.push(
      "已存在未覆盖：" + skippedExisting.length + " 个（默认不覆盖已有文件，需要覆盖请显式允许）"
    );
    for (const relativePath of skippedExisting) lines.push("  [已存在] " + relativePath);
  }
  if (rewrittenReferences.length > 0) {
    lines.push("改写引用：" + rewrittenReferences.length + " 份记录");
    for (const item of rewrittenReferences) {
      lines.push("  [已改写] " + item.relativePath + "（" + item.replacements + " 处）");
    }
  }
  lines.push(
    skippedExisting.length === 0
      ? "结论：还原完成，全部文件已写入"
      : "结论：还原完成，" + skippedExisting.length + " 个已存在文件保持原样"
  );

  return {
    backupRoot: sourceRoot,
    targetRoot: destinationRoot,
    verification,
    aborted: false,
    restored,
    skippedExisting,
    rewrittenReferences,
    lines,
    ok: true
  };
}

export interface ReferenceRewriteResult {
  scannedFiles: number;
  changed: { relativePath: string; replacements: number }[];
  lines: string[];
}

function replaceAllLiteral(content: string, from: string, to: string): { text: string; count: number } {
  if (!from || from === to) return { text: content, count: 0 };
  const parts = content.split(from);
  if (parts.length === 1) return { text: content, count: 0 };
  return { text: parts.join(to), count: parts.length - 1 };
}

/**
 * 把素材记录／工作记录里指向旧位置的绝对路径改写成新位置。
 * 相对路径不动（相对路径在搬目录后本来仍然有效）。
 */
export async function rewriteRestoredReferences(
  projectRoot: string,
  fromRoots: readonly string[],
  toRoot: string = projectRoot
): Promise<ReferenceRewriteResult> {
  const variants: { from: string; to: string }[] = [];
  const nativeTo = path.normalize(toRoot);
  const forwardTo = toRoot.replace(/\\/gu, "/");
  for (const fromRoot of fromRoots) {
    if (!fromRoot) continue;
    const nativeFrom = path.normalize(fromRoot);
    const forwardFrom = fromRoot.replace(/\\/gu, "/");
    if (nativeFrom !== nativeTo && nativeFrom.length > 3) {
      variants.push({ from: nativeFrom, to: nativeTo });
    }
    if (forwardFrom !== forwardTo && forwardFrom.length > 3) {
      variants.push({ from: forwardFrom, to: forwardTo });
    }
  }

  const scanned: string[] = [];
  for (const directory of [mediaRecordsDirectory, workRecordsDirectory]) {
    const absoluteDirectory = path.join(projectRoot, directory);
    if (!(await fs.pathExists(absoluteDirectory))) continue;
    for (const relativePath of await collectRelativeFiles(absoluteDirectory)) {
      if (!relativePath.toLowerCase().endsWith(".md")) continue;
      scanned.push(directory + "/" + relativePath);
    }
  }

  const changed: { relativePath: string; replacements: number }[] = [];
  for (const relativePath of scanned) {
    const absolutePath = path.join(projectRoot, relativePath);
    const original = await fs.readFile(absolutePath, "utf8");
    let text = original;
    let replacements = 0;
    for (const variant of variants) {
      const result = replaceAllLiteral(text, variant.from, variant.to);
      text = result.text;
      replacements += result.count;
    }
    if (replacements > 0 && text !== original) {
      await fs.writeFile(absolutePath, text, "utf8");
      changed.push({ relativePath, replacements });
    }
  }

  const lines: string[] = [];
  lines.push("扫描记录文件：" + scanned.length + " 份，改写 " + changed.length + " 份");
  for (const item of changed) {
    lines.push("  [已改写] " + item.relativePath + "（" + item.replacements + " 处）");
  }
  return { scannedFiles: scanned.length, changed, lines };
}

const absolutePathPattern = /[A-Za-z]:[\\/][^\s"'\u0060|<>]+/gu;

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[.,;:)\]}>、，。；：）】」』]+$/u, "");
}

/** 从一段文本里取出所有 Windows 绝对路径（去重）。 */
export function collectAbsolutePaths(content: string): string[] {
  const found = new Set<string>();
  for (const match of content.matchAll(absolutePathPattern)) {
    const cleaned = stripTrailingPunctuation(match[0]);
    if (cleaned.length > 3) found.add(cleaned);
  }
  return [...found].sort(compareText);
}

export interface ProjectReferenceIssue {
  /** 出问题的记录文件相对路径。 */
  recordPath: string;
  /** 记录里写的引用目标。 */
  target: string;
  kind: "missing" | "outside";
  message: string;
}

export interface ProjectReferenceInspection {
  projectRoot: string;
  recordsScanned: number;
  referencesChecked: number;
  okCount: number;
  issues: ProjectReferenceIssue[];
  lines: string[];
  valid: boolean;
}

/**
 * 检查项目里素材记录的引用是否还成立（整目录搬走后用）。
 * 相对路径按当前项目根解析；绝对路径若指向项目外，直接判为断链。
 */
export async function inspectProjectReferences(projectRoot: string): Promise<ProjectReferenceInspection> {
  const root = path.resolve(projectRoot);
  const issues: ProjectReferenceIssue[] = [];
  const lines: string[] = [];
  lines.push("素材引用检查：" + root);

  const recordsRoot = path.join(root, mediaRecordsDirectory);
  if (!(await fs.pathExists(recordsRoot))) {
    lines.push("项目里没有 " + mediaRecordsDirectory + "/ 目录，没有可检查的引用。");
    return {
      projectRoot: root,
      recordsScanned: 0,
      referencesChecked: 0,
      okCount: 0,
      issues,
      lines,
      valid: true
    };
  }

  let recordsScanned = 0;
  let referencesChecked = 0;
  let okCount = 0;

  const recordFiles = (await collectRelativeFiles(recordsRoot)).filter((relativePath) =>
    relativePath.toLowerCase().endsWith(".md")
  );

  for (const relativePath of recordFiles) {
    const recordPath = mediaRecordsDirectory + "/" + relativePath;
    const absolutePath = path.join(recordsRoot, relativePath);
    const content = await fs.readFile(absolutePath, "utf8");
    const record = parseMediaRecord(content);
    if (record) {
      recordsScanned += 1;
      const directory = mediaOutputDirectory(record.identity);
      for (const candidate of record.candidates) {
        referencesChecked += 1;
        // 记录里的文件名通常是相对本类别产出目录的纯文件名；若写成了带目录的相对路径，按项目根解析。
        const expectedRelative = candidate.fileName.includes("/")
          ? candidate.fileName
          : directory + "/" + candidate.fileName;
        const expectedAbsolute = path.join(root, expectedRelative);
        if (await fs.pathExists(expectedAbsolute)) {
          okCount += 1;
          lines.push("[正常] " + recordPath + " → " + expectedRelative);
        } else {
          issues.push({
            recordPath,
            target: expectedRelative,
            kind: "missing",
            message: "断链：" + recordPath + " → " + expectedRelative + "（文件不存在）"
          });
        }
      }
    }

    for (const absoluteReference of collectAbsolutePaths(content)) {
      const resolved = path.resolve(absoluteReference);
      if (!isInsideDirectory(resolved, root)) {
        issues.push({
          recordPath,
          target: absoluteReference,
          kind: "outside",
          message: "外部引用：" + recordPath + " → " + absoluteReference + "（不在当前项目目录内，搬走后失效）"
        });
        continue;
      }
      referencesChecked += 1;
      if (await fs.pathExists(resolved)) {
        okCount += 1;
        lines.push("[正常] " + recordPath + " → " + absoluteReference);
      } else {
        issues.push({
          recordPath,
          target: absoluteReference,
          kind: "missing",
          message: "断链：" + recordPath + " → " + absoluteReference + "（文件不存在）"
        });
      }
    }
  }

  for (const issue of issues) {
    lines.push("[" + (issue.kind === "missing" ? "断链" : "外部引用") + "] " + issue.message);
  }

  const missingCount = issues.filter((issue) => issue.kind === "missing").length;
  const outsideCount = issues.filter((issue) => issue.kind === "outside").length;
  lines.push("记录文件：" + recordsScanned + " 份，引用：" + referencesChecked + " 条，正常：" + okCount + " 条");
  lines.push(
    issues.length === 0
      ? "结论：全部引用有效"
      : "结论：断链 " + missingCount + " 条，外部引用 " + outsideCount + " 条"
  );

  return {
    projectRoot: root,
    recordsScanned,
    referencesChecked,
    okCount,
    issues,
    lines,
    valid: issues.length === 0
  };
}
