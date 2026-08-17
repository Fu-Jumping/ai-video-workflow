import fs from "fs-extra";
import path from "node:path";

import { activeWorkflowSteps } from "../constants.js";
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
  for (const stepDir of stepDirs) {
    const fullDir = path.join(projectRoot, stepDir.dir);
    if (!(await fs.pathExists(fullDir))) {
      continue;
    }
    const entries = await walkMarkdownFiles(fullDir);
    for (const entry of entries) {
      const filePath = path.join(fullDir, ...entry.split("/"));
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
