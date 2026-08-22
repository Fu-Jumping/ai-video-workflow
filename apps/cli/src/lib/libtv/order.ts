import { createHash } from "node:crypto";
import fs from "fs-extra";
import path from "node:path";
import { buildLibTvPlan } from "./assets.js";
import { requireBinding, statePath } from "./project-binding.js";
import type { LibTvBackend } from "./backend.js";
import type { LibTvVerifyIssue } from "./types.js";

export function displayNameForVideo(groupId: string, shotId: string): string {
  return `${groupId} ${shotId} 视频`;
}

export function displayNameForKeyframe(groupId: string, shotId: string, keyframeId: string): string {
  return `${groupId} ${shotId} ${keyframeId}`;
}

export function normalizeRef(value: string): string {
  return value
    .replace(/^@/, "")
    .replace(/镜头/g, "shot")
    .replace(/关键帧/g, "keyframe")
    .replace(/[_\-\s]/g, "")
    .toLowerCase();
}

function orderNamesFromIds(ids: string[], nodes: Array<{ id: string; name: string }>): string[] {
  const byId = new Map(nodes.map((node) => [node.id, node.name]));
  return ids.map((id) => byId.get(id) ?? id);
}

export function promptPlaceholders(prompt: string): Array<{ kind: string; index: number }> {
  const result: Array<{ kind: string; index: number }> = [];
  const pattern = /\{\{\s*(Image|Mixed)\s+(\d+)\s*\}\}/g;
  for (const match of prompt.matchAll(pattern)) {
    result.push({ kind: match[1] ?? "", index: Number(match[2] ?? 0) });
  }
  return result;
}

export function computeOrderHash(nodeKey: string, modeType: string, referenceKind: string, orderSource: string, orderIds: string[]): string {
  return createHash("sha256")
    .update([nodeKey, modeType, referenceKind, orderSource, orderIds.join(",")].join("|"))
    .digest("hex");
}

export function orderContractPath(projectRoot: string): string {
  return path.join(projectRoot, ".libtv", "order-contracts.json");
}

export async function writeOrderContracts(projectRoot: string, backend: LibTvBackend): Promise<string> {
  const binding = await requireBinding(projectRoot);
  const plan = await buildLibTvPlan(projectRoot);
  const remote = await backend.getProjectDetail(binding.projectUuid);
  const nodes = remote.nodes ?? [];
  const byName = new Map(nodes.map((node) => [node.name, node]));
  const contracts: Record<string, unknown> = {};

  for (const video of plan.videos) {
    const name = displayNameForVideo(video.groupId, video.shotId);
    const node = byName.get(name);
    if (!node) continue;
    const params = (node.data?.params ?? {}) as Record<string, unknown>;
    const order = (params.mixedListOrder ?? params.imageListOrder) as string[] | undefined;
    if (!order) continue;
    const modeType = typeof params.modeType === "string" ? params.modeType : "mixed2video";
    const referenceKind = modeType.includes("mixed") ? "Mixed" : "Image";
    const orderSource = params.mixedListOrder ? "mixedListOrder" : "imageListOrder";
    const orderNames = order.map((id) => nodes.find((n) => n.id === id)?.name ?? id);
    contracts[name] = {
      nodeName: name,
      nodeKey: node.id,
      modeType,
      referenceKind,
      orderSource,
      orderIds: order,
      orderNames,
      orderHash: computeOrderHash(node.id, modeType, referenceKind, orderSource, order),
      expected: video.orderTokens ?? []
    };
  }

  const file = orderContractPath(projectRoot);
  await fs.ensureDir(path.dirname(file));
  await fs.writeJson(file, { generatedAt: new Date().toISOString(), contracts }, { spaces: 2 });
  return file;
}

