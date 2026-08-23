import { CliUserError } from "../cli-errors.js";
import type { LibTvBackend } from "./backend.js";
import { readState, writeState } from "./project-binding.js";
import type {
  LibTvAnchorState,
  LibTvImageReviewDecision,
  LibTvKeyframeState,
  LibTvRefineBase,
  LibTvState
} from "./types.js";

export type LibTvImageTarget =
  | { kind: "keyframe"; item: LibTvKeyframeState; id: string }
  | { kind: "anchor"; item: LibTvAnchorState; id: string };

function normalizeId(value: string): string {
  return value.replace(/^@/, "").trim();
}

export function findImageTarget(state: LibTvState, id: string): LibTvImageTarget | null {
  const keyframe = state.keyframes.find((candidate) =>
    `${candidate.groupId}/${candidate.shotId}/${candidate.keyframeId}` === id ||
    `${candidate.groupId}/${candidate.shotId}/${candidate.keyframeId}`.replace(/^group-/u, "group-").replace(/^shot-/u, "shot-") === normalizeId(id)
  );
  if (keyframe) {
    return { kind: "keyframe", item: keyframe, id };
  }
  const anchor = state.anchors.find((candidate) =>
    candidate.token === id || candidate.token.replace(/^@/u, "") === normalizeId(id)
  );
  if (anchor) {
    return { kind: "anchor", item: anchor, id };
  }
  // Last-resort: match normalized unresolved id against either side.
  const keyframeByName = state.keyframes.find((candidate) =>
    `${candidate.groupId}/${candidate.shotId}/${candidate.keyframeId}`.replace(/\//gu, "-").toLowerCase() === normalizeId(id).toLowerCase()
  );
  if (keyframeByName) {
    return { kind: "keyframe", item: keyframeByName, id };
  }
  return null;
}

function displayNameForTarget(target: LibTvImageTarget): string {
  if (target.kind === "keyframe") {
    const item = target.item;
    return `${item.groupId} ${item.shotId} ${item.keyframeId} 精修`;
  }
  return `${target.item.token} 精修`;
}

export function resolveRefineBase(target: LibTvImageTarget, base: LibTvRefineBase): string | undefined {
  if (base === "first") {
    return target.item.nodeId;
  }
  const rounds = target.item.refineRounds ?? [];
  return rounds.length > 0 ? rounds[rounds.length - 1]?.refineNodeId : target.item.nodeId;
}

export function buildRefinePrompt(instruction: string, negativeConstraints: string[] = []): string {
  const base = [
    "参考已有首版/当前版本图片。",
    "",
    "修改范围：只修改以下问题点：",
    instruction,
    "",
    "保持不变：除上述修改点外，其它画面区域一律不得改动；整体构图、主体身份、服装、发型、场景空间、光线方向保持不变。",
    "",
    "负面约束："
  ];
  const constraints = negativeConstraints.length > 0
    ? negativeConstraints.map((item) => `- ${item}`)
    : [
        "- 不得改动除用户指定修改点之外的任何画面区域。",
        "- 不得改变角色身份、服装、发型和场景空间关系。",
        "- 不得引入新的现代物件。",
        "- 不得把局部修改扩大成整张重画。"
      ];
  return [...base, ...constraints, "", "输出：一张与参考图相同比例和清晰度的最终图片。"].join("\n");
}

export interface RecordReviewOptions {
  decision: LibTvImageReviewDecision;
  feedback?: string;
}

export async function recordReview(projectRoot: string, id: string, options: RecordReviewOptions): Promise<{ target: LibTvImageTarget; state: LibTvState }> {
  const state = await readState(projectRoot);
  if (!state) {
    throw new CliUserError("没有本地状态，请先执行 libtv apply --only anchors/keyframes");
  }
  const target = findImageTarget(state, id);
  if (!target) {
    throw new CliUserError(`未找到图片节点: ${id}`);
  }
  target.item.reviewDecision = options.decision;
  target.item.feedback = options.feedback;
  if (options.decision === "direct") {
    target.item.finalNodeId = target.item.nodeId;
    if (target.kind === "keyframe") {
      target.item.status = "approved";
    }
  }
  if (options.decision === "refine") {
    target.item.finalNodeId = undefined;
  }
  state.updatedAt = new Date().toISOString();
  await writeState(projectRoot, state);
  return { target, state };
}

export interface RunRefineOptions {
  allowGeneration: boolean;
  base: LibTvRefineBase;
  instruction: string;
  negativeConstraints?: string[];
  x?: number;
  y?: number;
}

export async function runRefine(
  projectRoot: string,
  backend: LibTvBackend,
  id: string,
  options: RunRefineOptions
): Promise<{ target: LibTvImageTarget; refineNodeId: string; round: number; state: LibTvState }> {
  if (!options.allowGeneration) {
    throw new CliUserError("精修会触发真实生成，必须显式传入 --allow-generation");
  }
  const state = await readState(projectRoot);
  if (!state) {
    throw new CliUserError("没有本地状态，请先执行 libtv apply --only anchors/keyframes");
  }
  const target = findImageTarget(state, id);
  if (!target) {
    throw new CliUserError(`未找到图片节点: ${id}`);
  }
  const baseNodeId = resolveRefineBase(target, options.base);
  if (!baseNodeId) {
    throw new CliUserError(`无法确定精修基准节点: ${id}`);
  }
  const schema = await backend.getModelSchema("lib-image-2");
  if (!schema) {
    throw new CliUserError("未找到 LibTV 精修模型 lib-image-2");
  }
  const round = (target.item.refineRounds?.length ?? 0) + 1;
  const refineName = displayNameForTarget(target);
  const node = await backend.createNode({
    projectUuid: state.projectUuid,
    name: refineName,
    type: "image",
    prompt: buildRefinePrompt(options.instruction, options.negativeConstraints),
    params: {
      model: "lib-image-2"
    },
    groupNodeKey: target.kind === "keyframe" ? target.item.groupId : undefined,
    left: [baseNodeId],
    data: {
      avwKind: target.kind,
      avwRefine: true,
      avwRound: round,
      avwBase: options.base,
      avwSourceId: target.id
    },
    x: options.x,
    y: options.y,
    run: true
  });
  const refineRound = {
    round,
    base: options.base,
    baseNodeId,
    instruction: options.instruction,
    refineNodeId: node.nodeKey,
    status: "generated" as const
  };
  const rounds = [...(target.item.refineRounds ?? []), refineRound];
  target.item.refineRounds = rounds;
  target.item.status = target.kind === "keyframe" ? "refined_generated" : target.item.status;
  state.updatedAt = new Date().toISOString();
  await writeState(projectRoot, state);
  return { target, refineNodeId: node.nodeKey, round, state };
}
