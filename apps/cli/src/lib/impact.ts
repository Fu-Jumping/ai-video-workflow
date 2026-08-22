import fs from "fs-extra";
import path from "node:path";

import { WORKFLOW_STEPS } from "./constants.js";
import { extractReferenceAssets } from "./reference-assets.js";
import {
  buildShotGraph,
  shotGroupIdFromPath,
  shotIdFromFileName,
  type ShotGraph
} from "./shot-graph.js";

export interface ImpactFileHit {
  /** Project-relative POSIX path. */
  relPath: string;
  step: number;
  stepDir: string;
  stepLabel: string;
  groupId?: string;
  shotId?: string;
  occurrences: number;
}

export interface ImpactResult {
  keyword: string;
  matches: ImpactFileHit[];
  reviewCandidates: ImpactFileHit[];
  affectedShots: string[];
  notes: string[];
}

const stepByDirectory = new Map<string, { step: number; label: string }>();
for (const item of WORKFLOW_STEPS) {
  stepByDirectory.set(item.directory, { step: item.step, label: item.label });
}

function normalizeRelPath(value: string): string {
  return value.replace(/\\/g, "/");
}

async function walkMarkdownFiles(root: string, current = root): Promise<string[]> {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdownFiles(root, fullPath)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(normalizeRelPath(path.relative(root, fullPath)));
    }
  }
  return files.sort();
}

function countOccurrences(content: string, needle: string): number {
  const source = content.toLocaleLowerCase();
  const target = needle.toLocaleLowerCase();
  if (target.length === 0) {
    return 0;
  }
  let count = 0;
  let index = 0;
  while ((index = source.indexOf(target, index)) !== -1) {
    count += 1;
    index += target.length;
  }
  return count;
}

function toHit(relPath: string, stepDir: string, occurrences: number): ImpactFileHit {
  const meta = stepByDirectory.get(stepDir);
  const fileName = path.posix.basename(relPath);
  return {
    relPath,
    step: meta?.step ?? -1,
    stepDir,
    stepLabel: meta?.label ?? stepDir,
    groupId: shotGroupIdFromPath(relPath),
    shotId: shotIdFromFileName(fileName),
    occurrences
  };
}

function shotIdsForPath(graph: ShotGraph, relPath: string): string[] {
  const matching = graph.files.filter((file) => file.relPath === relPath);
  if (matching.length > 0) {
    return [...new Set(matching.map((file) => file.shotId).filter((value): value is string => Boolean(value)))];
  }
  const shotId = shotIdFromFileName(path.posix.basename(relPath));
  return shotId ? [shotId] : [];
}

function collectShotDownstream(graph: ShotGraph, relPath: string, sourceStep: number, seen: Set<string>): void {
  for (const shotId of shotIdsForPath(graph, relPath)) {
    for (const shot of graph.shots.filter((candidate) => candidate.id === shotId)) {
      if (sourceStep <= 3) {
        for (const file of shot.imagePrompts) {
          seen.add(file.relPath);
        }
      }
      if (sourceStep <= 4 && shot.videoPrompt) {
        seen.add(shot.videoPrompt.relPath);
      }
    }
  }
}

function collectReferenceTokenFiles(
  projectRoot: string,
  matchedTokens: string[],
  directPaths: Set<string>
): Promise<Set<string>> {
  return collectFilesContainingAny(projectRoot, matchedTokens, directPaths);
}

async function collectFilesContainingAny(
  projectRoot: string,
  needles: string[],
  directPaths: Set<string>
): Promise<Set<string>> {
  const result = new Set<string>();
  if (needles.length === 0) {
    return result;
  }
  const normalizedNeedles = needles.map((needle) => needle.toLocaleLowerCase()).filter((needle) => needle.length > 0);
  if (normalizedNeedles.length === 0) {
    return result;
  }
  for (const item of WORKFLOW_STEPS) {
    const stepRoot = path.join(projectRoot, item.directory);
    if (!(await fs.pathExists(stepRoot))) {
      continue;
    }
    const relFiles = await walkMarkdownFiles(stepRoot);
    for (const withinStep of relFiles) {
      const relPath = normalizeRelPath(path.posix.join(item.directory, withinStep));
      if (directPaths.has(relPath)) {
        continue;
      }
      const content = await fs.readFile(path.join(projectRoot, ...relPath.split("/")), "utf8");
      const lower = content.toLocaleLowerCase();
      if (normalizedNeedles.some((needle) => lower.includes(needle))) {
        result.add(relPath);
      }
    }
  }
  return result;
}

function matchedReferenceTokens(content: string, keyword: string): string[] {
  const keywordLower = keyword.toLocaleLowerCase();
  return extractReferenceAssets(content)
    .map((asset) => asset.token)
    .filter((token) => token.toLocaleLowerCase().includes(keywordLower));
}

