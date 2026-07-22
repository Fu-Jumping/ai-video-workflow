import fs from "fs-extra";
import path from "node:path";

import { STEP_DIRS } from "../constants.js";
import { readProjectConfig } from "../project-config.js";
import type { VerificationIssue, VerificationResult } from "../types.js";
import { projectRootIssues } from "../project-root.js";
import { parseYaml } from "../yaml.js";
import { hashContent, projectionManifestPath, readProjectionManifest } from "./manifest.js";
import { frontmatterValue, isGeneratedFrontmatter, obsidianPropertyValues } from "./properties.js";
import { notesIndexPath } from "./routes.js";
import type { ObsidianProjectionManifest, ObsidianProjectionManifestEntry } from "./types.js";

const requiredDashboardMarkers: Record<string, string[]> = {
  "00_项目首页.md": ["## 1. 打开路线", "## 2. 审阅入口", "## 3. 镜头入口", "## 4. 项目状态", "### 5.1 画布导航"],
  "01_审阅总览.md": ["## 1. 需要关注", "## 2. 执行就绪", "## 3. 审阅地图", "## 4. 镜头审阅画布"],
  "02_镜头索引.md": ["## 1. 镜头入口", "## 2. 镜头表", "## 3. 镜头进度", "## 4. 沉浸式审阅表"],
  "03_制作看板.md": ["## 1. 执行就绪", "## 2. 制作状态", "## 3. 镜头进度", "## 4. 导航"]
};
const requiredBaseFiles = ["数据表/流程文件.base", "数据表/镜头.base", "数据表/制作状态.base"];
const requiredBaseViews: Record<string, string[]> = {
  "数据表/流程文件.base": ["流程文件", "审阅队列", "已改动生成文件"],
  "数据表/镜头.base": ["镜头表", "镜头卡片", "镜头进度", "沉浸式审阅", "智能体交接"],
  "数据表/制作状态.base": ["制作状态", "执行就绪"]
};
const requiredCanvasFiles = ["画布/流程图.canvas", "画布/镜头流水线.canvas", "画布/审阅地图.canvas"];
const agentHandoffPath = "04_智能体交接.md";
const requiredAgentHandoffMarkers = ["## 1. 导航", "## 2. 单镜头交接", "分镜脚本源文件", "## 3. 源文件编辑边界", "## 4. 可复制提示词", "## 5. 验证命令"];
const requiredShotAgentHandoffLink = "[[04_智能体交接#2. 单镜头交接|智能体交接]]";
const suggestedUiDir = ".obsidian/ai-video-workflow-suggested";
const requiredSuggestedUiFiles = ["bookmarks.json", "workspace.json", "core-plugins.json", "appearance.json"];
const requiredBookmarkPaths = [
  "00_项目首页.md",
  "04_智能体交接.md",
  "02_镜头索引.md",
  "03_制作看板.md",
  "画布/审阅地图.canvas",
  "画布/镜头流水线.canvas",
  notesIndexPath
];
const requiredWorkspacePaths = ["00_项目首页.md", "01_审阅总览.md", "画布/审阅地图.canvas"];
const requiredShotReviewMarkers = [
  "## 1. 快速审阅",
  "## 2. 审阅路径",
  "## 3. 源文件序列",
  "## 4. 画面连续性",
  "## 5. 视频提示词",
  "## 6. 执行检查",
  "## 7. 修改入口",
  "## 8. 数据视图",
  "## 9. 审阅画布"
];
const absoluteLinkPattern = /([A-Za-z]:\\|[A-Za-z]:\/|file:\/\/|vscode:\/\/|\]\(\/(?!\/))/;
const unsafeLocalPathStringPattern = /(^|[^A-Za-z])[A-Za-z]:[\\/]|file:\/\/|vscode:\/\//i;

interface VerifyObsidianOptions {
  projectRoot: string;
  vaultRoot: string;
}

