import fs from "fs-extra";
import path from "node:path";
import { createHash } from "node:crypto";
import type { LibTvBackend } from "./backend.js";
import { buildLibTvPlan } from "./assets.js";
import { runNodeGeneration, LibTvGenerationError } from "./execution.js";
import { readState, requireBinding, writeState } from "./project-binding.js";
import type {
  LibTvApplyOptions,
  LibTvApplySummary,
  LibTvApplySectionSummary,
  LibTvKeyframeState,
  LibTvState,
  LibTvVideoState
} from "./types.js";

function fileSha256(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return createHash("sha256").update(content).digest("hex");
}

async function downloadNodeOutput(node: { data?: { url?: unknown } }, outputDir: string, fileNameBase: string): Promise<string | undefined> {
  const urls = (node.data?.url ?? []) as string[];
  if (urls.length === 0) return undefined;
  await fs.ensureDir(outputDir);
  const url = urls[0];
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const buffer = Buffer.from(await response.arrayBuffer());
    const ext = path.extname(new URL(url).pathname) || ".bin";
    const target = path.join(outputDir, `${fileNameBase}${ext}`);
    await fs.writeFile(target, buffer);
    return target;
  } catch {
    return undefined;
  }
}

function displayNameForAnchor(token: string): string {
  return token.replace(/^@/, "");
}

function displayNameForKeyframe(groupId: string, shotId: string, keyframeId: string): string {
  return `${groupId} ${shotId} ${keyframeId}`;
}

function normalizeRef(value: string): string {
  return value.replace(/^@/, "").replace(/镜头/g, "shot").replace(/关键帧/g, "keyframe").replace(/[_\-\s]/g, "").toLowerCase();
}

function stateNameForId(state: LibTvState, id: string): string | undefined {
  const anchor = state.anchors.find((item) => item.nodeId === id || item.finalNodeId === id);
  if (anchor) {
    const round = anchor.refineRounds?.find((item) => item.refineNodeId === id);
    return round ? `${anchor.token.replace(/^@/, "")} 精修` : anchor.token.replace(/^@/, "");
  }
  const keyframe = state.keyframes.find((item) => item.nodeId === id || item.finalNodeId === id);
  if (keyframe) {
    const round = keyframe.refineRounds?.find((item) => item.refineNodeId === id);
    const base = displayNameForKeyframe(keyframe.groupId, keyframe.shotId, keyframe.keyframeId);
    return round ? `${base} 精修` : base;
  }
  const video = state.videos.find((item) => item.nodeId === id);
  if (video) return displayNameForVideo(video.groupId, video.shotId);
  return id;
}

function finalAnchorNodeId(state: LibTvState, token: string): string | undefined {
  const anchor = state.anchors.find((item) => item.token === token);
  return anchor?.finalNodeId ?? anchor?.nodeId;
}

function anchorCdnUrlForNode(state: LibTvState, id: string): string | undefined {
  const anchor = state.anchors.find((item) => item.nodeId === id || item.finalNodeId === id);
  if (!anchor) return undefined;
  if (anchor.nodeId === id) return anchor.cdnUrl;
  return anchor.refineRounds?.find((round) => round.refineNodeId === id)?.cdnUrl;
}

function keyframeCdnUrlForNode(state: LibTvState, id: string): string | undefined {
  const keyframe = state.keyframes.find((item) => item.nodeId === id || item.finalNodeId === id);
  if (!keyframe) return undefined;
  if (keyframe.nodeId === id) return keyframe.cdnUrl;
  return keyframe.refineRounds?.find((round) => round.refineNodeId === id)?.cdnUrl;
}

function displayNameForVideo(groupId: string, shotId: string): string {
  return `${groupId} ${shotId} 视频`;
}

function keyframeKey(groupId: string, shotId: string, keyframeId: string): string {
  return `${groupId}/${shotId}/${keyframeId}`;
}

