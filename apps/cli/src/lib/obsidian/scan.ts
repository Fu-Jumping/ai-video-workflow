import fs from "fs-extra";
import path from "node:path";

import { CONTENT_ROOT_DIRECTORY, activeWorkflowSteps } from "../constants.js";
import { expectedExecutionPaths } from "../content-assemble.js";
import { hasMigrationSnapshot, resolveContentMode } from "../content-tree.js";
import { readWorkflowProjectConfig } from "../project-root.js";
import { extractReferenceAssets } from "../reference-assets.js";
import { shotGroupIdFromPath, shotIdFromFileName } from "../shot-graph.js";
import { toVaultPath } from "./paths.js";
import type { ObsidianSourceFile, ObsidianSourceKind } from "./types.js";

function titleFromFileName(fileName: string): string {
  return path
    .basename(fileName, ".md")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// Source cards live under `_资料库/SRC-xxxx/source-card.md`. Projecting them by file name alone
// would map every card to the same "Source Card" title (and vault path), silently overwriting all
// but the last card. Keep the SRC id in the title so each card gets its own projection.
const sourceCardEntryPattern = /^_资料库\/(SRC-\d{4})\/source-card\.md$/;

function titleForEntry(entry: string): string {
  const sourceCardMatch = entry.match(sourceCardEntryPattern);
  if (sourceCardMatch) {
    return `${sourceCardMatch[1]} 来源卡`;
  }
  return titleFromFileName(entry);
}

function titleFromMarkdownContent(content: string, fallback: string): string {
  const heading = content.split(/\r?\n/).find((line) => line.startsWith("# "));
  const title = heading?.replace(/^#\s+/, "").trim();
  return title || fallback;
}

export async function scanProjectForObsidian(projectRoot: string): Promise<ObsidianSourceFile[]> {
  const files: ObsidianSourceFile[] = [];
  const config = await readWorkflowProjectConfig(projectRoot);
  const stepDirs: Array<{ dir: string; step: number; sourceKind: ObsidianSourceKind }> = activeWorkflowSteps(config).map((step) => ({
    dir: step.directory,
    step: step.step,
    sourceKind: step.sourceKind
  }));
  // 内容树模式下，04／05 的原路径已被重新生成的执行文件占用；只有「有迁移快照、又不是当前执行文件」
  // 的才是旧正文。这类旧正文只是历史快照（规范 §7.8）：原件留在原路径，但不再投影，
  // 否则观看层里会同时出现两套正文，读者分不清哪套是当前原文。
  const executionPaths = await expectedExecutionPaths(projectRoot);
  for (const stepDir of stepDirs) {
    const fullDir = path.join(projectRoot, stepDir.dir);
    if (!(await fs.pathExists(fullDir))) {
      continue;
    }
    const entries = await walkMarkdownFiles(fullDir);
    for (const entry of entries) {
      const filePath = path.join(fullDir, ...entry.split("/"));
      const projectRelPath = path.posix.join(stepDir.dir, entry);
      if (!executionPaths.has(projectRelPath) && (await hasMigrationSnapshot(projectRoot, projectRelPath))) {
        continue;
      }
      const content = await fs.readFile(filePath, "utf8");
      const sourcePath = toVaultPath(path.posix.join(stepDir.dir, entry));
      files.push({
        sourcePath,
        sourceKind: stepDir.sourceKind,
        step: stepDir.step,
        title: titleForEntry(entry),
        headingTitle: titleFromMarkdownContent(content, titleForEntry(entry)),
        shotGroupId: shotGroupIdFromPath(sourcePath),
        shotId: shotIdFromFileName(entry),
        referenceAssets: extractReferenceAssets(content)
      });
    }
  }
  files.push(...(await scanContentTree(projectRoot)));
  return files;
}

// 内容树是正文唯一事实源（content.format_version=1 时）。它不在 activeWorkflowSteps 里，
// 必须单独扫描并投影，否则内容树页面在观看层里不存在，索引页指向它们的链接全部失效。
const contentStoryboardFilePattern = /^(?:分镜[-_ ]?\d+|00_镜头[-_ ]?\d+)\.md$/iu;

async function scanContentTree(projectRoot: string): Promise<ObsidianSourceFile[]> {
  const resolution = await resolveContentMode(projectRoot);
  if (resolution.mode !== "content-tree") {
    return [];
  }
  const contentRoot = path.join(projectRoot, CONTENT_ROOT_DIRECTORY);
  if (!(await fs.pathExists(contentRoot))) {
    return [];
  }
  const entries = await walkMarkdownFiles(contentRoot);
  const files: ObsidianSourceFile[] = [];
  for (const entry of entries) {
    const filePath = path.join(contentRoot, ...entry.split("/"));
    const content = await fs.readFile(filePath, "utf8");
    const sourcePath = toVaultPath(path.posix.join(CONTENT_ROOT_DIRECTORY, entry));
    const fileName = path.posix.basename(entry);
    const sourceKind: ObsidianSourceKind = contentStoryboardFilePattern.test(fileName) ? "storyboard" : "index";
    // 内容树的文件名是编号（00_镜头-001.md、分镜-01.md），拿它当标题只会显示成 "00 镜头 001"；
    // 展示名取 H1，编号身份另由目录与文件名推导。
    const fallbackTitle = titleForEntry(fileName);
    files.push({
      sourcePath,
      sourceKind,
      step: 3,
      title: titleFromMarkdownContent(content, fallbackTitle),
      headingTitle: titleFromMarkdownContent(content, fallbackTitle),
      shotGroupId: shotGroupIdFromPath(sourcePath),
      shotId: shotIdFromFileName(fileName),
      referenceAssets: extractReferenceAssets(content)
    });
  }
  return files;
}

// Research archive subdirectories (raw extracts, media, comment samples, browser profiles) are
// gitignored and must not be projected into the Obsidian viewing layer.
const ignoredScanDirectories = new Set(["raw", "media", "full-comments", "browser-profile", "cookies", "_inbox"]);

async function walkMarkdownFiles(root: string, current = root): Promise<string[]> {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      if (ignoredScanDirectories.has(entry.name)) {
        continue;
      }
      files.push(...(await walkMarkdownFiles(root, fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(toVaultPath(path.relative(root, fullPath)));
    }
  }
  return files.sort();
}