interface CanvasNode {
  id?: string;
  type?: string;
  file?: string;
}

interface CanvasEdge {
  id?: string;
  fromNode?: string;
  toNode?: string;
}

interface CanvasFile {
  nodes?: CanvasNode[];
  edges?: CanvasEdge[];
}

interface BaseView {
  name?: string;
}

interface BaseFile {
  views?: BaseView[];
}

interface VaultLinkTarget {
  target: string;
  anchor: string;
}

function pushIssue(issues: VerificationIssue[], issue: VerificationIssue): void {
  issues.push(issue);
}

function vaultFsPath(vaultRoot: string, vaultPath: string): string {
  return path.join(vaultRoot, ...vaultPath.split("/"));
}

function isRelativeVaultPath(value: string): boolean {
  return (
    value.length > 0 &&
    !value.includes("\\") &&
    !path.isAbsolute(value) &&
    !unsafeLocalPathStringPattern.test(value) &&
    !value.startsWith("../") &&
    !value.includes("/../") &&
    !value.split("/").some((segment) => segment === "." || segment === ".." || segment.length === 0)
  );
}

function collectJsonStrings(value: unknown, strings: string[] = []): string[] {
  if (typeof value === "string") {
    strings.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonStrings(item, strings);
    }
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectJsonStrings(item, strings);
    }
  }
  return strings;
}

function containsUnsafePathString(value: unknown): boolean {
  return collectJsonStrings(value).some((item) => !isRelativeVaultPath(item) && /\.(md|canvas|base|json)$/i.test(item));
}

function containsUnsafeManifestString(value: unknown): boolean {
  return collectJsonStrings(value).some((item) => unsafeLocalPathStringPattern.test(item));
}

function splitLinkTarget(target: string): { pathPart: string; anchor: string } {
  const withoutAlias = target.split("|")[0] ?? "";
  const hashIndex = withoutAlias.indexOf("#");
  if (hashIndex === -1) {
    return { pathPart: withoutAlias.trim(), anchor: "" };
  }
  return { pathPart: withoutAlias.slice(0, hashIndex).trim(), anchor: withoutAlias.slice(hashIndex + 1).trim() };
}

function isExternalLink(target: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(target);
}

function vaultLinkTargetCandidates(currentFile: string, target: string, isWikiLink: boolean): VaultLinkTarget[] {
  const { pathPart, anchor } = splitLinkTarget(target);
  if (pathPart.length === 0 || isExternalLink(pathPart)) {
    return [];
  }
  if (isWikiLink) {
    const ext = path.posix.extname(pathPart);
    return [{ target: ext ? pathPart : `${pathPart}.md`, anchor }];
  }
  const ext = path.posix.extname(pathPart);
  if (![".md", ".canvas", ".base"].includes(ext)) {
    return [];
  }
  return [{ target: path.posix.normalize(path.posix.join(path.posix.dirname(currentFile), pathPart)), anchor }];
}

function isOptionalUserNoteTarget(target: string): boolean {
  return target.startsWith("笔记/镜头审阅/");
}

function sourceFsPath(projectRoot: string, sourcePath: string): string {
  return path.join(projectRoot, ...sourcePath.split("/"));
}

async function listVaultFiles(root: string, current = root): Promise<string[]> {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") {
      continue;
    }
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listVaultFiles(root, fullPath)));
    } else if (entry.isFile() && /\.(md|base|canvas)$/.test(entry.name)) {
      files.push(path.relative(root, fullPath).replace(/\\/g, "/"));
    }
  }
  return files;
}

async function listJsonFiles(root: string, current = root): Promise<string[]> {
  if (!(await fs.pathExists(current))) {
    return [];
  }
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listJsonFiles(root, fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(path.relative(root, fullPath).replace(/\\/g, "/"));
    }
  }
  return files;
}

async function listDirectJsonFiles(root: string): Promise<string[]> {
  if (!(await fs.pathExists(root))) {
    return [];
  }
  const entries = await fs.readdir(root, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => entry.name);
}

