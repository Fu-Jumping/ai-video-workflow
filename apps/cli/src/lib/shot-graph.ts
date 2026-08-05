import fs from "fs-extra";
import path from "node:path";

import { STEP_DIR_BY_NUMBER } from "./constants.js";

export type ShotGraphStep = 3 | 4 | 5;

export interface ShotGraphFile {
  step: ShotGraphStep;
  relPath: string;
  fileName: string;
  content: string;
  groupId?: string;
  shotId?: string;
  keyframeId?: string;
}

export interface ShotGraphShot {
  id: string;
  groupId?: string;
  storyboard?: ShotGraphFile;
  imagePrompts: ShotGraphFile[];
  videoPrompt?: ShotGraphFile;
  storyboardSegments: number[];
  videoPromptShots: number[];
  files: ShotGraphFile[];
}

export interface ShotGraphGroup {
  id: string;
  directoryName: string;
  description?: ShotGraphFile;
  shots: ShotGraphShot[];
}

export interface DuplicateShotFile {
  shotId: string;
  step: ShotGraphStep;
  relPaths: string[];
}

export interface ShotGroupMismatch {
  shotId: string;
  groupIds: string[];
  relPaths: string[];
}

export interface ShotGraph {
  files: ShotGraphFile[];
  shots: ShotGraphShot[];
  groups: ShotGraphGroup[];
  ungroupedShotFiles: ShotGraphFile[];
  duplicateShotFiles: DuplicateShotFile[];
  groupMismatches: ShotGroupMismatch[];
}

const groupDirectoryPattern = /^(?:镜头组|shot-group)[-_ ]?(\d+)$/iu;
const shotFilePattern = /(?:^|[-_ ])(?:镜头|shot)[-_ ]?(\d+)/iu;
const keyframeFilePattern = /(?:关键帧|keyframe)[-_ ]?(\d+)/iu;
const markdownLinkPattern = /\]\(([^)]+)\)/g;

function normalizeRelPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function canonicalNumber(value: string, width: number): string {
  return Number.parseInt(value, 10).toString().padStart(width, "0");
}

export function shotGroupIdFromPath(relPath: string): string | undefined {
  for (const segment of normalizeRelPath(relPath).split("/")) {
    const match = segment.match(groupDirectoryPattern);
    if (match?.[1]) {
      return `group-${canonicalNumber(match[1], 3)}`;
    }
  }
  return undefined;
}

export function shotGroupDirectoryName(groupId: string): string {
  const number = groupId.match(/(\d+)$/)?.[1] ?? groupId;
  return `镜头组-${canonicalNumber(number, 3)}`;
}

export function shotIdFromFileName(fileName: string): string | undefined {
  const baseName = path.basename(fileName, path.extname(fileName));
  const match = baseName.match(shotFilePattern);
  return match?.[1] ? `shot-${canonicalNumber(match[1], 3)}` : undefined;
}

export function shotFileNumber(shotId: string): string {
  const number = shotId.match(/(\d+)$/)?.[1] ?? shotId;
  return canonicalNumber(number, 3);
}

export function keyframeIdFromFileName(fileName: string): string | undefined {
  const match = path.basename(fileName, path.extname(fileName)).match(keyframeFilePattern);
  return match?.[1] ? `keyframe-${canonicalNumber(match[1], 2)}` : undefined;
}

