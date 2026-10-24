import type { MediaCandidateRecord, MediaRecord } from "./media-records.js";

/**
 * 人工审核四态（C5）。
 *
 * 存储层仍只有三态（未审／已审可用／已审不可用）；这里把它和「当前文件是否还和
 * 审核时一致」合起来，派生出人一眼能懂的四句话。四态不写回素材记录，
 * 每次都从记录与文件哈希重新算出来。
 */
export type HumanReviewState = "not-ready" | "waiting" | "accepted" | "needs-recheck";

export const humanReviewStateLabels: Record<HumanReviewState, string> = {
  "not-ready": "还没准备好",
  waiting: "等你看",
  accepted: "你已接受",
  "needs-recheck": "改过了需要重看"
};

/**
 * 单条候选的四态。
 *
 * `currentSha256` 为 undefined 表示文件不存在或读不到：此时即使记录写着已审可用，
 * 也不能说「你已接受」，因为页面里根本没有可看的文件。
 */
export function deriveCandidateHumanState(input: {
  candidate: MediaCandidateRecord;
  currentSha256?: string;
}): HumanReviewState {
  const { candidate, currentSha256 } = input;
  if (candidate.reviewStatus === "accepted") {
    if (currentSha256 === undefined) {
      return "not-ready";
    }
    if (!candidate.sha256 || candidate.sha256 === currentSha256) {
      return "accepted";
    }
    return "needs-recheck";
  }
  if (candidate.reviewStatus === "rejected") {
    return "not-ready";
  }
  if (
    candidate.reviewStatus === "unreviewed" &&
    candidate.selected &&
    candidate.downloadStatus === "downloaded" &&
    currentSha256 !== undefined
  ) {
    return "waiting";
  }
  return "not-ready";
}

/** 汇总优先级固定为：需要重看 > 等你看 > 还没准备好 > 你已接受。 */
const humanStatePriority: readonly HumanReviewState[] = ["needs-recheck", "waiting", "not-ready", "accepted"];

export function summarizeHumanReviewStates(states: HumanReviewState[]): HumanReviewState {
  if (states.length === 0) {
    return "not-ready";
  }
  for (const state of humanStatePriority) {
    if (states.includes(state)) {
      return state;
    }
  }
  return "not-ready";
}

/**
 * 一条素材记录的「主候选」：当前选用命中的那个；否则取标记为选用的那个。
 * 历史候选（旧版本、未选用）不参与镜头页汇总，避免旧图把状态拖成「等你看」。
 */
export function primaryMediaCandidate(record: MediaRecord): MediaCandidateRecord | undefined {
  const bySelection = record.currentSelection
    ? record.candidates.find((candidate) => candidate.fileName === record.currentSelection)
    : undefined;
  return bySelection ?? record.candidates.find((candidate) => candidate.selected);
}
