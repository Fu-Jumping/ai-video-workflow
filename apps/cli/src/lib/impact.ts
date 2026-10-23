import fs from "fs-extra";
import path from "node:path";

import { CONTENT_ROOT_DIRECTORY, WORKFLOW_STEPS } from "./constants.js";
import { buildContentTree, resolveContentMode } from "./content-tree.js";
import { extractReferenceAssets } from "./reference-assets.js";
import {
  buildShotGraph,
  shotGroupIdFromPath,
  shotIdFromFileName,
  type ShotGraph
} from "./shot-graph.js";
import { buildLibTvPlan } from "./libtv/assets.js";
import { readState } from "./libtv/project-binding.js";

export interface ImpactFileHit {
  /** Project-relative POSIX path. */
  relPath: string;
  step: number;
  stepDir: string;
  stepLabel: string;
  groupId?: string;
  shotId?: string;
  /** 内容树模式下命中分镜文件时的分镜身份（storyboard-01）；旧格式项目不填。 */
  storyboardId?: string;
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

/** 内容树（内容/）的步骤归类：它是步骤三的正文，目录却不在 WORKFLOW_STEPS 里。 */
const CONTENT_TREE_STEP = 3;
const CONTENT_TREE_STEP_LABEL = "内容树";

function normalizeRelPath(value: string): string {
  return value.replace(/\\/g, "/");
}

/**
 * 内容树（内容/）在影响分析里的检索索引。
 *
 * 内容树不在 WORKFLOW_STEPS 里，必须单独纳入检索集，否则改了某个分镜或镜头汇总，
 * 影响分析根本看不见它。旧格式项目返回 null，行为不变。
 */
interface ContentTreeIndex {
  /** 项目相对路径，正斜杠。 */
  files: string[];
  shotIdByPath: Map<string, string>;
  groupIdByPath: Map<string, string>;
  storyboardIdByPath: Map<string, string>;
}

async function readContentTreeIndex(projectRoot: string): Promise<ContentTreeIndex | null> {
  const resolution = await resolveContentMode(projectRoot);
  if (resolution.mode !== "content-tree" || !resolution.contentRootExists) {
    return null;
  }
  const tree = await buildContentTree(projectRoot);
  const files: string[] = [];
  const shotIdByPath = new Map<string, string>();
  const groupIdByPath = new Map<string, string>();
  const storyboardIdByPath = new Map<string, string>();

  const register = (relPath: string, groupId: string, shotId: string): void => {
    files.push(relPath);
    shotIdByPath.set(relPath, shotId);
    groupIdByPath.set(relPath, groupId);
  };

  for (const relPath of [tree.shotOverviewRelPath, tree.storyboardOverviewRelPath]) {
    if (await fs.pathExists(path.join(projectRoot, ...relPath.split("/")))) {
      files.push(relPath);
    }
  }
  for (const scene of tree.scenes) {
    if (await fs.pathExists(path.join(projectRoot, ...scene.overviewRelPath.split("/")))) {
      files.push(scene.overviewRelPath);
    }
    for (const group of scene.groups) {
      if (await fs.pathExists(path.join(projectRoot, ...group.overviewRelPath.split("/")))) {
        files.push(group.overviewRelPath);
      }
    }
  }
  for (const shot of tree.shots) {
    if (await fs.pathExists(path.join(projectRoot, ...shot.relPath.split("/")))) {
      register(shot.relPath, shot.groupId, shot.shotId);
    }
    for (const storyboard of shot.storyboards) {
      register(storyboard.relPath, shot.groupId, shot.shotId);
      storyboardIdByPath.set(storyboard.relPath, storyboard.document.storyboardId);
    }
  }
  return { files, shotIdByPath, groupIdByPath, storyboardIdByPath };
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

function toHit(relPath: string, stepDir: string, occurrences: number, contentTree?: ContentTreeIndex | null): ImpactFileHit {
  const meta = stepByDirectory.get(stepDir);
  const fileName = path.posix.basename(relPath);
  // 内容树里既有镜头文件，也有两张总表、场总览、镜头组总览；按目录判断，
  // 这些文件都要归到步骤三的正文口径里，不能因为不是镜头文件就退化成 -1。
  const inContentTree = stepDir === CONTENT_ROOT_DIRECTORY;
  const hit: ImpactFileHit = {
    relPath,
    // 内容树是正文唯一事实源，归到步骤三分镜脚本的口径里；目录名不是 03 目录，
    // 所以 stepDir 保留「内容」，另用 stepLabel 说明。
    step: inContentTree ? CONTENT_TREE_STEP : (meta?.step ?? -1),
    stepDir,
    stepLabel: inContentTree ? CONTENT_TREE_STEP_LABEL : (meta?.label ?? stepDir),
    groupId: contentTree?.groupIdByPath.get(relPath) ?? shotGroupIdFromPath(relPath),
    shotId: contentTree?.shotIdByPath.get(relPath) ?? shotIdFromFileName(fileName),
    occurrences
  };
  const storyboardId = contentTree?.storyboardIdByPath.get(relPath);
  if (storyboardId) {
    hit.storyboardId = storyboardId;
  }
  return hit;
}

function shotIdsForPath(graph: ShotGraph, relPath: string, contentTree?: ContentTreeIndex | null): string[] {
  // 内容树的镜头汇总与分镜文件直接带镜头身份：命中分镜时也能落到所属镜头。
  const contentTreeShotId = contentTree?.shotIdByPath.get(relPath);
  if (contentTreeShotId) {
    return [contentTreeShotId];
  }
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
  directPaths: Set<string>,
  contentTree?: ContentTreeIndex | null
): Promise<Set<string>> {
  return collectFilesContainingAny(projectRoot, matchedTokens, directPaths, contentTree);
}

async function collectFilesContainingAny(
  projectRoot: string,
  needles: string[],
  directPaths: Set<string>,
  contentTree?: ContentTreeIndex | null
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
  for (const relPath of contentTree?.files ?? []) {
    if (directPaths.has(relPath)) {
      continue;
    }
    const absPath = path.join(projectRoot, ...relPath.split("/"));
    if (!(await fs.pathExists(absPath))) {
      continue;
    }
    const lower = (await fs.readFile(absPath, "utf8")).toLocaleLowerCase();
    if (normalizedNeedles.some((needle) => lower.includes(needle))) {
      result.add(relPath);
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

  const contentTree = await readContentTreeIndex(projectRoot);
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
        matches.set(relPath, toHit(relPath, item.directory, count, contentTree));
      }
    }
  }
  // 内容树（内容/）是正文唯一事实源，必须一起检索；否则改分镜／镜头汇总会被漏掉。
  for (const relPath of contentTree?.files ?? []) {
    const absPath = path.join(projectRoot, ...relPath.split("/"));
    if (!(await fs.pathExists(absPath))) {
      continue;
    }
    const count = countOccurrences(await fs.readFile(absPath, "utf8"), trimmed);
    if (count > 0) {
      matches.set(relPath, toHit(relPath, CONTENT_ROOT_DIRECTORY, count, contentTree));
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
  const tokenFiles = await collectReferenceTokenFiles(projectRoot, [...matchedTokens], directPaths, contentTree);
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
    for (const shotId of shotIdsForPath(graph, relPath, contentTree)) {
      affectedShots.add(shotId);
    }
  }

  const reviewHits = [...reviewPaths]
    .map((relPath) => {
      const stepDir = relPath.split("/")[0] ?? "";
      const direct = matches.get(relPath);
      return toHit(relPath, stepDir, direct?.occurrences ?? 0, contentTree);
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

export async function analyzeImageNodeImpact(projectRoot: string, imageNode: string): Promise<ImpactResult> {
  const state = await readState(projectRoot);
  const plan = await buildLibTvPlan(projectRoot);
  const reviewPaths = new Set<string>();
  const affectedShots = new Set<string>();

  const keyframe = state?.keyframes.find((item) =>
    item.nodeId === imageNode ||
    item.finalNodeId === imageNode ||
    item.refineRounds?.some((round) => round.refineNodeId === imageNode)
  );
  if (keyframe) {
    affectedShots.add(keyframe.shotId);
    const video = plan.videos.find((candidate) =>
      candidate.groupId === keyframe.groupId && candidate.shotId === keyframe.shotId
    );
    if (video) {
      reviewPaths.add(video.sourcePath);
    }
    const candidate = plan.keyframes.find((candidate) =>
      candidate.groupId === keyframe.groupId && candidate.shotId === keyframe.shotId && candidate.keyframeId === keyframe.keyframeId
    );
    if (candidate) {
      reviewPaths.add(candidate.sourcePath);
    }
  } else {
    const anchor = state?.anchors.find((item) =>
      item.nodeId === imageNode ||
      item.finalNodeId === imageNode ||
      item.refineRounds?.some((round) => round.refineNodeId === imageNode)
    );
    if (anchor) {
      for (const keyframe of plan.keyframes.filter((candidate) => candidate.referenceTokens.includes(anchor.token))) {
        reviewPaths.add(keyframe.sourcePath);
        affectedShots.add(keyframe.shotId);
        const video = plan.videos.find((candidate) =>
          candidate.groupId === keyframe.groupId && candidate.shotId === keyframe.shotId
        );
        if (video) {
          reviewPaths.add(video.sourcePath);
        }
      }
      for (const video of plan.videos.filter((candidate) => candidate.referenceTokens.includes(anchor.token))) {
        reviewPaths.add(video.sourcePath);
        affectedShots.add(video.shotId);
      }
    }
  }

  const notes = [
    `已按 LibTV 图片节点 ${imageNode} 定位影响面。`,
    "`reviewCandidates` 是会受该首版/精修图影响的 Step 4/5 源文件，需人工复核。",
    "这是执行层节点关联辅助，不代替语义影响分析。"
  ];

  const reviewHits = [...reviewPaths]
    .map((relPath) => {
      const stepDir = relPath.split("/")[0] ?? "";
      return toHit(relPath, stepDir, 0);
    })
    .sort((left, right) => left.step - right.step || left.relPath.localeCompare(right.relPath));

  return {
    keyword: `image:${imageNode}`,
    matches: [],
    reviewCandidates: reviewHits,
    affectedShots: [...affectedShots].sort(),
    notes
  };
}

/**
 * 命中身份后缀。
 *
 * 旧格式保持原来的 ` [shotId]` 写法；内容树模式命中分镜时，额外标出镜头组与分镜，
 * 说明这一段属于哪个镜头、哪个组。
 */
function hitIdentity(hit: ImpactFileHit): string {
  if (hit.storyboardId) {
    const parts = [hit.groupId, hit.shotId, hit.storyboardId].filter((value): value is string => Boolean(value));
    return ` [${parts.join(" / ")}]`;
  }
  return hit.shotId ? ` [${hit.shotId}]` : "";
}

export function renderImpactResult(result: ImpactResult): string {
  const lines: string[] = [];
  lines.push(`Impact analysis for "${result.keyword}"`);
  lines.push("");
  lines.push(`Direct matches (${result.matches.length}):`);
  for (const hit of result.matches) {
    lines.push(`- [Step ${hit.step} ${hit.stepLabel}] ${hit.relPath} (${hit.occurrences})${hitIdentity(hit)}`);
  }
  lines.push("");
  lines.push(`Additional review candidates (${result.reviewCandidates.length}):`);
  for (const hit of result.reviewCandidates) {
    lines.push(`- [Step ${hit.step} ${hit.stepLabel}] ${hit.relPath}${hitIdentity(hit)}`);
  }
  lines.push("");
  lines.push(`Affected shots (${result.affectedShots.length}): ${result.affectedShots.length > 0 ? result.affectedShots.join(", ") : "none"}`);
  lines.push("");
  for (const note of result.notes) {
    lines.push(`Note: ${note}`);
  }
  return lines.join("\n");
}