export function storyboardSegmentNumbers(content: string): number[] {
  const numbers = [...content.matchAll(/^#{2,4}\s+分镜\s*([0-9]+)\s*$/gmu)].map((match) => Number.parseInt(match[1] ?? "", 10));
  return numbers.filter((value) => Number.isFinite(value));
}

export function videoPromptShotNumbers(content: string): number[] {
  const numbers = [...content.matchAll(/^镜头\s*([0-9]+)\s*[：:]/gmu)].map((match) => Number.parseInt(match[1] ?? "", 10));
  return numbers.filter((value) => Number.isFinite(value));
}

export function keyframeMappedSegment(content: string): number | undefined {
  const value = content.match(/对应分镜\s*[：:]\s*(?:分镜\s*)?([0-9]+)/u)?.[1];
  return value ? Number.parseInt(value, 10) : undefined;
}

async function walkMarkdownFiles(root: string, current = root): Promise<string[]> {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdownFiles(root, fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(normalizeRelPath(path.relative(root, fullPath)));
    }
  }
  return files.sort();
}

export async function listStepMarkdownFiles(projectRoot: string, step: ShotGraphStep): Promise<ShotGraphFile[]> {
  const stepDir = STEP_DIR_BY_NUMBER[step];
  const fullStepDir = path.join(projectRoot, stepDir);
  if (!(await fs.pathExists(fullStepDir))) {
    return [];
  }
  const relFiles = await walkMarkdownFiles(fullStepDir);
  return Promise.all(
    relFiles.map(async (withinStep) => {
      const relPath = normalizeRelPath(path.posix.join(stepDir, withinStep));
      const fileName = path.posix.basename(relPath);
      return {
        step,
        relPath,
        fileName,
        content: await fs.readFile(path.join(projectRoot, ...relPath.split("/")), "utf8"),
        groupId: shotGroupIdFromPath(relPath),
        shotId: shotIdFromFileName(fileName),
        keyframeId: step === 4 ? keyframeIdFromFileName(fileName) : undefined
      } satisfies ShotGraphFile;
    })
  );
}

export function resolveProjectMarkdownLink(sourceRelPath: string, rawTarget: string): string | undefined {
  const target = rawTarget.trim().split("#", 1)[0]?.replace(/\\/g, "/");
  if (!target || /^[a-z]+:/iu.test(target) || target.startsWith("/")) {
    return undefined;
  }
  return path.posix.normalize(path.posix.join(path.posix.dirname(normalizeRelPath(sourceRelPath)), target));
}

export function linkedStepFiles(file: ShotGraphFile, step: ShotGraphStep): string[] {
  const targetDir = `${STEP_DIR_BY_NUMBER[step]}/`;
  const links: string[] = [];
  for (const match of file.content.matchAll(markdownLinkPattern)) {
    const resolved = resolveProjectMarkdownLink(file.relPath, match[1] ?? "");
    if (resolved?.startsWith(targetDir)) {
      links.push(resolved);
    }
  }
  return [...new Set(links)];
}

export async function buildShotGraph(projectRoot: string): Promise<ShotGraph> {
  const stepFiles = await Promise.all([3, 4, 5].map((step) => listStepMarkdownFiles(projectRoot, step as ShotGraphStep)));
  const files = stepFiles.flat();
  const byShot = new Map<string, ShotGraphFile[]>();
  for (const file of files) {
    if (!file.shotId) {
      continue;
    }
    const bucket = byShot.get(file.shotId) ?? [];
    bucket.push(file);
    byShot.set(file.shotId, bucket);
  }

  const duplicateShotFiles: DuplicateShotFile[] = [];
  const groupMismatches: ShotGroupMismatch[] = [];
  const shots = [...byShot.entries()]
    .map(([id, shotFiles]) => {
      for (const step of [3, 5] as const) {
        const sameStep = shotFiles.filter((file) => file.step === step);
        if (sameStep.length > 1) {
          duplicateShotFiles.push({ shotId: id, step, relPaths: sameStep.map((file) => file.relPath) });
        }
      }
      const imagePromptKeyframes = new Map<string, ShotGraphFile[]>();
      for (const file of shotFiles.filter((candidate) => candidate.step === 4 && candidate.keyframeId)) {
        const bucket = imagePromptKeyframes.get(file.keyframeId ?? "") ?? [];
        bucket.push(file);
        imagePromptKeyframes.set(file.keyframeId ?? "", bucket);
      }
      for (const keyframeFiles of imagePromptKeyframes.values()) {
        if (keyframeFiles.length > 1) {
          duplicateShotFiles.push({ shotId: id, step: 4, relPaths: keyframeFiles.map((file) => file.relPath) });
        }
      }
      const groupIds = [...new Set(shotFiles.map((file) => file.groupId).filter((value): value is string => Boolean(value)))];
      if (groupIds.length > 1) {
        groupMismatches.push({ shotId: id, groupIds, relPaths: shotFiles.map((file) => file.relPath) });
      }
      const imagePrompts = shotFiles
        .filter((file) => file.step === 4)
        .sort((left, right) => (left.keyframeId ?? "").localeCompare(right.keyframeId ?? "") || left.relPath.localeCompare(right.relPath));
      return {
        id,
        groupId: groupIds[0],
        storyboard: shotFiles.find((file) => file.step === 3),
        imagePrompts,
        videoPrompt: shotFiles.find((file) => file.step === 5),
        storyboardSegments: storyboardSegmentNumbers(shotFiles.find((file) => file.step === 3)?.content ?? ""),
        videoPromptShots: videoPromptShotNumbers(shotFiles.find((file) => file.step === 5)?.content ?? ""),
        files: [...shotFiles].sort((left, right) => left.step - right.step || left.relPath.localeCompare(right.relPath))
      } satisfies ShotGraphShot;
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  const groups = [...new Set(files.map((file) => file.groupId).filter((value): value is string => Boolean(value)))]
    .sort()
    .map((id) => ({
      id,
      directoryName: shotGroupDirectoryName(id),
      description: files.find(
        (file) => file.step === 3 && file.groupId === id && !file.shotId && /^(?:00[-_ ])?(?:镜头组说明|shot-group-notes)\.md$/iu.test(file.fileName)
      ),
      shots: shots.filter((shot) => shot.groupId === id)
    }));

  return {
    files,
    shots,
    groups,
    ungroupedShotFiles: files.filter((file) => file.shotId && !file.groupId),
    duplicateShotFiles,
    groupMismatches
  };
}