function decodeAnchor(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function markdownHeadingAnchors(content: string): Set<string> {
  const headings = new Set<string>();
  let inFence = false;
  for (const line of content.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    const match = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/u);
    if (match) {
      headings.add(match[1].trim());
    }
  }
  return headings;
}

async function markdownHeadingIndex(vaultRoot: string, files: string[]): Promise<Map<string, Set<string>>> {
  const index = new Map<string, Set<string>>();
  for (const file of files.filter((filePath) => filePath.endsWith(".md"))) {
    index.set(file, markdownHeadingAnchors(await fs.readFile(vaultFsPath(vaultRoot, file), "utf8")));
  }
  return index;
}

async function baseViewIndex(vaultRoot: string, files: string[]): Promise<Map<string, Set<string>>> {
  const index = new Map<string, Set<string>>();
  for (const file of files.filter((filePath) => filePath.endsWith(".base"))) {
    try {
      const base = parseYaml<BaseFile>(await fs.readFile(vaultFsPath(vaultRoot, file), "utf8"));
      index.set(file, new Set((base.views ?? []).map((view) => view.name).filter((name): name is string => Boolean(name))));
    } catch {
      index.set(file, new Set());
    }
  }
  return index;
}

function readFrontmatter(content: string): Record<string, string> | null {
  if (!content.startsWith("---\n")) {
    return null;
  }
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) {
    return null;
  }
  const frontmatter = content.slice(4, end);
  const values: Record<string, string> = {};
  for (const line of frontmatter.split(/\r?\n/)) {
    const match = line.match(/^([^:\r\n]+):\s*(.*)$/u);
    if (match) {
      values[match[1]] = match[2].replace(/^"|"$/g, "");
    }
  }
  return values;
}

async function verifyRequiredFiles(vaultRoot: string, issues: VerificationIssue[]): Promise<void> {
  for (const [file, markers] of Object.entries(requiredDashboardMarkers)) {
    const fullPath = vaultFsPath(vaultRoot, file);
    if (!(await fs.pathExists(fullPath))) {
      pushIssue(issues, { code: "missing-obsidian-dashboard", message: `Missing Obsidian dashboard: ${file}`, path: file });
      continue;
    }
    const content = await fs.readFile(fullPath, "utf8");
    for (const marker of markers) {
      if (!content.includes(marker)) {
        pushIssue(issues, { code: "invalid-obsidian-dashboard", message: `Obsidian dashboard is missing marker: ${marker}`, path: file });
      }
    }
  }
  for (const file of requiredBaseFiles) {
    const fullPath = vaultFsPath(vaultRoot, file);
    if (!(await fs.pathExists(fullPath))) {
      pushIssue(issues, { code: "missing-obsidian-base", message: `Missing Obsidian base: ${file}`, path: file });
      continue;
    }
    let base: BaseFile;
    try {
      base = parseYaml<BaseFile>(await fs.readFile(fullPath, "utf8"));
    } catch {
      pushIssue(issues, { code: "invalid-obsidian-base-yaml", message: `Obsidian base YAML is invalid: ${file}`, path: file });
      continue;
    }
    const viewNames = new Set((base.views ?? []).map((view) => view.name).filter(Boolean));
    for (const viewName of requiredBaseViews[file] ?? []) {
      if (!viewNames.has(viewName)) {
        pushIssue(issues, { code: "missing-obsidian-base-view", message: `Obsidian base is missing view: ${viewName}`, path: file });
      }
    }
  }
}