export async function analyzeImpact(projectRoot: string, keyword: string): Promise<ImpactResult> {
  const trimmed = keyword.trim();
  if (trimmed.length === 0) {
    throw new Error("Impact keyword must not be empty.");
  }

  const matches = new Map<string, ImpactFileHit>();
  for (const item of WORKFLOW_STEPS) {
    const stepRoot = path.join(projectRoot, item.directory);
    if (!(await fs.pathExists(stepRoot))) {
      continue;
    }
    const relFiles = await walkMarkdownFiles(stepRoot);
    for (const withinStep of relFiles) {
      const relPath = normalizeRelPath(path.posix.join(item.directory, withinStep));
      const content = await fs.readFile(path.join(projectRoot, ...relPath.split("/")), "utf8");
      const count = countOccurrences(content, trimmed);
      if (count > 0) {
        matches.set(relPath, toHit(relPath, item.directory, count));
      }
    }
  }

  const directPaths = new Set(matches.keys());
  const reviewPaths = new Set<string>();
  const graph = await buildShotGraph(projectRoot);

  // Shot-chain propagation: Step 3/4/5 changes imply later files in the same shot.
  for (const hit of matches.values()) {
    if (hit.step === 3 || hit.step === 4 || hit.step === 5) {
      collectShotDownstream(graph, hit.relPath, hit.step, reviewPaths);
    }
  }

  // Reference-token propagation: if the keyword corresponds to a declared Step 2 asset
  // (`@角色三视图` / `@场景场景图`), find downstream files that carry that exact token.
  const matchedTokens = new Set<string>();
  for (const hit of matches.values()) {
    if (hit.step <= 2) {
      const content = await fs.readFile(path.join(projectRoot, ...hit.relPath.split("/")), "utf8");
      for (const token of matchedReferenceTokens(content, trimmed)) {
        matchedTokens.add(token);
      }
    }
  }
  const tokenFiles = await collectReferenceTokenFiles(projectRoot, [...matchedTokens], directPaths);
  for (const relPath of tokenFiles) {
    reviewPaths.add(relPath);
  }

  // Remove paths that are already direct matches from the "additional review" list.
  for (const relPath of reviewPaths) {
    if (directPaths.has(relPath)) {
      reviewPaths.delete(relPath);
    }
  }

  const affectedShots = new Set<string>();
  const allAffected = [...directPaths, ...reviewPaths];
  for (const relPath of allAffected) {
    for (const shotId of shotIdsForPath(graph, relPath)) {
      affectedShots.add(shotId);
    }
  }

  const reviewHits = [...reviewPaths]
    .map((relPath) => {
      const stepDir = relPath.split("/")[0] ?? "";
      const direct = matches.get(relPath);
      return toHit(relPath, stepDir, direct?.occurrences ?? 0);
    })
    .sort((left, right) => left.step - right.step || left.relPath.localeCompare(right.relPath));

  const notes = [
    "排序按步骤和路径；`matches` 是直接包含关键词的文件。",
    "`reviewCandidates` 是未直接命中、但位于同镜头下游链或携带匹配 Step 2 参考资产 token 的待复核文件。",
    "这是文本/结构辅助，不等同于完整语义影响分析；仍需按影响面排查手册人工复核色彩、动作、视线、母题等语义影响。"
  ];

  return {
    keyword: trimmed,
    matches: [...matches.values()].sort((left, right) => left.step - right.step || left.relPath.localeCompare(right.relPath)),
    reviewCandidates: reviewHits,
    affectedShots: [...affectedShots].sort(),
    notes
  };
}

export function renderImpactResult(result: ImpactResult): string {
  const lines: string[] = [];
  lines.push(`Impact analysis for "${result.keyword}"`);
  lines.push("");
  lines.push(`Direct matches (${result.matches.length}):`);
  for (const hit of result.matches) {
    lines.push(`- [Step ${hit.step} ${hit.stepLabel}] ${hit.relPath} (${hit.occurrences})${hit.shotId ? ` [${hit.shotId}]` : ""}`);
  }
  lines.push("");
  lines.push(`Additional review candidates (${result.reviewCandidates.length}):`);
  for (const hit of result.reviewCandidates) {
    lines.push(`- [Step ${hit.step} ${hit.stepLabel}] ${hit.relPath}${hit.shotId ? ` [${hit.shotId}]` : ""}`);
  }
  lines.push("");
  lines.push(`Affected shots (${result.affectedShots.length}): ${result.affectedShots.length > 0 ? result.affectedShots.join(", ") : "none"}`);
  lines.push("");
  for (const note of result.notes) {
    lines.push(`Note: ${note}`);
  }
  return lines.join("\n");
}
