import crypto from "node:crypto";
import fs from "fs-extra";
import path from "node:path";

import { CliUserError } from "./cli-errors.js";
import { STEP0_FILES, researchStepEnabled } from "./constants.js";
import { readWorkflowProjectConfig } from "./project-root.js";
import type { ResearchPlatform, ResearchRuntime } from "./types.js";

const researchDir = "00_前期研究";
const researchLibraryDir = "_资料库";
const researchInboxDir = "_inbox";
const sourceIdPattern = /^SRC-\d{4}$/;
const supportedResearchPlatforms: ResearchPlatform[] = [
  "auto",
  "bilibili",
  "douyin",
  "xiaohongshu",
  "weibo",
  "kuaishou",
  "tieba",
  "zhihu",
  "web"
];
const supportedResearchRuntimes: ResearchRuntime[] = ["auto", "toolbox", "ide-inbox"];
const mediaCrawlerPlatformMap: Partial<Record<ResearchPlatform, string>> = {
  bilibili: "bili",
  douyin: "dy",
  xiaohongshu: "xhs",
  weibo: "wb",
  kuaishou: "ks",
  tieba: "tieba",
  zhihu: "zhihu"
};
const toolboxRootPlaceholder = "<research-toolbox>";

export interface ResearchIngestOptions {
  projectRoot: string;
  source: string;
  platform: ResearchPlatform;
  runtime: ResearchRuntime;
  withComments: boolean;
  commentLimit: number;
  dryRun?: boolean;
}

export interface ResearchInboxOptions {
  projectRoot: string;
  dryRun?: boolean;
}

export interface ResearchCreatedFile {
  path: string;
  kind: "metadata" | "source-card" | "comment-sample" | "raw-copy";
}

export interface ResearchIngestResult {
  projectRoot: string;
  dryRun: boolean;
  sourceId: string;
  sourceRoot: string;
  source: string;
  platform: ResearchPlatform;
  runtime: ResearchRuntime;
  toolboxCommand?: string;
  createdFiles: ResearchCreatedFile[];
  notes: string[];
}

interface ResearchSourceArchive {
  metadataSource: string;
  sourceKind: "url" | "local-file";
  originalFileName?: string;
  createdFiles: ResearchCreatedFile[];
  notes: string[];
}

export interface ResearchInboxResult {
  projectRoot: string;
  dryRun: boolean;
  inboxRoot: string;
  ingested: ResearchIngestResult[];
  skipped: string[];
}

