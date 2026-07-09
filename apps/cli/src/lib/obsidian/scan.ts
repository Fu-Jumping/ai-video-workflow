import fs from "fs-extra";
import path from "node:path";

import { toVaultPath } from "./paths.js";
import type { ObsidianSourceFile, ObsidianSourceKind } from "./types.js";

const stepDirs: Array<{ dir: string; step: number; sourceKind: ObsidianSourceKind }> = [
  { dir: "01_concept", step: 1, sourceKind: "concept" },
  { dir: "02_setting", step: 2, sourceKind: "setting" },
  { dir: "03_storyboard", step: 3, sourceKind: "storyboard" },
  { dir: "04_image_prompts", step: 4, sourceKind: "image-prompt" },
  { dir: "05_video_prompts", step: 5, sourceKind: "video-prompt" },
  { dir: "06_execution_plan", step: 6, sourceKind: "execution-plan" }
];

function inferShotId(fileName: string): string | undefined {
  const match = fileName.match(/shot[-_ ]?(\d+)/i);
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
