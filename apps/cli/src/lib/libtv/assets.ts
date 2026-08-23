import fs from "fs-extra";
import path from "node:path";
import { STEP_DIR_BY_NUMBER } from "../constants.js";
import { buildShotGraph, listStepMarkdownFiles } from "../shot-graph.js";
import { declaredReferenceAssetTokens, extractReferenceAssets } from "../reference-assets.js";
import { readProjectConfig } from "../project-config.js";
import type { LibTvAssetRef, LibTvKeyframeRef, LibTvVideoRef } from "./types.js";

const ANCHOR_DIRS = [
  (root: string) => path.join(root, "assets", "anchors"),
  (root: string) => path.join(root, "_assets", "anchors")
];

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"];

function findByToken(root: string, token: string, kind: LibTvAssetRef["kind"]): string | undefined {
  const safeName = token.replace(/^@/, "").replace(/[\/:*?"<>|]/g, "_");
  const subDir = kind === "character-triview" ? "characters" : "scenes";
  for (const anchorRoot of ANCHOR_DIRS) {
    const base = anchorRoot(root);
    for (const ext of IMAGE_EXTENSIONS) {
      const candidate = path.join(base, subDir, `${safeName}${ext}`);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return undefined;
}

const DEFAULT_IMAGE_MODEL_MAP: Record<string, string> = {
  midjourney: "mj-v8.2",
  "gpt-image-2": "lib-image-2"
};

const DEFAULT_VIDEO_MODEL_MAP: Record<string, string> = {
  seedance: "star-video2",
  minimax: "MiniMax-Hailuo-H3"
};

export async function resolveLibtvImageModel(projectRoot: string): Promise<string | undefined> {
  const { config } = await readProjectConfig(projectRoot);
  if (config?.libtv?.image_model) return config.libtv.image_model;
  const platform = config?.platforms.image.default;
  return platform ? DEFAULT_IMAGE_MODEL_MAP[platform] : undefined;
}

export async function resolveLibtvVideoModel(projectRoot: string): Promise<string | undefined> {
  const { config } = await readProjectConfig(projectRoot);
  if (config?.libtv?.video_model) return config.libtv.video_model;
  const platform = config?.platforms.video.default;
  return platform ? DEFAULT_VIDEO_MODEL_MAP[platform] : undefined;
}

export async function discoverAnchorAssets(projectRoot: string): Promise<LibTvAssetRef[]> {
  const refs: LibTvAssetRef[] = [];
  for (const file of ["角色设定.md", "场景设定.md"]) {
    const filePath = path.join(projectRoot, STEP_DIR_BY_NUMBER[2], file);
    if (!(await fs.pathExists(filePath))) {
      continue;
    }
    const content = await fs.readFile(filePath, "utf8");
    for (const token of declaredReferenceAssetTokens(content)) {
      refs.push({
        token: token.token,
        name: token.name,
        kind: token.kind,
        localPath: findByToken(projectRoot, token.token, token.kind)
      });
    }
  }
  return refs.sort((a, b) => a.token.localeCompare(b.token, "zh-CN"));
}

function extractCopyablePrompt(content: string): string {
  const headingMatch = content.match(/^##\s*可复制提示词\s*$/mu);
  if (!headingMatch) return "";
  const after = content.slice((headingMatch.index ?? 0) + headingMatch[0].length);
  const blockMatch = after.match(/```(?:text|markdown)?\s*([\s\S]*?)```/u);
  if (blockMatch) {
    return blockMatch[1].trim();
  }
  return after.split(/^##\s/mu, 1)[0].trim();
}

function parseKeyframeId(fileName: string): string | undefined {
  const match = fileName.match(/(?:关键帧|keyframe)[-_ ]?(\d+)/iu);
  return match ? `keyframe-${Number.parseInt(match[1], 10).toString().padStart(2, "0")}` : undefined;
}

function parseShotId(fileName: string): string | undefined {
  const match = fileName.match(/(?:镜头|shot)[-_ ]?(\d+)/iu);
  return match ? `shot-${Number.parseInt(match[1], 10).toString().padStart(3, "0")}` : undefined;
}

function parseGroupId(relPath: string): string | undefined {
  const match = relPath.match(/镜头组[-_ ]?(\d+)/iu);
  return match ? `group-${Number.parseInt(match[1], 10).toString().padStart(3, "0")}` : undefined;
}

export async function buildKeyframeRefs(projectRoot: string): Promise<LibTvKeyframeRef[]> {
  const files = await listStepMarkdownFiles(projectRoot, 4);
  const modelKey = await resolveLibtvImageModel(projectRoot);
  const { config } = await readProjectConfig(projectRoot);
  const imageSettings = config?.libtv?.image_settings;
  const refs: LibTvKeyframeRef[] = [];
  for (const file of files) {
    const keyframeId = parseKeyframeId(file.fileName);
    const shotId = parseShotId(file.fileName);
    const groupId = parseGroupId(file.relPath);
    if (!keyframeId || !shotId || !groupId) continue;
    const tokens = extractReferenceAssets(file.content);
    refs.push({
      groupId,
      shotId,
      keyframeId,
      sourcePath: file.relPath,
      prompt: extractCopyablePrompt(file.content),
      referenceTokens: tokens.map((token) => token.token),
      modelKey,
      params: imageSettings,
      status: "planned"
    });
  }
  return refs.sort((a, b) => a.groupId.localeCompare(b.groupId) || a.shotId.localeCompare(b.shotId) || a.keyframeId.localeCompare(b.keyframeId));
}

export async function buildVideoRefs(projectRoot: string): Promise<LibTvVideoRef[]> {
  const files = await listStepMarkdownFiles(projectRoot, 5);
  const modelKey = await resolveLibtvVideoModel(projectRoot);
  const { config } = await readProjectConfig(projectRoot);
  const videoSettings = config?.libtv?.video_settings;
  const refs: LibTvVideoRef[] = [];
  for (const file of files) {
    const shotId = parseShotId(file.fileName);
    const groupId = parseGroupId(file.relPath);
    if (!shotId || !groupId) continue;
    const tokens = extractReferenceAssets(file.content);
    const keyframePaths = [...file.content.matchAll(/关键帧文件[^：:]*[：:]\s*`([^`]+)`/gu)].map((match) => match[1] ?? "");
    const orderMatch = file.content.match(/素材上传顺序\s*[：:]\s*([^\n]+)/u);
    const orderTokens = orderMatch
      ? orderMatch[1].split(/[、,，]/u).map((item) => item.trim()).filter(Boolean)
      : undefined;
    refs.push({
      groupId,
      shotId,
      sourcePath: file.relPath,
      prompt: extractCopyablePrompt(file.content),
      referenceTokens: tokens.map((token) => token.token),
      keyframePaths,
      modelKey,
      orderTokens,
      params: videoSettings,
      status: "planned"
    });
  }
  return refs.sort((a, b) => a.groupId.localeCompare(b.groupId) || a.shotId.localeCompare(b.shotId));
}

export async function buildLibTvPlan(projectRoot: string): Promise<{ anchors: LibTvAssetRef[]; keyframes: LibTvKeyframeRef[]; videos: LibTvVideoRef[]; groups: string[] }> {
  const [anchors, keyframes, videos] = await Promise.all([
    discoverAnchorAssets(projectRoot),
    buildKeyframeRefs(projectRoot),
    buildVideoRefs(projectRoot)
  ]);
  const groups = [...new Set([...keyframes.map((item) => item.groupId), ...videos.map((item) => item.groupId)])].sort();
  return { anchors, keyframes, videos, groups };
}