async function verifyAgentHandoff(vaultRoot: string, files: string[], issues: VerificationIssue[]): Promise<void> {
  const fullPath = vaultFsPath(vaultRoot, agentHandoffPath);
  if (!(await fs.pathExists(fullPath))) {
    pushIssue(issues, { code: "invalid-obsidian-agent-handoff", message: `Missing Obsidian agent handoff page: ${agentHandoffPath}`, path: agentHandoffPath });
  } else {
    const content = await fs.readFile(fullPath, "utf8");
    for (const marker of requiredAgentHandoffMarkers) {
      if (!content.includes(marker)) {
        pushIssue(issues, { code: "invalid-obsidian-agent-handoff", message: `Obsidian agent handoff page is missing marker: ${marker}`, path: agentHandoffPath });
      }
    }
  }

  for (const file of files.filter((filePath) => filePath.startsWith("镜头/") && filePath.endsWith(".md"))) {
    const content = await fs.readFile(vaultFsPath(vaultRoot, file), "utf8");
    if (!content.includes(requiredShotAgentHandoffLink)) {
      pushIssue(issues, { code: "invalid-obsidian-agent-handoff", message: `镜头页缺少智能体交接入口：${file}`, path: file });
    }
  }
}

async function verifyCanvasFiles(vaultRoot: string, issues: VerificationIssue[]): Promise<void> {
  const canvasFiles = [...requiredCanvasFiles, ...(await listVaultFiles(vaultRoot)).filter((file) => file.startsWith("画布/镜头审阅/") && file.endsWith(".canvas"))];
  for (const file of canvasFiles) {
    const fullPath = vaultFsPath(vaultRoot, file);
    if (!(await fs.pathExists(fullPath))) {
      pushIssue(issues, { code: "invalid-obsidian-canvas-json", message: `Missing Obsidian canvas: ${file}`, path: file });
      continue;
    }
    try {
      const canvas = (await fs.readJson(fullPath)) as CanvasFile;
      if (!Array.isArray(canvas.nodes)) {
        pushIssue(issues, { code: "invalid-obsidian-canvas-json", message: "Canvas JSON must contain a nodes array", path: file });
        continue;
      }
      if (!Array.isArray(canvas.edges)) {
        pushIssue(issues, { code: "invalid-obsidian-canvas-json", message: "Canvas JSON must contain an edges array", path: file });
        continue;
      }
      const nodeIds = new Set<string>();
      for (const node of canvas.nodes) {
        if (!node.id) {
          pushIssue(issues, { code: "invalid-obsidian-canvas-json", message: "Canvas node must contain an id", path: file });
          continue;
        }
        if (nodeIds.has(node.id)) {
          pushIssue(issues, { code: "invalid-obsidian-canvas-json", message: `Canvas node id is duplicated: ${node.id}`, path: file });
        }
        nodeIds.add(node.id);
        if (node.type === "file" && (!node.file || !isRelativeVaultPath(node.file))) {
          pushIssue(issues, { code: "invalid-obsidian-canvas-json", message: "Canvas file node must use a relative vault path", path: file });
        }
        if (node.type === "file" && node.file && isRelativeVaultPath(node.file) && !(await fs.pathExists(vaultFsPath(vaultRoot, node.file)))) {
          pushIssue(issues, { code: "invalid-obsidian-canvas-json", message: `Canvas file node target is missing: ${node.file}`, path: file });
        }
      }
      for (const edge of canvas.edges) {
        if (!edge.fromNode || !nodeIds.has(edge.fromNode) || !edge.toNode || !nodeIds.has(edge.toNode)) {
          pushIssue(issues, {
            code: "invalid-obsidian-canvas-json",
            message: `Canvas edge endpoint is missing: ${edge.id ?? "unnamed-edge"}`,
            path: file
          });
        }
      }
    } catch {
      pushIssue(issues, { code: "invalid-obsidian-canvas-json", message: "Canvas JSON is invalid", path: file });
    }
  }
}