export async function verifyLibtvOrder(projectRoot: string, backend: LibTvBackend): Promise<LibTvVerifyIssue[]> {
  const binding = await requireBinding(projectRoot);
  const plan = await buildLibTvPlan(projectRoot);
  const remote = await backend.getProjectDetail(binding.projectUuid);
  const issues: LibTvVerifyIssue[] = [];
  const nodes = remote.nodes ?? [];
  const byName = new Map(nodes.map((node) => [node.name, node]));

  // Verify video nodes.
  for (const video of plan.videos) {
    const name = displayNameForVideo(video.groupId, video.shotId);
    const node = byName.get(name);
    if (!node) {
      issues.push({ code: "missing-order-video-node", message: `找不到视频节点: ${name}`, path: video.sourcePath });
      continue;
    }
    const data = node.data ?? {};
    const params = (data.params ?? {}) as Record<string, unknown>;
    const order = (params.mixedListOrder ?? params.imageListOrder) as string[] | undefined;
    if (!order || order.length === 0) {
      issues.push({ code: "missing-explicit-order", message: `视频节点缺少 imageListOrder/mixedListOrder: ${name}`, path: video.sourcePath });
      continue;
    }
    const orderNames = orderNamesFromIds(order, nodes);
    const contractFile = orderContractPath(projectRoot);
    if (fs.existsSync(contractFile)) {
      try {
        const contractData = JSON.parse(await fs.readFile(contractFile, "utf8")) as { contracts?: Record<string, { orderHash?: string; modeType?: string; referenceKind?: string; orderSource?: string }> };
        const contract = contractData.contracts?.[name];
        if (contract?.orderHash) {
          const modeType = typeof params.modeType === "string" ? params.modeType : "mixed2video";
          const referenceKind = modeType.includes("mixed") ? "Mixed" : "Image";
          const orderSource = params.mixedListOrder ? "mixedListOrder" : "imageListOrder";
          const currentHash = computeOrderHash(node.id, modeType, referenceKind, orderSource, order);
          if (currentHash !== contract.orderHash) {
            issues.push({
              code: "order-contract-hash-mismatch",
              message: `视频节点顺序合同 hash 不匹配: ${name}`,
              path: video.sourcePath
            });
          }
        }
      } catch {
        // ignore malformed contract
      }
    }
    const placeholders = promptPlaceholders(typeof params.prompt === "string" ? params.prompt : "");
    if (placeholders.length > 0 && placeholders.length !== order.length) {
      issues.push({
        code: "order-placeholder-count-mismatch",
        message: `视频节点占位符数量(${placeholders.length})与引用顺序数量(${order.length})不一致: ${name}`,
        path: video.sourcePath
      });
    }
    for (const placeholder of placeholders) {
      if (placeholder.index < 1 || placeholder.index > order.length) {
        issues.push({
          code: "order-placeholder-out-of-range",
          message: `视频节点占位符 ${placeholder.kind} ${placeholder.index} 超出引用顺序范围: ${name}`,
          path: video.sourcePath
        });
      }
    }
    if (video.orderTokens && video.orderTokens.length > 0) {
      const expected = video.orderTokens.map(normalizeRef);
      const actual = orderNames.map(normalizeRef);
      for (const token of expected) {
        if (!actual.some((value) => value.includes(token) || token.includes(value))) {
          issues.push({
            code: "order-token-missing",
            message: `视频节点引用顺序缺少预期素材: ${token} (实际: ${orderNames.join(" -> ")})`,
            path: video.sourcePath
          });
        }
      }
    }
  }

  // Verify keyframe image nodes.
  for (const keyframe of plan.keyframes) {
    const name = displayNameForKeyframe(keyframe.groupId, keyframe.shotId, keyframe.keyframeId);
    const node = byName.get(name);
    if (!node) {
      issues.push({ code: "missing-order-keyframe-node", message: `找不到关键帧节点: ${name}`, path: keyframe.sourcePath });
      continue;
    }
    const data = node.data ?? {};
    const params = (data.params ?? {}) as Record<string, unknown>;
    const order = (params.imageListOrder ?? params.mixedListOrder) as string[] | undefined;
    if (!order || order.length === 0) {
      issues.push({ code: "missing-explicit-order", message: `关键帧节点缺少 imageListOrder/mixedListOrder: ${name}`, path: keyframe.sourcePath });
      continue;
    }
    const placeholders = promptPlaceholders(typeof params.prompt === "string" ? params.prompt : "");
    if (placeholders.length > 0 && placeholders.length !== order.length) {
      issues.push({
        code: "order-placeholder-count-mismatch",
        message: `关键帧节点占位符数量(${placeholders.length})与引用顺序数量(${order.length})不一致: ${name}`,
        path: keyframe.sourcePath
      });
    }
  }

  return issues;
}

export function renderOrderVerifyIssues(issues: LibTvVerifyIssue[]): string {
  if (issues.length === 0) {
    return "LibTV 引用顺序校验通过";
  }
  return issues.map((issue) => `- ${issue.code}: ${issue.message}${issue.path ? ` (${issue.path})` : ""}`).join("\n");
}
