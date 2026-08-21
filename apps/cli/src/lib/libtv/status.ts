import type { LibTvBackend } from "./backend.js";
import { buildLibTvPlan } from "./assets.js";
import { readState, requireBinding } from "./project-binding.js";
import type { LibTvStatusResult } from "./types.js";

export async function buildStatus(projectRoot: string, backend: LibTvBackend): Promise<LibTvStatusResult> {
  const binding = await requireBinding(projectRoot);
  const plan = await buildLibTvPlan(projectRoot);
  const state = await readState(projectRoot);
  const remote = await backend.getProjectDetail(binding.projectUuid);
  const remoteNodes = new Map(remote.nodes.map((node) => [node.name, node]));
  const remoteIds = new Set(remote.nodes.map((node) => node.id));

  const anchors = plan.anchors.map((anchor) => {
    const stateAnchor = state?.anchors.find((item) => item.token === anchor.token);
    const remoteNode = stateAnchor ? remoteIds.has(stateAnchor.nodeId) : remoteNodes.has(anchor.token.replace(/^@/, ""));
    return {
      token: anchor.token,
      local: Boolean(anchor.localPath),
      remote: remoteNode,
      nodeId: stateAnchor?.nodeId
    };
  });

  const keyframes = plan.keyframes.map((item) => {
    const key = `${item.groupId}/${item.shotId}/${item.keyframeId}`;
    const stateItem = state?.keyframes.find((candidate) => `${candidate.groupId}/${candidate.shotId}/${candidate.keyframeId}` === key);
    const nodeId = stateItem?.nodeId;
    const remoteNode = nodeId ? remoteIds.has(nodeId) : false;
    return { id: key, remote: remoteNode, nodeId, status: stateItem?.status };
  });

  const videos = plan.videos.map((item) => {
    const key = `${item.groupId}/${item.shotId}`;
    const stateItem = state?.videos.find((candidate) => `${candidate.groupId}/${candidate.shotId}` === key);
    const nodeId = stateItem?.nodeId;
    const remoteNode = nodeId ? remoteIds.has(nodeId) : false;
    return { id: key, remote: remoteNode, nodeId, status: stateItem?.status };
  });

  return { projectUuid: binding.projectUuid, anchors, keyframes, videos };
}

export function renderStatus(status: LibTvStatusResult): string {
  const lines = [
    `项目：${status.projectUuid}`,
    "",
    `锚点 ${status.anchors.length}`,
    ...status.anchors.map((anchor) => `- ${anchor.token} local=${anchor.local ? "✓" : "✗"} remote=${anchor.remote ? "✓" : "✗"}${anchor.nodeId ? ` node=${anchor.nodeId}` : ""}`),
    "",
    `关键帧 ${status.keyframes.length}`,
    ...status.keyframes.map((item) => `- ${item.id} remote=${item.remote ? "✓" : "✗"}${item.nodeId ? ` node=${item.nodeId}` : ""}${item.status ? ` status=${item.status}` : ""}`),
    "",
    `视频 ${status.videos.length}`,
    ...status.videos.map((item) => `- ${item.id} remote=${item.remote ? "✓" : "✗"}${item.nodeId ? ` node=${item.nodeId}` : ""}${item.status ? ` status=${item.status}` : ""}`)
  ];
  return lines.join("\n");
}