async function verifyShotReviewPages(vaultRoot: string, files: string[], issues: VerificationIssue[]): Promise<void> {
  for (const file of files.filter((filePath) => filePath.startsWith("镜头/") && filePath.endsWith(".md"))) {
    const content = await fs.readFile(vaultFsPath(vaultRoot, file), "utf8");
    const frontmatter = readFrontmatter(content);
    const shotId = frontmatterValue(frontmatter ?? {}, "shotId") ?? path.basename(file, ".md");
    if (frontmatterValue(frontmatter ?? {}, "reviewMode") !== obsidianPropertyValues.reviewMode.immersive) {
      pushIssue(issues, { code: "invalid-obsidian-shot-review", message: `Shot review page is missing immersive review mode: ${file}`, path: file });
    }
    for (const marker of requiredShotReviewMarkers) {
      if (!content.includes(marker)) {
        pushIssue(issues, { code: "invalid-obsidian-shot-review", message: `Shot review page is missing marker: ${marker}`, path: file });
      }
    }
    const reviewCanvasPath = `画布/镜头审阅/${shotId}.canvas`;
    if (!content.includes(`[[${reviewCanvasPath}`) || !(await fs.pathExists(vaultFsPath(vaultRoot, reviewCanvasPath)))) {
      pushIssue(issues, { code: "invalid-obsidian-shot-review", message: `Shot review canvas is missing or not linked: ${reviewCanvasPath}`, path: file });
    }
  }
}

function manifestEntryByVaultPath(manifest: ObsidianProjectionManifest | null): Map<string, ObsidianProjectionManifestEntry> {
  const entries = new Map<string, ObsidianProjectionManifestEntry>();
  for (const entry of manifest?.files ?? []) {
    entries.set(entry.vaultPath, entry);
  }
  return entries;
}

function isValidManifest(manifest: ObsidianProjectionManifest): boolean {
  return (
    (manifest.schemaVersion === 1 || manifest.schemaVersion === 2) &&
    manifest.generator === "ai-video-workflow" &&
    typeof manifest.projectRoot === "string" &&
    Array.isArray(manifest.files)
  );
}

async function verifyManifest(projectRoot: string, vaultRoot: string, issues: VerificationIssue[]): Promise<ObsidianProjectionManifest | null> {
  const manifestFile = vaultFsPath(vaultRoot, projectionManifestPath);
  if (!(await fs.pathExists(manifestFile))) {
    pushIssue(issues, { code: "missing-obsidian-manifest", message: "Missing Obsidian projection manifest", path: projectionManifestPath });
    return null;
  }

  let manifest: ObsidianProjectionManifest;
  try {
    manifest = await readProjectionManifest(vaultRoot) as ObsidianProjectionManifest;
  } catch {
    pushIssue(issues, { code: "invalid-obsidian-manifest", message: "Obsidian projection manifest JSON is invalid", path: projectionManifestPath });
    return null;
  }
  if (!manifest || !isValidManifest(manifest)) {
    pushIssue(issues, { code: "invalid-obsidian-manifest", message: "Obsidian projection manifest schema is invalid", path: projectionManifestPath });
    return null;
  }
  if (
    containsUnsafeManifestString(manifest) ||
    path.isAbsolute(manifest.projectRoot) ||
    (manifest.projectRootRelativePath && path.isAbsolute(manifest.projectRootRelativePath))
  ) {
    pushIssue(issues, { code: "invalid-obsidian-manifest", message: "Obsidian projection manifest contains an unsafe local path", path: projectionManifestPath });
    return null;
  }

  for (const entry of manifest.files) {
    if (!entry.vaultPath || !isRelativeVaultPath(entry.vaultPath) || !entry.contentHash) {
      pushIssue(issues, { code: "invalid-obsidian-manifest", message: "Obsidian projection manifest entry is invalid", path: projectionManifestPath });
      continue;
    }
    const fullPath = vaultFsPath(vaultRoot, entry.vaultPath);
    if (!(await fs.pathExists(fullPath))) {
      pushIssue(issues, { code: "missing-obsidian-manifest-file", message: `Manifest file is missing: ${entry.vaultPath}`, path: entry.vaultPath });
      continue;
    }
    const content = await fs.readFile(fullPath, "utf8");
    if (hashContent(content) !== entry.contentHash) {
      pushIssue(issues, { code: "obsidian-manifest-hash-mismatch", message: `Manifest hash does not match generated file: ${entry.vaultPath}`, path: entry.vaultPath });
    }
    if (entry.sourcePath && (!isRelativeVaultPath(entry.sourcePath) || !(await fs.pathExists(sourceFsPath(projectRoot, entry.sourcePath))))) {
      pushIssue(issues, { code: "obsidian-manifest-source-mismatch", message: `Manifest source path does not resolve: ${entry.sourcePath}`, path: entry.vaultPath });
    }
    if (manifest.schemaVersion === 2 && entry.sourcePath && entry.sourceContentHash) {
      const sourcePath = sourceFsPath(projectRoot, entry.sourcePath);
      if ((await fs.pathExists(sourcePath)) && hashContent(await fs.readFile(sourcePath, "utf8")) !== entry.sourceContentHash) {
        pushIssue(issues, {
          code: "obsidian-view-stale",
          message: `Obsidian projection is stale for source file: ${entry.sourcePath}`,
          path: entry.vaultPath
        });
      }
    }
  }
  return manifest;
}

