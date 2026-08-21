import { buildLibTvPlan } from "./assets.js";
import type { LibTvPlan } from "./types.js";

export async function buildPlan(projectRoot: string): Promise<LibTvPlan> {
  const plan = await buildLibTvPlan(projectRoot);
  return { ...plan };
}

export function renderPlan(plan: LibTvPlan, projectUuid?: string): string {
  const lines = [
    `LibTV 素材计划`,
    projectUuid ? `项目 UUID：${projectUuid}` : `项目 UUID：未绑定`,
    "",
    `锚点素材：${plan.anchors.length}`,
    ...plan.anchors.map((anchor) => `- ${anchor.token}${anchor.localPath ? ` (${anchor.localPath})` : " (缺少本地文件)"}`),
    "",
    `关键帧图片：${plan.keyframes.length}`,
    ...plan.keyframes.map((item) => `- ${item.groupId}/${item.shotId}/${item.keyframeId} @ ${item.sourcePath}`),
    "",
    `视频：${plan.videos.length}`,
    ...plan.videos.map((item) => `- ${item.groupId}/${item.shotId} @ ${item.sourcePath}`),
    "",
    `镜头组：${plan.groups.length > 0 ? plan.groups.join(", ") : "无"}`
  ];
  return lines.join("\n");
}
