import fs from "fs-extra";
import path from "node:path";

import { activeWorkflowSteps } from "../constants.js";
import { readWorkflowProjectConfig } from "../project-root.js";
import { extractReferenceAssets } from "../reference-assets.js";
import { toVaultPath } from "./paths.js";
import type { ObsidianSourceFile, ObsidianSourceKind } from "./types.js";

function inferShotId(fileName: string): string | undefined {
  const match = fileName.match(/(?:shot|镜头)[-_ ]?(\d+)/i);
  return match ? `shot-${match[1].padStart(3, "0")}` : undefined;
}

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
    const entries = (await fs.readdir(fullDir)).filter((name) => name.endsWith(".md")).sort();
    for (const entry of entries) {
      const filePath = path.join(fullDir, entry);
      const content = await fs.readFile(filePath, "utf8");
      files.push({
        sourcePath: toVaultPath(path.join(stepDir.dir, entry)),
        sourceKind: stepDir.sourceKind,
        step: stepDir.step,
        title: titleFromFileName(entry),
        headingTitle: titleFromMarkdownContent(content, titleFromFileName(entry)),
        shotId: inferShotId(entry),
        referenceAssets: extractReferenceAssets(content)
      });
    }
  }
  return files;
}