async function verifyGeneratedMarkdown(
  projectRoot: string,
  vaultRoot: string,
  files: string[],
  manifest: ObsidianProjectionManifest | null,
  issues: VerificationIssue[]
): Promise<void> {
  const manifestEntries = manifestEntryByVaultPath(manifest);
  for (const file of files.filter((filePath) => filePath.endsWith(".md"))) {
    const content = await fs.readFile(vaultFsPath(vaultRoot, file), "utf8");
    const frontmatter = readFrontmatter(content);
    if (!isGeneratedFrontmatter(frontmatter)) {
      continue;
    }
    const sourcePath = frontmatterValue(frontmatter ?? {}, "sourcePath");
    if (!sourcePath) {
      pushIssue(issues, { code: "missing-obsidian-source-path", message: "Generated Obsidian note is missing 源文件路径", path: file });
      continue;
    }
    if (!isRelativeVaultPath(sourcePath) || !(await fs.pathExists(sourceFsPath(projectRoot, sourcePath)))) {
      pushIssue(issues, { code: "broken-obsidian-source-path", message: `Generated Obsidian 源文件路径 does not resolve: ${sourcePath}`, path: file });
    }
    const manifestEntry = manifestEntries.get(file);
    if (manifestEntry?.sourcePath && manifestEntry.sourcePath !== sourcePath) {
      pushIssue(issues, { code: "obsidian-manifest-source-mismatch", message: `Generated note source_path does not match manifest: ${file}`, path: file });
    }
  }
}

async function verifyNoAbsoluteLinks(vaultRoot: string, files: string[], issues: VerificationIssue[]): Promise<void> {
  for (const file of files) {
    const content = await fs.readFile(vaultFsPath(vaultRoot, file), "utf8");
    if (absoluteLinkPattern.test(content)) {
      pushIssue(issues, { code: "obsidian-absolute-link", message: "Found absolute link in Obsidian projection", path: file });
    }
  }
}