function videoKey(groupId: string, shotId: string): string {
  return `${groupId}/${shotId}`;
}

function isKeyframeComplete(item: LibTvKeyframeState): boolean {
  return ["pending-approval", "approved", "final_approved", "generated", "refined_generated"].includes(item.status) && Boolean(item.nodeId);
}

function isVideoComplete(item: LibTvVideoState): boolean {
  return item.status === "generated" && Boolean(item.nodeId);
}

function isKeyframeApproved(item: LibTvKeyframeState): boolean {
  return (item.status === "approved" || item.status === "final_approved") && Boolean(item.finalNodeId ?? item.nodeId);
}

function emptySection(total: number): LibTvApplySectionSummary {
  return { total, skipped: 0, generated: 0, failed: 0, failures: [] };
}

function buildSummary(dryRun: boolean, allowGeneration: boolean, keyframes: LibTvApplySectionSummary, videos: LibTvApplySectionSummary): LibTvApplySummary {
  return { dryRun, allowGeneration, keyframes, videos };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function ensureGroups(backend: LibTvBackend, projectUuid: string, groups: string[], actions: string[]): Promise<void> {
  for (const groupId of groups) {
    const nodes = await backend.listNodes(projectUuid);
    const existing = nodes.find((node) => node.name === groupId || node.id === groupId);
    if (!existing) {
      await backend.createGroup({ projectUuid, name: groupId });
      actions.push(`创建分组 ${groupId}`);
    }
  }
}

async function loadNodeOrThrow(backend: LibTvBackend, projectUuid: string, nodeId: string, label: string) {
  const node = await backend.getNode(projectUuid, nodeId);
  if (!node) {
    throw new Error(`画布节点不存在: ${label} (${nodeId})`);
  }
  return node;
}

export async function applyPlan(projectRoot: string, backend: LibTvBackend, options: LibTvApplyOptions = {}): Promise<{ actions: string[]; state: LibTvState; summary: LibTvApplySummary }> {
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
  const isDryRun = options.dryRun === true;
  const allowGeneration = options.allowGeneration === true && !isDryRun;
  const retrySet = new Set(options.retryIds ?? []);
  const pollIntervalMs = options.pollIntervalMs ?? 2000;
  const timeoutMs = options.timeoutMs ?? 1200000;

  const keyframeSummary = emptySection(plan.keyframes.length);
  const videoSummary = emptySection(plan.videos.length);

  if (isDryRun) {
    actions.push(`[dry-run] 项目 ${binding.projectUuid}`);
    actions.push(`[dry-run] 锚点 ${plan.anchors.length} 个，关键帧 ${plan.keyframes.length} 个，视频 ${plan.videos.length} 个`);
    if (only.includes("keyframes") && !allowGeneration) {
      actions.push(`[dry-run] 关键帧生成需要 --allow-generation`);
    }
    if (only.includes("videos") && !allowGeneration) {
      actions.push(`[dry-run] 视频生成需要 --allow-generation`);
    }
    return { actions, state, summary: buildSummary(true, allowGeneration, keyframeSummary, videoSummary) };
  }

  // Ensure shot groups.
  if (only.includes("keyframes") || only.includes("videos")) {
    await ensureGroups(backend, binding.projectUuid, plan.groups, actions);
  }

  // Anchor assets (not generation).
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
      actions.push(`上传锚点 ${anchor.token} -> ${uploadedNodeKey}`);
    }
  }

  // Keyframe image nodes.
  if (only.includes("keyframes")) {
    for (const keyframe of plan.keyframes) {
      const key = keyframeKey(keyframe.groupId, keyframe.shotId, keyframe.keyframeId);
      const existing = state.keyframes.find((item) => item.groupId === keyframe.groupId && item.shotId === keyframe.shotId && item.keyframeId === keyframe.keyframeId);

      if (existing && isKeyframeComplete(existing)) {
        keyframeSummary.skipped += 1;
        actions.push(`关键帧已存在 ${key}`);
        continue;
      }

      if (existing?.status === "failed" && !retrySet.has(key)) {
        keyframeSummary.skipped += 1;
        actions.push(`关键帧失败但未指定重试 ${key}`);
        continue;
      }

      if (!allowGeneration) {
        actions.push(`[dry-run] 关键帧 ${key}：缺少 --allow-generation`);
        continue;
      }

      if (keyframe.modelKey) {
        const schema = await backend.getModelSchema(keyframe.modelKey);
        if (!schema) {
          keyframeSummary.failed += 1;
          keyframeSummary.failures.push({ id: key, reason: "model-unavailable", message: `模型不可用 ${keyframe.modelKey}` });
          actions.push(`跳过关键帧 ${key}：模型不可用 ${keyframe.modelKey}`);
          continue;
        }
      } else {
        keyframeSummary.failed += 1;
        keyframeSummary.failures.push({ id: key, reason: "model-missing", message: "关键帧未配置模型" });
        actions.push(`跳过关键帧 ${key}：未配置模型`);
        continue;
      }

      let item = existing;
      try {
        if (!item || !item.nodeId) {
          const left = keyframe.referenceTokens
            .map((token) => finalAnchorNodeId(state, token))
            .filter((id): id is string => Boolean(id));
          const leftUrls: Record<string, string> = {};
          for (const id of left) {
            const url = anchorCdnUrlForNode(state, id);
            if (url) leftUrls[id] = url;
          }
          const node = await backend.createNode({
            projectUuid: binding.projectUuid,
            name: displayNameForKeyframe(keyframe.groupId, keyframe.shotId, keyframe.keyframeId),
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
            run: false
          });
          if (item) {
            item.nodeId = node.nodeKey;
            item.status = "queued";
            item.attempts = 0;
          } else {
            item = {
              ...keyframe,
              nodeId: node.nodeKey,
              status: "queued",
              attempts: 0
            };
            state.keyframes.push(item);
          }
          actions.push(`创建关键帧 ${key} -> ${node.nodeKey}`);
          await writeState(projectRoot, state);
        }

        const node = await loadNodeOrThrow(backend, binding.projectUuid, item.nodeId, key);
        const result = await runNodeGeneration(backend, {
          projectUuid: binding.projectUuid,
          node,
          modelKey: keyframe.modelKey!,
          prompt: keyframe.prompt,
          taskType: "image",
          params: keyframe.params ?? {},
          existingTaskId: item.status === "generating" ? item.taskId : undefined,
          pollIntervalMs,
          timeoutMs,
          onProgress: async (progress) => {
            item!.status = "generating";
            item!.taskId = progress.taskId ?? item!.taskId;
            item!.progressPercent = progress.progressPercent;
            await writeState(projectRoot, state);
          }
        });

        item.status = "pending-approval";
        item.taskId = result.taskId;
        item.progressPercent = 100;
        item.generationError = undefined;
        item.attempts = (item.attempts ?? 0) + 1;
        const localOutput = await downloadNodeOutput(
          result.node,
          path.join(projectRoot, "outputs", "images", keyframe.groupId, keyframe.shotId),
          keyframe.keyframeId
        );
        const urls = (result.node.data?.url ?? []) as string[];
        item.localOutput = localOutput;
        item.cdnUrl = typeof urls[0] === "string" ? urls[0] : undefined;
        keyframeSummary.generated += 1;
        actions.push(`生成关键帧 ${key} -> ${item.nodeId}${localOutput ? ` (${localOutput})` : ""}`);
        await writeState(projectRoot, state);
      } catch (error) {
        item = item ?? {
          ...keyframe,
          nodeId: "",
          status: "failed",
          attempts: 1,
          generationError: errorMessage(error)
        };
        if (!state.keyframes.includes(item)) {
          state.keyframes.push(item);
        }
        item.status = "failed";
        item.generationError = errorMessage(error);
        item.attempts = (item.attempts ?? 0) + 1;
        keyframeSummary.failed += 1;
        const reason = error instanceof LibTvGenerationError ? error.reason : "execution-error";
        keyframeSummary.failures.push({ id: key, reason, message: errorMessage(error), nodeId: item.nodeId || undefined });
        actions.push(`关键帧失败 ${key}: ${errorMessage(error)}`);
        await writeState(projectRoot, state);
      }
    }
  }

  // Video nodes (require keyframes approved).
  if (only.includes("videos")) {
    for (const video of plan.videos) {
      const key = videoKey(video.groupId, video.shotId);
      const existing = state.videos.find((item) => item.groupId === video.groupId && item.shotId === video.shotId);

      if (existing && isVideoComplete(existing)) {
        videoSummary.skipped += 1;
        actions.push(`视频已存在 ${key}`);
        continue;
      }

      if (existing?.status === "failed" && !retrySet.has(key)) {
        videoSummary.skipped += 1;
        actions.push(`视频失败但未指定重试 ${key}`);
        continue;
      }

      const matchingKeyframes = state.keyframes.filter(
        (item) => item.groupId === video.groupId && item.shotId === video.shotId
      );
      const keyframeApproved = matchingKeyframes.some(isKeyframeApproved);
      if (!keyframeApproved) {
        videoSummary.skipped += 1;
        actions.push(`跳过视频 ${key}：关键帧未通过人工审核`);
        continue;
      }

      if (!allowGeneration) {
        actions.push(`[dry-run] 视频 ${key}：缺少 --allow-generation`);
        continue;
      }

      if (video.modelKey) {
        const schema = await backend.getModelSchema(video.modelKey);
        if (!schema) {
          videoSummary.failed += 1;
          videoSummary.failures.push({ id: key, reason: "model-unavailable", message: `模型不可用 ${video.modelKey}` });
          actions.push(`跳过视频 ${key}：模型不可用 ${video.modelKey}`);
          continue;
        }
      } else {
        videoSummary.failed += 1;
        videoSummary.failures.push({ id: key, reason: "model-missing", message: "视频未配置模型" });
        actions.push(`跳过视频 ${key}：未配置模型`);
        continue;
      }

      const left = [
        ...video.referenceTokens.map((token) => finalAnchorNodeId(state, token)),
        ...matchingKeyframes.map((item) => item.finalNodeId ?? item.nodeId)
      ].filter((id): id is string => Boolean(id));
      const leftUrls: Record<string, string> = {};
      for (const id of left) {
        const url = anchorCdnUrlForNode(state, id) ?? keyframeCdnUrlForNode(state, id);
        if (url) leftUrls[id] = url;
      }

      if (video.orderTokens && video.orderTokens.length > 0) {
        const actualNames = left.map((id) => stateNameForId(state, id) ?? id);
        const expected = video.orderTokens.map(normalizeRef);
        const actual = actualNames.map(normalizeRef);
        const missing = expected.filter((token) => !actual.some((value) => value.includes(token) || token.includes(value)));
        if (missing.length > 0) {
          videoSummary.skipped += 1;
          actions.push(`跳过视频 ${key}：引用顺序校验未通过，缺少 ${missing.join(", ")}（实际: ${actualNames.join(" -> ")}）`);
          continue;
        }
      }

      let item = existing;
      try {
        if (!item || !item.nodeId) {
          const node = await backend.createNode({
            projectUuid: binding.projectUuid,
            name: displayNameForVideo(video.groupId, video.shotId),
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
            run: false
          });
          if (item) {
            item.nodeId = node.nodeKey;
            item.status = "queued";
            item.attempts = 0;
          } else {
            item = { ...video, nodeId: node.nodeKey, status: "queued", attempts: 0 };
            state.videos.push(item);
          }
          actions.push(`创建视频 ${key} -> ${node.nodeKey}`);
          await writeState(projectRoot, state);
        }

        const node = await loadNodeOrThrow(backend, binding.projectUuid, item.nodeId, key);
        const result = await runNodeGeneration(backend, {
          projectUuid: binding.projectUuid,
          node,
          modelKey: video.modelKey!,
          prompt: video.prompt,
          taskType: "video",
          params: video.params ?? {},
          existingTaskId: item.status === "generating" ? item.taskId : undefined,
          pollIntervalMs,
          timeoutMs,
          onProgress: async (progress) => {
            item!.status = "generating";
            item!.taskId = progress.taskId ?? item!.taskId;
            item!.progressPercent = progress.progressPercent;
            await writeState(projectRoot, state);
          }
        });

        item.status = "generated";
        item.taskId = result.taskId;
        item.progressPercent = 100;
        item.generationError = undefined;
        item.attempts = (item.attempts ?? 0) + 1;
        const localOutput = await downloadNodeOutput(
          result.node,
          path.join(projectRoot, "outputs", "video", video.groupId, video.shotId),
          video.shotId
        );
        const dataParams = (result.node.data?.params ?? {}) as Record<string, unknown>;
        const orderAfterRun = (dataParams.mixedListOrder ?? dataParams.imageListOrder) as string[] | undefined;
        if (!orderAfterRun || orderAfterRun.length === 0) {
          actions.push(`警告：视频 ${key} 生成后缺少 imageListOrder/mixedListOrder`);
        }
        const urls = (result.node.data?.url ?? []) as string[];
        item.localOutput = localOutput;
        item.cdnUrl = typeof urls[0] === "string" ? urls[0] : undefined;
        videoSummary.generated += 1;
        actions.push(`生成视频 ${key} -> ${item.nodeId}${localOutput ? ` (${localOutput})` : ""}`);
        await writeState(projectRoot, state);
      } catch (error) {
        item = item ?? {
          ...video,
          nodeId: "",
          status: "failed",
          attempts: 1,
          generationError: errorMessage(error)
        };
        if (!state.videos.includes(item)) {
          state.videos.push(item);
        }
        item.status = "failed";
        item.generationError = errorMessage(error);
        item.attempts = (item.attempts ?? 0) + 1;
        videoSummary.failed += 1;
        const reason = error instanceof LibTvGenerationError ? error.reason : "execution-error";
        videoSummary.failures.push({ id: key, reason, message: errorMessage(error), nodeId: item.nodeId || undefined });
        actions.push(`视频失败 ${key}: ${errorMessage(error)}`);
        await writeState(projectRoot, state);
      }
    }
  }

  state.updatedAt = new Date().toISOString();
  await writeState(projectRoot, state);

  return {
    actions,
    state,
    summary: buildSummary(false, allowGeneration, keyframeSummary, videoSummary)
  };
}

export function renderApplySummary(result: { actions: string[]; state: LibTvState; summary?: LibTvApplySummary }): string {
  const lines: string[] = [
    ...result.actions,
    "",
    `状态：锚点 ${result.state.anchors.length}，关键帧 ${result.state.keyframes.length}，视频 ${result.state.videos.length}`
  ];
  if (result.summary) {
    lines.push("");
    lines.push(`关键帧：总 ${result.summary.keyframes.total}，跳过 ${result.summary.keyframes.skipped}，成功 ${result.summary.keyframes.generated}，失败 ${result.summary.keyframes.failed}`);
    lines.push(`视频：总 ${result.summary.videos.total}，跳过 ${result.summary.videos.skipped}，成功 ${result.summary.videos.generated}，失败 ${result.summary.videos.failed}`);
    for (const failure of [...result.summary.keyframes.failures, ...result.summary.videos.failures]) {
      lines.push(`- 失败 ${failure.id} [${failure.reason}] ${failure.message}${failure.nodeId ? ` (${failure.nodeId})` : ""}`);
    }
  }
  return lines.join("\n");
}
