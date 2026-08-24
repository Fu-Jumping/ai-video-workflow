import type { LibTvBackend } from "./backend.js";
import { buildLibTvPlan } from "./assets.js";
import { readBinding, readState } from "./project-binding.js";
import type { LibTvVerifyIssue } from "./types.js";

export async function verifyLibtvProject(projectRoot: string, backend?: LibTvBackend): Promise<LibTvVerifyIssue[]> {
  const issues: LibTvVerifyIssue[] = [];
  const binding = await readBinding(projectRoot);
  if (!binding) {
    issues.push({ code: "missing-libtv-binding", message: "缺少 .libtv/project.json，请先执行 libtv project use" });
    return issues;
  }

  const plan = await buildLibTvPlan(projectRoot);
  const state = await readState(projectRoot);

  for (const anchor of plan.anchors) {
    if (!anchor.localPath) {
      issues.push({
        code: "missing-anchor-asset-file",
        message: `锚点缺少本地文件: ${anchor.token}（应在 assets/anchors/characters|scenes/ 下）`
      });
    }
  }

  for (const keyframe of plan.keyframes) {
    if (!keyframe.prompt) {
      issues.push({ code: "missing-keyframe-prompt", message: `关键帧缺少可复制提示词: ${keyframe.sourcePath}`, path: keyframe.sourcePath });
    }
  }

  for (const video of plan.videos) {
    if (!video.prompt) {
      issues.push({ code: "missing-video-prompt", message: `视频缺少可复制提示词: ${video.sourcePath}`, path: video.sourcePath });
    }
    if (!state || !state.keyframes.some((item) => item.groupId === video.groupId && item.shotId === video.shotId && (item.status === "approved" || item.status === "final_approved") && Boolean(item.finalNodeId ?? item.nodeId))) {
      issues.push({
        code: "keyframe-not-approved",
        message: `视频前置关键帧未通过人工待审: ${video.groupId}/${video.shotId}`,
        path: video.sourcePath
      });
    }
  }

  if (backend && state) {
    const remote = await backend.getProjectDetail(binding.projectUuid);
    const remoteIds = new Set(remote.nodes.map((node) => node.id));
    for (const anchor of state.anchors) {
      if (!remoteIds.has(anchor.nodeId)) {
        issues.push({ code: "remote-anchor-missing", message: `画布缺少已记录锚点节点: ${anchor.token} (${anchor.nodeId})` });
      }
    }
    for (const keyframe of state.keyframes) {
      if (!remoteIds.has(keyframe.nodeId)) {
        issues.push({ code: "remote-keyframe-missing", message: `画布缺少已记录关键帧节点: ${keyframe.nodeId}` });
      }
    }
    for (const video of state.videos) {
      if (!remoteIds.has(video.nodeId)) {
        issues.push({ code: "remote-video-missing", message: `画布缺少已记录视频节点: ${video.nodeId}` });
      }
    }
  }

  return issues;
}

export function renderVerifyIssues(issues: LibTvVerifyIssue[]): string {
  if (issues.length === 0) {
    return "LibTV 素材链路校验通过";
  }
  return issues.map((issue) => `- ${issue.code}: ${issue.message}${issue.path ? ` (${issue.path})` : ""}`).join("\n");
}