async function verifyMarkdownLinks(vaultRoot: string, files: string[], issues: VerificationIssue[]): Promise<void> {
  const existingFiles = new Set(files);
  const markdownHeadings = await markdownHeadingIndex(vaultRoot, files);
  const baseViews = await baseViewIndex(vaultRoot, files);
  const markdownLinkPattern = /(?<!!)\[[^\]\r\n]+\]\(([^)\r\n]+)\)/g;
  const wikiLinkPattern = /!?\[\[([^\]\r\n]+)\]\]/g;
  const anchorExists = ({ target, anchor }: VaultLinkTarget): boolean => {
    if (!anchor || anchor.startsWith("^")) {
      return true;
    }
    const anchors = new Set([anchor, decodeAnchor(anchor)]);
    if (target.endsWith(".md")) {
      const headings = markdownHeadings.get(target) ?? new Set();
      return [...anchors].some((candidate) => headings.has(candidate));
    }
    if (target.endsWith(".base")) {
      const views = baseViews.get(target) ?? new Set();
      return [...anchors].some((candidate) => views.has(candidate));
    }
    return true;
  };
  for (const file of files.filter((filePath) => filePath.endsWith(".md"))) {
    const content = await fs.readFile(vaultFsPath(vaultRoot, file), "utf8");
    const targets = [
      ...[...content.matchAll(markdownLinkPattern)].flatMap((match) => vaultLinkTargetCandidates(file, match[1]?.trim() ?? "", false)),
      ...[...content.matchAll(wikiLinkPattern)].flatMap((match) => vaultLinkTargetCandidates(file, match[1]?.trim() ?? "", true))
    ];
    for (const linkTarget of targets) {
      const { target, anchor } = linkTarget;
      if (isOptionalUserNoteTarget(target)) {
        continue;
      }
      if (!isRelativeVaultPath(target) || !existingFiles.has(target)) {
        pushIssue(issues, { code: "broken-obsidian-markdown-link", message: `Obsidian Markdown link target is missing: ${target}`, path: file });
        continue;
      }
      if (!anchorExists(linkTarget)) {
        pushIssue(issues, { code: "broken-obsidian-markdown-anchor", message: `Obsidian Markdown link anchor is missing: ${target}#${anchor}`, path: file });
      }
    }
  }
}

function isVaultFilePathString(value: string): boolean {
  return /\.(md|canvas|base)$/i.test(value);
}

function verifyJsonVaultPathStrings(vaultPath: string, value: unknown, existingFiles: Set<string>, issues: VerificationIssue[]): void {
  for (const item of collectJsonStrings(value)) {
    if (!isVaultFilePathString(item)) {
      continue;
    }
    if (!isRelativeVaultPath(item) || !existingFiles.has(item)) {
      pushIssue(issues, { code: "invalid-obsidian-ui-config", message: `Optional Obsidian UI config path is missing or unsafe: ${item}`, path: vaultPath });
    }
  }
}

async function verifyOptionalUiConfig(vaultRoot: string, files: string[], issues: VerificationIssue[]): Promise<void> {
  const existingFiles = new Set(files);
  async function readUiJson(vaultPath: string): Promise<unknown | null> {
    try {
      const value = await fs.readJson(vaultFsPath(vaultRoot, vaultPath));
      if (containsUnsafePathString(value)) {
        pushIssue(issues, { code: "invalid-obsidian-ui-config", message: `Optional Obsidian UI config contains an absolute path: ${vaultPath}`, path: vaultPath });
      }
      verifyJsonVaultPathStrings(vaultPath, value, existingFiles, issues);
      return value;
    } catch {
      pushIssue(issues, { code: "invalid-obsidian-ui-config", message: `Optional Obsidian UI config JSON is invalid: ${vaultPath}`, path: vaultPath });
      return null;
    }
  }

  const directUiRoot = vaultFsPath(vaultRoot, ".obsidian");
  for (const file of await listDirectJsonFiles(directUiRoot)) {
    await readUiJson(`.obsidian/${file}`);
  }

  const suggestedDirPath = vaultFsPath(vaultRoot, suggestedUiDir);
  if (!(await fs.pathExists(suggestedDirPath))) {
    return;
  }

  const suggestedFiles = new Set(await listJsonFiles(suggestedDirPath));
  for (const file of requiredSuggestedUiFiles) {
    if (!suggestedFiles.has(file)) {
      pushIssue(issues, { code: "invalid-obsidian-ui-config", message: `Optional Obsidian UI suggestion is missing: ${suggestedUiDir}/${file}`, path: `${suggestedUiDir}/${file}` });
    }
  }

  const suggestedJson = new Map<string, unknown | null>();
  for (const file of suggestedFiles) {
    suggestedJson.set(file, await readUiJson(`${suggestedUiDir}/${file}`));
  }

  const bookmarksPath = `${suggestedUiDir}/bookmarks.json`;
  const bookmarks = suggestedJson.get("bookmarks.json") ?? null;
  if (bookmarks) {
    const bookmarkStrings = new Set(collectJsonStrings(bookmarks));
    for (const requiredPath of requiredBookmarkPaths) {
      if (!bookmarkStrings.has(requiredPath)) {
        pushIssue(issues, {
          code: "invalid-obsidian-ui-config",
          message: `Optional Obsidian UI bookmarks are missing route: ${requiredPath}`,
          path: bookmarksPath
        });
      }
    }
  }

  const workspacePath = `${suggestedUiDir}/workspace.json`;
  const workspace = suggestedJson.get("workspace.json") ?? null;
  if (workspace) {
    const workspaceStrings = new Set(collectJsonStrings(workspace));
    for (const requiredPath of requiredWorkspacePaths) {
      if (!workspaceStrings.has(requiredPath)) {
        pushIssue(issues, {
          code: "invalid-obsidian-ui-config",
          message: `Optional Obsidian UI workspace is missing route: ${requiredPath}`,
          path: workspacePath
        });
      }
    }
  }
}

