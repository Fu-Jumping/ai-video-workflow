import fs from "fs-extra";
import path from "node:path";

import { WORKFLOW_STEPS } from "../constants.js";
import { toVaultPath } from "./paths.js";
import type { ObsidianSourceFile, ObsidianSourceKind } from "./types.js";

const stepDirs: Array<{ dir: string; step: number; sourceKind: ObsidianSourceKind }> = WORKFLOW_STEPS.map((step) => ({
  dir: step.directory,
  step: step.step,
  sourceKind: step.sourceKind
}));

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

export async function scanProjectForObsidian(projectRoot: string): Promise<ObsidianSourceFile[]> {
  const files: ObsidianSourceFile[] = [];
  for (const stepDir of stepDirs) {
    const fullDir = path.join(projectRoot, stepDir.dir);
    if (!(await fs.pathExists(fullDir))) {
      continue;
    }
    const entries = (await fs.readdir(fullDir)).filter((name) => name.endsWith(".md")).sort();
    for (const entry of entries) {
      files.push({
        sourcePath: toVaultPath(path.join(stepDir.dir, entry)),
        sourceKind: stepDir.sourceKind,
        step: stepDir.step,
        title: titleFromFileName(entry),
        shotId: inferShotId(entry)
      });
    }
  }
  return files;
}