function parseChoice<T extends string>(value: string | undefined, allowed: readonly T[], label: string): T | undefined {
  if (value === undefined) {
    return undefined;
  }
  if ((allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  throw new CliUserError(`Invalid ${label}: ${value}. Expected one of: ${allowed.join(", ")}.`);
}

export function parseResearchPlatform(value: string | undefined): ResearchPlatform | undefined {
  return parseChoice(value, supportedResearchPlatforms, "research platform");
}

export function parseResearchRuntime(value: string | undefined): ResearchRuntime | undefined {
  return parseChoice(value, supportedResearchRuntimes, "research runtime");
}

function normalizeProjectPath(projectRoot: string, target: string): string {
  return path.relative(projectRoot, target).replace(/\\/g, "/");
}

function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function inferPlatform(source: string, platform: ResearchPlatform): ResearchPlatform {
  if (platform !== "auto") {
    return platform;
  }
  if (!isUrl(source)) {
    return "web";
  }
  const hostname = new URL(source).hostname.toLowerCase();
  if (hostname.includes("bilibili.com")) return "bilibili";
  if (hostname.includes("douyin.com")) return "douyin";
  if (hostname.includes("xiaohongshu.com") || hostname.includes("xhslink.com")) return "xiaohongshu";
  if (hostname.includes("weibo.com")) return "weibo";
  if (hostname.includes("kuaishou.com")) return "kuaishou";
  if (hostname.includes("tieba.baidu.com")) return "tieba";
  if (hostname.includes("zhihu.com")) return "zhihu";
  return "web";
}

function nextSourceId(existingNames: string[]): string {
  const max = existingNames
    .filter((name) => sourceIdPattern.test(name))
    .map((name) => Number.parseInt(name.slice(4), 10))
    .reduce((current, value) => Math.max(current, value), 0);
  return `SRC-${String(max + 1).padStart(4, "0")}`;
}

async function allocateSourceId(projectRoot: string): Promise<string> {
  const libraryRoot = path.join(projectRoot, researchDir, researchLibraryDir);
  const existingNames = (await fs.pathExists(libraryRoot)) ? await fs.readdir(libraryRoot) : [];
  return nextSourceId(existingNames);
}

async function assertResearchProject(projectRoot: string): Promise<void> {
  const config = await readWorkflowProjectConfig(projectRoot);
  if (!researchStepEnabled(config)) {
    throw new CliUserError("Research step is disabled for this project. Reinitialize with --start-from research or enable workflow.research_step.enabled.");
  }
  for (const file of STEP0_FILES) {
    const fullPath = path.join(projectRoot, researchDir, file);
    if (!(await fs.pathExists(fullPath))) {
      throw new CliUserError(`Research project is missing Step 0 file: ${researchDir}/${file}`);
    }
  }
}

function toolboxCommandFor(source: string, platform: ResearchPlatform, withComments: boolean, commentLimit: number): string | undefined {
  const mediaCrawlerPlatform = mediaCrawlerPlatformMap[platform];
  if (mediaCrawlerPlatform) {
    const sourceArg = isUrl(source) ? `--specified_id "${source}" --type detail` : `--keywords "${source}" --type search`;
    return [
      `cd ${toolboxRootPlaceholder}/vendor/MediaCrawler && .venv/Scripts/python.exe`,
      "main.py",
      "--platform",
      mediaCrawlerPlatform,
      sourceArg,
      "--lt qrcode",
      "--save_data_option jsonl",
      `--get_comment ${withComments ? "true" : "false"}`,
      `--max_comments_count_singlenote ${commentLimit}`
    ].join(" ");
  }
  if (platform === "web" && isUrl(source)) {
    return `cd ${toolboxRootPlaceholder} && .venv/Scripts/yt-dlp.exe --skip-download --write-info-json --write-subs --sub-langs all "${source}"`;
  }
  return undefined;
}

function metadataFor({
  sourceId,
  source,
  sourceKind,
  originalFileName,
  platform,
  runtime,
  withComments,
  commentLimit,
  toolboxCommand
}: {
  sourceId: string;
  source: string;
  sourceKind: "url" | "local-file";
  originalFileName?: string;
  platform: ResearchPlatform;
  runtime: ResearchRuntime;
  withComments: boolean;
  commentLimit: number;
  toolboxCommand?: string;
}): Record<string, unknown> {
  return {
    source_id: sourceId,
    source,
    source_kind: sourceKind,
    original_file_name: originalFileName ?? null,
    platform,
    runtime,
    collected_at: new Date().toISOString(),
    comments_requested: withComments,
    comment_limit: commentLimit,
    auth_material_excluded: true,
    source_path_policy: sourceKind === "local-file" ? "local absolute input path excluded; source points to project-relative raw archive path" : "url recorded as provided",
    privacy_policy: "comments anonymized; cookies, tokens, private messages and browser profiles are not stored in project truth",
    toolbox_command: toolboxCommand ?? null,
    status: runtime === "ide-inbox" ? "archived-from-inbox" : "archived-metadata"
  };
}

function renderSourceCard(metadata: Record<string, unknown>): string {
  const sourceId = String(metadata.source_id);
  return [
    `# ${sourceId} 来源卡`,
    "",
    "## 基础信息",
    "",
    `- 来源 ID：${sourceId}`,
    `- 来源：${metadata.source}`,
    `- 来源类型：${metadata.source_kind}`,
    `- 平台：${metadata.platform}`,
    `- 采集运行层：${metadata.runtime}`,
    `- 采集时间：${metadata.collected_at}`,
    `- 评论采集：${metadata.comments_requested ? "是" : "否"}`,
    "",
    "## 可复查信息",
    "",
    "- 标题：待补充",
    "- 作者/机构：待补充",
    "- 发布日期：待补充",
    "- 链接或相对路径：待补充",
    "- 可信度：待核验",
    "",
    "## 短摘录",
    "",
    "> 待补充必要短摘录。不要整篇搬运受版权保护内容。",
    "",
    "## 保守整理",
    "",
    "- 已验证事实：",
    "- 合理推断：",
    "- 创作改编：",
    "",
    "## 画面和声音细节",
    "",
    "- 可用于画面生成的细节：",
    "- 可用于声音或采访语感的细节：",
    "",
    "## 限制说明",
    "",
    "- 不保存 cookie、token、账号、手机号、私信、平台缓存或浏览器登录态。",
    "- 评论样本如存在，必须匿名化。",
    metadata.toolbox_command ? `- 建议 toolbox 命令：\`${metadata.toolbox_command}\`` : "- 未生成 toolbox 命令。",
    ""
  ].join("\n");
}

function hashAnonymousUser(seed: string): string {
  return crypto.createHash("sha256").update(seed).digest("hex").slice(0, 12);
}

function renderCommentSample(sourceId: string, commentLimit: number): string {
  const anonymousHash = hashAnonymousUser(`${sourceId}:sample`);
  return [
    `# ${sourceId} 匿名评论样本`,
    "",
    "## 采样说明",
    "",
    `- 样本上限：${commentLimit}`,
    "- 用户名、主页 ID、手机号、私信和账号标识默认不保存。",
    "- 本文件只保留匿名化小样本、主题标签和可用于创作的公众反馈观察。",
    "",
    "## 评论样本",
    "",
    "| 匿名用户 | 时间 | 互动量 | 评论内容 | 主题标签 | 可用于创作的观察 |",
    "| --- | --- | --- | --- | --- | --- |",
    `| user_${anonymousHash} | 待补充 | 待补充 | 待补充 | 待补充 | 待补充 |`,
    "",
    "## 不可保存内容",
    "",
    "- 真实用户名或平台 ID",
    "- 手机号、私信、地址、账号资料",
    "- cookie、token、浏览器登录态",
    ""
  ].join("\n");
}

async function archiveSourceInput(projectRoot: string, sourceRoot: string, source: string, dryRun: boolean): Promise<ResearchSourceArchive> {
  if (isUrl(source)) {
    return {
      metadataSource: source,
      sourceKind: "url",
      createdFiles: [],
      notes: []
    };
  }
  const resolvedSource = path.resolve(source);
  if (!(await fs.pathExists(resolvedSource))) {
    throw new CliUserError(`Research source does not exist: ${source}`);
  }
  const stat = await fs.stat(resolvedSource);
  if (!stat.isFile()) {
    throw new CliUserError(`Research source must be a file: ${source}`);
  }
  const rawDir = path.join(sourceRoot, "raw");
  const target = path.join(rawDir, path.basename(source));
  if (!dryRun) {
    await fs.ensureDir(rawDir);
    await fs.copyFile(resolvedSource, target);
  }
  const rawCopyPath = normalizeProjectPath(projectRoot, target);
  return {
    metadataSource: rawCopyPath,
    sourceKind: "local-file",
    originalFileName: path.basename(source),
    createdFiles: [{ path: rawCopyPath, kind: "raw-copy" }],
    notes: ["Original local absolute source path is excluded from versioned research files; use the project-relative raw archive path."]
  };
}

async function ingestResearchSourceWithId(options: ResearchIngestOptions, allocatedSourceId?: string): Promise<ResearchIngestResult> {
  const projectRoot = path.resolve(options.projectRoot);
  await assertResearchProject(projectRoot);
  const sourceId = allocatedSourceId ?? (await allocateSourceId(projectRoot));
  const platform = inferPlatform(options.source, options.platform);
  const runtime = options.runtime === "auto" ? "toolbox" : options.runtime;
  const sourceRoot = path.join(projectRoot, researchDir, researchLibraryDir, sourceId);
  const toolboxCommand = runtime === "toolbox" ? toolboxCommandFor(options.source, platform, options.withComments, options.commentLimit) : undefined;
  const archivedSource = await archiveSourceInput(projectRoot, sourceRoot, options.source, options.dryRun === true);
  const metadata = metadataFor({
    sourceId,
    source: archivedSource.metadataSource,
    sourceKind: archivedSource.sourceKind,
    originalFileName: archivedSource.originalFileName,
    platform,
    runtime,
    withComments: options.withComments,
    commentLimit: options.commentLimit,
    toolboxCommand
  });
  const metadataPath = path.join(sourceRoot, "metadata.json");
  const sourceCardPath = path.join(sourceRoot, "source-card.md");
  const commentPath = path.join(sourceRoot, "comment-sample.md");
  const createdFiles: ResearchCreatedFile[] = [
    { path: normalizeProjectPath(projectRoot, metadataPath), kind: "metadata" },
    { path: normalizeProjectPath(projectRoot, sourceCardPath), kind: "source-card" }
  ];
  createdFiles.push(...archivedSource.createdFiles);
  if (options.withComments) {
    createdFiles.push({ path: normalizeProjectPath(projectRoot, commentPath), kind: "comment-sample" });
  }
  if (options.dryRun !== true) {
    await fs.ensureDir(sourceRoot);
    await fs.writeJson(metadataPath, metadata, { spaces: 2 });
    await fs.writeFile(sourceCardPath, renderSourceCard(metadata), "utf8");
    if (options.withComments) {
      await fs.writeFile(commentPath, renderCommentSample(sourceId, options.commentLimit), "utf8");
    }
  }
  const notes = [
    "Research archive stores metadata and short notes only; raw/media/full-comments/browser profiles/cookies are gitignored.",
    "Do not bypass CAPTCHA, login restrictions, paywalls, privacy permissions, or platform access controls."
  ];
  notes.push(...archivedSource.notes);
  if (toolboxCommand) {
    notes.push("Toolbox command recorded for operator-run collection; CLI archive does not store cookies or browser login state.");
  }
  if (runtime === "ide-inbox") {
    notes.push("Source was archived from IDE/manual inbox material.");
  }
  return {
    projectRoot,
    dryRun: options.dryRun === true,
    sourceId,
    sourceRoot: normalizeProjectPath(projectRoot, sourceRoot),
    source: archivedSource.metadataSource,
    platform,
    runtime,
    toolboxCommand,
    createdFiles,
    notes
  };
}

export async function ingestResearchSource(options: ResearchIngestOptions): Promise<ResearchIngestResult> {
  return ingestResearchSourceWithId(options);
}

async function listInboxFiles(inboxRoot: string): Promise<string[]> {
  if (!(await fs.pathExists(inboxRoot))) {
    return [];
  }
  const entries = await fs.readdir(inboxRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(inboxRoot, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

export async function ingestResearchInbox(options: ResearchInboxOptions): Promise<ResearchInboxResult> {
  const projectRoot = path.resolve(options.projectRoot);
  await assertResearchProject(projectRoot);
  const inboxRoot = path.join(projectRoot, researchDir, researchInboxDir);
  const files = await listInboxFiles(inboxRoot);
  const ingested: ResearchIngestResult[] = [];
  const skipped: string[] = [];
  const libraryRoot = path.join(projectRoot, researchDir, researchLibraryDir);
  const simulatedNames = (await fs.pathExists(libraryRoot)) ? await fs.readdir(libraryRoot) : [];
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (![".md", ".txt", ".html", ".json", ".csv", ".pdf"].includes(ext)) {
      skipped.push(normalizeProjectPath(projectRoot, file));
      continue;
    }
    const plannedSourceId = options.dryRun ? nextSourceId(simulatedNames) : undefined;
    if (plannedSourceId) {
      simulatedNames.push(plannedSourceId);
    }
    ingested.push(
      await ingestResearchSourceWithId(
        {
          projectRoot,
          source: file,
          platform: "web",
          runtime: "ide-inbox",
          withComments: false,
          commentLimit: 0,
          dryRun: options.dryRun
        },
        plannedSourceId
      )
    );
  }
  return {
    projectRoot,
    dryRun: options.dryRun === true,
    inboxRoot: normalizeProjectPath(projectRoot, inboxRoot),
    ingested,
    skipped
  };
}

export function renderResearchIngestSummary(result: ResearchIngestResult): string {
  const lines = [
    result.dryRun ? "Research ingest dry-run:" : "Research ingest:",
    `- source id: ${result.sourceId}`,
    `- source root: ${result.sourceRoot}`,
    `- platform: ${result.platform}`,
    `- runtime: ${result.runtime}`,
    `- source: ${result.source}`,
    "- files:"
  ];
  for (const file of result.createdFiles) {
    lines.push(`  - ${file.kind}: ${file.path}`);
  }
  if (result.toolboxCommand) {
    lines.push(`- toolbox command: ${result.toolboxCommand}`);
  }
  lines.push("- notes:");
  for (const note of result.notes) {
    lines.push(`  - ${note}`);
  }
  return lines.join("\n");
}

export function renderResearchInboxSummary(result: ResearchInboxResult): string {
  const lines = [
    result.dryRun ? "Research inbox dry-run:" : "Research inbox:",
    `- inbox: ${result.inboxRoot}`,
    `- ingested: ${result.ingested.length}`,
    `- skipped: ${result.skipped.length}`
  ];
  for (const item of result.ingested) {
    lines.push(`  - ${item.sourceId}: ${item.source}`);
  }
  if (result.skipped.length > 0) {
    lines.push("- skipped files:");
    for (const file of result.skipped) {
      lines.push(`  - ${file}`);
    }
  }
  return lines.join("\n");
}