export async function verifyObsidianVault({ projectRoot, vaultRoot }: VerifyObsidianOptions): Promise<VerificationResult> {
  const issues: VerificationIssue[] = [];
  const resolvedProjectRoot = path.resolve(projectRoot);
  const resolvedVaultRoot = path.resolve(vaultRoot);
  const sourceRootIssues = await projectRootIssues(resolvedProjectRoot);
  if (sourceRootIssues.length > 0) {
    return { ok: false, issues: sourceRootIssues };
  }
  const { config, issues: configIssues } = await readProjectConfig(resolvedProjectRoot);
  if (!config) {
    return { ok: false, issues: configIssues };
  }
  for (const stepDir of STEP_DIRS) {
    const stepPath = path.join(resolvedProjectRoot, stepDir);
    if (!(await fs.pathExists(stepPath)) || !(await fs.stat(stepPath)).isDirectory()) {
      return {
        ok: false,
        issues: [{ code: "invalid-export-project", message: `Source project is missing Step directory: ${stepDir}`, path: stepDir }]
      };
    }
  }
  if (!(await fs.pathExists(resolvedVaultRoot))) {
    return {
      ok: false,
      issues: [{ code: "missing-obsidian-dashboard", message: "Obsidian vault projection directory does not exist", path: resolvedVaultRoot }]
    };
  }
  const vaultStat = await fs.stat(resolvedVaultRoot);
  if (!vaultStat.isDirectory()) {
    return {
      ok: false,
      issues: [{ code: "obsidian-vault-not-directory", message: "Obsidian vault projection path must be a directory", path: resolvedVaultRoot }]
    };
  }

  await verifyRequiredFiles(resolvedVaultRoot, issues);
  await verifyCanvasFiles(resolvedVaultRoot, issues);
  const manifest = await verifyManifest(resolvedProjectRoot, resolvedVaultRoot, issues);
  const files = await listVaultFiles(resolvedVaultRoot);
  await verifyAgentHandoff(resolvedVaultRoot, files, issues);
  await verifyShotReviewPages(resolvedVaultRoot, files, issues);
  await verifyGeneratedMarkdown(resolvedProjectRoot, resolvedVaultRoot, files, manifest, issues);
  await verifyNoAbsoluteLinks(resolvedVaultRoot, files, issues);
  await verifyMarkdownLinks(resolvedVaultRoot, files, issues);
  await verifyOptionalUiConfig(resolvedVaultRoot, files, issues);
  return { ok: issues.length === 0, issues };
}
