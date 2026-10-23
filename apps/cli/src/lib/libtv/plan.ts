import { buildContentTree, resolveContentMode } from "../content-tree.js";
import { buildLibTvPlan } from "./assets.js";
import type { LibTvPlan } from "./types.js";

/**
 * 内容树模式下，每个执行条目所属的分镜身份（storyboard-01 这种）。
 *
 * 键口径与 MCP 上下文、LibTV 状态文件一致：
 * - 关键帧：groupId/shotId/keyframeId
 * - 视频：groupId/shotId
 */
export interface LibTvStoryboardBindings {
  keyframes: Record<string, string>;
  videos: Record<string, string[]>;
}

/**
 * 生成准备计划。旧格式项目与原来完全一致；内容树模式额外带 storyboards，
 * 用来说明「这张关键帧属于哪一段」。
 */
export type LibTvPlanWithStoryboards = LibTvPlan & { storyboards?: LibTvStoryboardBindings };

export function keyframeBindingKey(item: { groupId: string; shotId: string; keyframeId: string }): string {
  return item.groupId + "/" + item.shotId + "/" + item.keyframeId;
}

export function videoBindingKey(item: { groupId: string; shotId: string }): string {
  return item.groupId + "/" + item.shotId;
}

async function readStoryboardBindings(projectRoot: string): Promise<LibTvStoryboardBindings | undefined> {
  const resolution = await resolveContentMode(projectRoot);
  if (resolution.mode !== "content-tree") {
    return undefined;
  }
  const tree = await buildContentTree(projectRoot);
  const keyframes: Record<string, string> = {};
  const videos: Record<string, string[]> = {};
  for (const shot of tree.shots) {
    const storyboardIds: string[] = [];
    for (const storyboard of shot.storyboards) {
      storyboardIds.push(storyboard.document.storyboardId);
      for (const keyframe of storyboard.document.keyframes) {
        keyframes[shot.groupId + "/" + shot.shotId + "/" + keyframe.id] = storyboard.document.storyboardId;
      }
    }
    if (storyboardIds.length > 0) {
      videos[shot.groupId + "/" + shot.shotId] = storyboardIds;
    }
  }
  return { keyframes, videos };
}

export async function buildPlan(projectRoot: string): Promise<LibTvPlanWithStoryboards> {
  const plan = await buildLibTvPlan(projectRoot);
  const storyboards = await readStoryboardBindings(projectRoot);
  return storyboards ? { ...plan, storyboards } : { ...plan };
}

export function renderPlan(plan: LibTvPlanWithStoryboards, projectUuid?: string): string {
  const bindings = plan.storyboards;
  const keyframeSuffix = (item: { groupId: string; shotId: string; keyframeId: string }): string => {
    const storyboardId = bindings?.keyframes[keyframeBindingKey(item)];
    return storyboardId ? ` 分镜=${storyboardId}` : "";
  };
  const videoSuffix = (item: { groupId: string; shotId: string }): string => {
    const storyboardIds = bindings?.videos[videoBindingKey(item)];
    return storyboardIds && storyboardIds.length > 0 ? ` 分镜=${storyboardIds.join(",")}` : "";
  };
  const lines = [
    `LibTV 素材计划`,
    projectUuid ? `项目 UUID：${projectUuid}` : `项目 UUID：未绑定`,
    "",
    `锚点素材：${plan.anchors.length}`,
    ...plan.anchors.map((anchor) => `- ${anchor.token}${anchor.localPath ? ` (${anchor.localPath})` : " (缺少本地文件)"}`),
    "",
    `关键帧图片：${plan.keyframes.length}`,
    ...plan.keyframes.map((item) => `- ${item.groupId}/${item.shotId}/${item.keyframeId} @ ${item.sourcePath}${item.modelKey ? ` model=${item.modelKey}` : ""}${keyframeSuffix(item)}`),
    "",
    `视频：${plan.videos.length}`,
    ...plan.videos.map((item) => `- ${item.groupId}/${item.shotId} @ ${item.sourcePath}${item.modelKey ? ` model=${item.modelKey}` : ""}${videoSuffix(item)}`),
    "",
    `镜头组：${plan.groups.length > 0 ? plan.groups.join(", ") : "无"}`
  ];
  return lines.join("\n");
}
