import fs from "fs-extra";
import path from "node:path";
import { createHash } from "node:crypto";
import { CliUserError } from "../cli-errors.js";
import type { LibTvBackend } from "./backend.js";
import { buildLibTvPlan } from "./assets.js";
import { readState, requireBinding, writeState } from "./project-binding.js";
import type { LibTvApplyOptions, LibTvState } from "./types.js";

function fileSha256(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return createHash("sha256").update(content).digest("hex");
}

async function downloadNodeOutput(node: { data?: { url?: unknown } }, outputDir: string): Promise<string | undefined> {
  const urls = (node.data?.url ?? []) as string[];
  if (urls.length === 0) return undefined;
  await fs.ensureDir(outputDir);
  const url = urls[0];
  const response = await fetch(url);
  if (!response.ok) return undefined;
  const buffer = Buffer.from(await response.arrayBuffer());
  const ext = path.extname(new URL(url).pathname) || ".bin";
  const target = path.join(outputDir, `output${ext}`);
  await fs.writeFile(target, buffer);
  return target;
}

function displayNameForAnchor(token: string): string {
  return token.replace(/^@/, "");
}

function displayNameForKeyframe(shotId: string, keyframeId: string): string {
  return `${shotId} ${keyframeId}`;
}

function normalizeRef(value: string): string {
  return value.replace(/^@/, "").replace(/镜头/g, "shot").replace(/关键帧/g, "keyframe").replace(/[_\-\s]/g, "").toLowerCase();
}

function stateNameForId(state: LibTvState, id: string): string | undefined {
  const anchor = state.anchors.find((item) => item.nodeId === id);
  if (anchor) return anchor.token.replace(/^@/, "");
  const keyframe = state.keyframes.find((item) => item.nodeId === id);
  if (keyframe) return displayNameForKeyframe(keyframe.shotId, keyframe.keyframeId);
  const video = state.videos.find((item) => item.nodeId === id);
  if (video) return displayNameForVideo(video.shotId);
  return id;
}

function displayNameForVideo(shotId: string): string {
  return `${shotId} 视频`;
}

