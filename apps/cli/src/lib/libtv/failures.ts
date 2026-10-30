import { LibTvGenerationError } from "./execution.js";
import type { LibTvFailureClass } from "./types.js";

/**
 * 三类失败态的中文标签。
 * 取值与素材记录（apps/cli/src/lib/media-records.ts 的 MediaFailureClass）保持一致，
 * 这样 LibTV 执行状态与素材记录可以用同一套口径互相解释。
 */
export const libTvFailureClassLabels: Record<LibTvFailureClass, string> = {
  "remote-unknown": "远端状态未知",
  "remote-failed": "远端明确失败",
  "local-save-failed": "生成成功但本地保存失败"
};

export function describeLibTvFailureClass(value: LibTvFailureClass | undefined): string | undefined {
  return value ? libTvFailureClassLabels[value] : undefined;
}

export interface LibTvFailureClassification {
  /** 写进状态文件的节点状态：远端明确失败写 failed，状态未知写 unknown。 */
  status: "failed" | "unknown";
  failureClass: LibTvFailureClass;
}

/**
 * 把生成阶段抛出的错误归到三类失败态。
 *
 * - timeout / remote-unknown：查询远端任务状态拿不到确定结果 → unknown，不消耗 --retry 语义；
 * - 其余（含平台明确返回失败）：failed + remote-failed。
 *
 * 下载失败不在这里判定，它由 download.ts 的返回值单独记为 local-save-failed。
 */
export function classifyLibTvGenerationError(error: unknown): LibTvFailureClassification {
  if (error instanceof LibTvGenerationError) {
    if (error.reason === "timeout" || error.reason === "remote-unknown") {
      return { status: "unknown", failureClass: "remote-unknown" };
    }
  }
  return { status: "failed", failureClass: "remote-failed" };
}
