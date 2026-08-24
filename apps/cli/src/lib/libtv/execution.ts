import { CliUserError } from "../cli-errors.js";
import type { LibTvBackend } from "./backend.js";
import type { LibTvGenerationProgress, LibTvNodeDetail } from "./types.js";

export interface RunNodeGenerationOptions {
  projectUuid: string;
  node: LibTvNodeDetail;
  modelKey: string;
  prompt: string;
  taskType: "image" | "video" | "audio" | "text";
  params?: Record<string, unknown>;
  existingTaskId?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
  onProgress?: (progress: LibTvGenerationProgress) => void | Promise<void>;
}

export interface RunNodeGenerationResult {
  node: LibTvNodeDetail;
  taskId: string;
  progress: LibTvGenerationProgress;
}

export class LibTvGenerationError extends Error {
  readonly reason: string;
  readonly taskId?: string;

  constructor(reason: string, message: string, taskId?: string) {
    super(message);
    this.name = "LibTvGenerationError";
    this.reason = reason;
    this.taskId = taskId;
  }
}

export class LibTvGenerationTimeoutError extends LibTvGenerationError {
  constructor(taskId: string, timeoutMs: number) {
    super("timeout", `生成超时: ${taskId} (${timeoutMs}ms)`, taskId);
    this.name = "LibTvGenerationTimeoutError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function terminalMessage(progress: LibTvGenerationProgress): string {
  if (typeof progress.errorMessage === "string" && progress.errorMessage) {
    return progress.errorMessage;
  }
  if (typeof progress.taskResult === "string" && progress.taskResult) {
    return progress.taskResult.slice(0, 500);
  }
  return `generation status=${progress.status ?? "unknown"}`;
}

export async function runNodeGeneration(
  backend: LibTvBackend,
  options: RunNodeGenerationOptions
): Promise<RunNodeGenerationResult> {
  const pollIntervalMs = options.pollIntervalMs ?? 2000;
  const timeoutMs = options.timeoutMs ?? 1200000;

  let taskId = options.existingTaskId;
  if (!taskId) {
    const nodeParams = (options.node.data?.params ?? {}) as Record<string, unknown>;
    const mergedParams = { ...nodeParams, ...(options.params ?? {}) };
    const created = await backend.createGeneration({
      projectUuid: options.projectUuid,
      nodeId: options.node.nodeKey,
      modelKey: options.modelKey,
      prompt: options.prompt,
      taskType: options.taskType,
      params: mergedParams
    });
    if (!created.taskId) {
      throw new LibTvGenerationError("generation-failed", "生成任务未返回 taskId", created.nodeId);
    }
    taskId = created.taskId;
  }

  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const progresses = await backend.getGenerationProgress([taskId]);
    const current = progresses[0];
    if (!current) {
      throw new LibTvGenerationError("generation-failed", `无法查询生成进度: ${taskId}`, taskId);
    }
    await options.onProgress?.(current);

    if (current.status === 2) {
      const saved = await backend.saveGenerationResult({
        projectUuid: options.projectUuid,
        node: options.node,
        progress: current
      });
      const node = (await backend.getNode(options.projectUuid, options.node.nodeKey)) ?? saved;
      return { node, taskId, progress: current };
    }

    if (current.status === 3) {
      throw new LibTvGenerationError("generation-failed", terminalMessage(current), taskId);
    }

    if (Date.now() >= deadline) {
      throw new LibTvGenerationTimeoutError(taskId, timeoutMs);
    }

    await sleep(pollIntervalMs);
  }
}

export function requireGenerationPermission(allowGeneration: boolean | undefined): void {
  if (allowGeneration !== true) {
    throw new CliUserError("关键帧/视频生成会触发真实生成，必须显式传入 --allow-generation");
  }
}
