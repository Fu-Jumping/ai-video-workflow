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
        title: titleFromFileName(entry),
        headingTitle: titleFromMarkdownContent(content, titleFromFileName(entry)),
        shotGroupId: shotGroupIdFromPath(sourcePath),
        shotId: shotIdFromFileName(entry),
        referenceAssets: extractReferenceAssets(content)
      });
    }
  }
  return files;
}

async function walkMarkdownFiles(root: string, current = root): Promise<string[]> {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdownFiles(root, fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(toVaultPath(path.relative(root, fullPath)));
    }
  }
  return files.sort();
}