export async function applyPlan(projectRoot: string, backend: LibTvBackend, options: LibTvApplyOptions = {}): Promise<{ actions: string[]; state: LibTvState }> {
  const binding = await requireBinding(projectRoot);
  const plan = await buildLibTvPlan(projectRoot);
  const previous = await readState(projectRoot);
  const state: LibTvState = previous ?? {
    version: 1,
    projectUuid: binding.projectUuid,
    anchors: [],
    keyframes: [],
    videos: [],
    updatedAt: new Date().toISOString()
  };
  const actions: string[] = [];

  const only = options.only ?? ["anchors", "keyframes", "videos"];

  if (options.dryRun) {
    actions.push(`[dry-run] 项目 ${binding.projectUuid}`);
    actions.push(`[dry-run] 锚点 ${plan.anchors.length} 个，关键帧 ${plan.keyframes.length} 个，视频 ${plan.videos.length} 个`);
    return { actions, state };
  }

  // Ensure shot groups.
  if (only.includes("keyframes") || only.includes("videos")) {
    for (const groupId of plan.groups) {
      const existing = (await backend.listNodes(binding.projectUuid)).find((node) => node.name === groupId || node.id === groupId);
      if (!existing) {
        await backend.createGroup({ projectUuid: binding.projectUuid, name: groupId });
        actions.push(`创建分组 ${groupId}`);
      }
    }
  }

  // Anchor assets.
  if (only.includes("anchors")) {
    const existingAnchorGroup = (await backend.listNodes(binding.projectUuid)).find((node) => node.name === "锚点素材" || node.id === "锚点素材");
    if (!existingAnchorGroup) {
      await backend.createGroup({ projectUuid: binding.projectUuid, name: "锚点素材" });
      actions.push("创建分组 锚点素材");
    }
    const existingAnchors = new Set(state.anchors.map((anchor) => anchor.token));
    for (const anchor of plan.anchors) {
      if (existingAnchors.has(anchor.token)) {
        actions.push(`锚点已存在 ${anchor.token}`);
        continue;
      }
      if (!anchor.localPath) {
        actions.push(`缺少锚点本地文件 ${anchor.token}`);
        continue;
      }
      const node = await backend.uploadAsset({
        projectUuid: binding.projectUuid,
        nodeName: displayNameForAnchor(anchor.token),
        filePath: anchor.localPath,
        kind: anchor.kind === "character-triview" ? "image" : "image",
        groupNodeKey: "锚点素材"
      });
      const hash = fileSha256(anchor.localPath);
      const uploadedNodeKey = node.node?.nodeKey ?? node.nodeKey ?? "";
      const cdnUrl = node.cdnUrl ?? (Array.isArray(node.node?.data?.url) ? (node.node?.data?.url as string[])[0] : undefined);
      state.anchors.push({
        ...anchor,
        nodeId: uploadedNodeKey,
        fileSha256: hash,
        uploadedAt: new Date().toISOString(),
        localPath: anchor.localPath,
        cdnUrl
      });
      actions.push(`上传锚点 ${anchor.token} -> ${node.node?.nodeKey ?? node.nodeKey ?? ""}`);
    }
  }

  // Keyframe image nodes.
  if (only.includes("keyframes")) {
    const existingKeyframes = new Set(state.keyframes.map((item) => `${item.groupId}/${item.shotId}/${item.keyframeId}`));
    for (const keyframe of plan.keyframes) {
      const key = `${keyframe.groupId}/${keyframe.shotId}/${keyframe.keyframeId}`;
      if (existingKeyframes.has(key)) {
        actions.push(`关键帧已存在 ${key}`);
        continue;
      }
      const left = keyframe.referenceTokens
        .map((token) => state.anchors.find((anchor) => anchor.token === token)?.nodeId)
        .filter((id): id is string => Boolean(id));
      const leftUrls: Record<string, string> = {};
      for (const id of left) {
        const anchor = state.anchors.find((item) => item.nodeId === id);
        if (anchor?.cdnUrl) leftUrls[id] = anchor.cdnUrl;
      }
      if (keyframe.modelKey) {
        const schema = await backend.getModelSchema(keyframe.modelKey);
        if (!schema) {
          actions.push(`跳过关键帧 ${key}：模型不可用 ${keyframe.modelKey}`);
          continue;
        }
      }
      const node = await backend.createNode({
        projectUuid: binding.projectUuid,
        name: displayNameForKeyframe(keyframe.shotId, keyframe.keyframeId),
        type: "image",
        prompt: keyframe.prompt,
        params: {
          ...(keyframe.params ?? {}),
          ...(keyframe.modelKey ? { model: keyframe.modelKey } : {})
        },
        groupNodeKey: keyframe.groupId,
        left,
        leftUrls,
        data: {
          avwKind: "keyframe",
          avwSourcePath: keyframe.sourcePath,
          avwGroup: keyframe.groupId,
          avwShot: keyframe.shotId,
          avwKeyframe: keyframe.keyframeId
        },
        run: true
      });
      const localOutput = await downloadNodeOutput(node, path.join(projectRoot, "outputs", "images", keyframe.groupId, keyframe.shotId));
      const keyframeCdnUrl = Array.isArray(node.data?.url) ? (node.data?.url as string[])[0] : undefined;
      state.keyframes.push({ ...keyframe, nodeId: node.nodeKey, status: "pending-approval", localOutput, cdnUrl: keyframeCdnUrl });
      actions.push(`创建并生成关键帧 ${key} -> ${node.nodeKey}${localOutput ? ` (${localOutput})` : ""}`);
    }
  }

  // Video nodes (require keyframes approved).
  if (only.includes("videos")) {
    const existingVideos = new Set(state.videos.map((item) => `${item.groupId}/${item.shotId}`));
    for (const video of plan.videos) {
      const key = `${video.groupId}/${video.shotId}`;
      if (existingVideos.has(key)) {
        actions.push(`视频已存在 ${key}`);
        continue;
      }
      const keyframeApproved = state.keyframes.some(
        (item) => item.groupId === video.groupId && item.shotId === video.shotId && (item.status === "approved" || item.status === "generated")
      );
      if (!keyframeApproved) {
        actions.push(`跳过视频 ${key}：关键帧未通过人工待审`);
        continue;
      }
      const left = [
        ...video.referenceTokens.map((token) => state.anchors.find((anchor) => anchor.token === token)?.nodeId),
        ...state.keyframes.filter((item) => item.groupId === video.groupId && item.shotId === video.shotId).map((item) => item.nodeId)
      ].filter((id): id is string => Boolean(id));
      const leftUrls: Record<string, string> = {};
      for (const id of left) {
        const anchor = state.anchors.find((item) => item.nodeId === id);
        const keyframe = state.keyframes.find((item) => item.nodeId === id);
        const url = anchor?.cdnUrl ?? keyframe?.cdnUrl;
        if (url) leftUrls[id] = url;
      }
      if (video.orderTokens && video.orderTokens.length > 0) {
        const actualNames = left.map((id) => stateNameForId(state, id) ?? id);
        const expected = video.orderTokens.map(normalizeRef);
        const actual = actualNames.map(normalizeRef);
        const missing = expected.filter((token) => !actual.some((value) => value.includes(token) || token.includes(value)));
        if (missing.length > 0) {
          actions.push(`跳过视频 ${key}：引用顺序校验未通过，缺少 ${missing.join(", ")}（实际: ${actualNames.join(" -> ")}）`);
          continue;
        }
      }
      if (video.modelKey) {
        const schema = await backend.getModelSchema(video.modelKey);
        if (!schema) {
          actions.push(`跳过视频 ${key}：模型不可用 ${video.modelKey}`);
          continue;
        }
      }
      const node = await backend.createNode({
        projectUuid: binding.projectUuid,
        name: displayNameForVideo(video.shotId),
        type: "video",
        prompt: video.prompt,
        params: {
          ...(video.params ?? {}),
          ...(video.modelKey ? { model: video.modelKey } : {})
        },
        groupNodeKey: video.groupId,
        left,
        leftUrls,
        data: {
          avwKind: "video",
          avwSourcePath: video.sourcePath,
          avwGroup: video.groupId,
          avwShot: video.shotId
        },
        run: true
      });
      const localOutput = await downloadNodeOutput(node, path.join(projectRoot, "outputs", "video", video.groupId, video.shotId));
      const dataParams = (node.data?.params ?? {}) as Record<string, unknown>;
      const orderAfterRun = (dataParams.mixedListOrder ?? dataParams.imageListOrder) as string[] | undefined;
      if (!orderAfterRun || orderAfterRun.length === 0) {
        actions.push(`警告：视频 ${key} 生成后缺少 imageListOrder/mixedListOrder`);
      }
      const videoCdnUrl = Array.isArray(node.data?.url) ? (node.data?.url as string[])[0] : undefined;
      state.videos.push({ ...video, nodeId: node.nodeKey, status: "generated", localOutput, cdnUrl: videoCdnUrl });
      actions.push(`创建并生成视频 ${key} -> ${node.nodeKey}${localOutput ? ` (${localOutput})` : ""}`);
    }
  }

  state.updatedAt = new Date().toISOString();
  if (!options.dryRun) {
    await writeState(projectRoot, state);
  }
  return { actions, state };
}

export function renderApplySummary(result: { actions: string[]; state: LibTvState }): string {
  return [
    ...result.actions,
    "",
    `状态：锚点 ${result.state.anchors.length}，关键帧 ${result.state.keyframes.length}，视频 ${result.state.videos.length}`
  ].join("\n");
}
