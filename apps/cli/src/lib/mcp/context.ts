import { STEP6_FILES, STEP_DIR_BY_NUMBER, activeWorkflowSteps } from "../constants.js";
import { readState } from "../libtv/project-binding.js";
import { readWorkflowProjectConfig } from "../project-root.js";
import { buildShotGraph } from "../shot-graph.js";
import type { ProjectConfig } from "../types.js";

export interface BuildMcpContextOptions {
  projectRoot: string;
  pack: string;
}

export interface McpShotContext {
  id: string;
  groupId: string;
  title: string;
  sourcePaths: {
    storyboard: string;
    imagePrompt: string;
    imagePrompts: string[];
    videoPrompt: string;
    executionPlan: string[];
  };
}

export interface McpWorkflowStepContext {
  step: number;
  label: string;
  directory: string;
}

export interface McpLibtvContext {
  available: boolean;
  projectUuid?: string;
  anchors: Array<{
    token: string;
    nodeId?: string;
    reviewDecision?: string;
    finalNodeId?: string;
    refineRounds: number;
  }>;
  keyframes: Array<{
    id: string;
    status?: string;
    nodeId?: string;
    reviewDecision?: string;
    finalNodeId?: string;
    refineRounds: number;
    taskId?: string;
    progressPercent?: number;
    generationError?: string;
    attempts?: number;
  }>;
  videos: Array<{
    id: string;
    status?: string;
    nodeId?: string;
    taskId?: string;
    progressPercent?: number;
    generationError?: string;
    attempts?: number;
  }>;
  summary?: {
    keyframes: { total: number; approved: number; pending: number; failed: number; generating: number };
    videos: { total: number; generated: number; failed: number; generating: number };
  };
}

export interface McpProjectContext {
  project: {
    pack: string;
    projectRoot: ".";
  };
  steps: McpWorkflowStepContext[];
  shots: McpShotContext[];
  verificationCommands: string[];
  editBoundaries: Record<string, string>;
  viewLayers: {
    obsidian: {
      defaultVaultPath: "_views/obsidian";
      sourceOfTruth: false;
      refreshCommand: "ai-video-workflow export-obsidian --project <path> --in-project-view";
    };
  };
  libtv: McpLibtvContext;
}

const step6Dir = STEP_DIR_BY_NUMBER[6];

function titleFromMarkdown(content: string, fallback: string): string {
  const heading = content.match(/^#\s+(.+)$/m);
  return heading?.[1]?.trim() || fallback;
}

async function assertValidProjectShape(projectRoot: string): Promise<ProjectConfig> {
  return readWorkflowProjectConfig(projectRoot);
}

export async function buildMcpContext(options: BuildMcpContextOptions): Promise<McpProjectContext> {
  const config = await assertValidProjectShape(options.projectRoot);
  const workflowSteps: McpWorkflowStepContext[] = activeWorkflowSteps(config).map((step) => ({
    step: step.step,
    label: step.label,
    directory: step.directory
  }));

  const graph = await buildShotGraph(options.projectRoot);
  const shots: McpShotContext[] = graph.shots
    .filter((shot) => shot.storyboard)
    .map((shot) => {
      const imagePrompts = shot.imagePrompts.map((file) => file.relPath);
      return {
        id: shot.id,
        groupId: shot.groupId ?? "ungrouped",
        title: titleFromMarkdown(shot.storyboard?.content ?? "", shot.id),
        sourcePaths: {
          storyboard: shot.storyboard?.relPath ?? "",
          imagePrompt: imagePrompts[0] ?? "",
          imagePrompts,
          videoPrompt: shot.videoPrompt?.relPath ?? "",
          executionPlan: STEP6_FILES.map((file) => `${step6Dir}/${file}`)
        }
      };
    });

  const libtvState = await readState(options.projectRoot);
  const libtv: McpLibtvContext = {
    available: Boolean(libtvState),
    projectUuid: libtvState?.projectUuid,
    anchors: (libtvState?.anchors ?? []).map((anchor) => ({
      token: anchor.token,
      nodeId: anchor.nodeId,
      reviewDecision: anchor.reviewDecision,
      finalNodeId: anchor.finalNodeId,
      refineRounds: anchor.refineRounds?.length ?? 0
    })),
    keyframes: (libtvState?.keyframes ?? []).map((item) => ({
      id: `${item.groupId}/${item.shotId}/${item.keyframeId}`,
      status: item.status,
      nodeId: item.nodeId,
      reviewDecision: item.reviewDecision,
      finalNodeId: item.finalNodeId,
      refineRounds: item.refineRounds?.length ?? 0,
      taskId: item.taskId,
      progressPercent: item.progressPercent,
      generationError: item.generationError,
      attempts: item.attempts
    })),
    videos: (libtvState?.videos ?? []).map((item) => ({
      id: `${item.groupId}/${item.shotId}`,
      status: item.status,
      nodeId: item.nodeId,
      taskId: item.taskId,
      progressPercent: item.progressPercent,
      generationError: item.generationError,
      attempts: item.attempts
    })),
    summary: libtvState ? {
      keyframes: {
        total: libtvState.keyframes.length,
        approved: libtvState.keyframes.filter((item) => item.status === "approved" || item.status === "final_approved").length,
        pending: libtvState.keyframes.filter((item) => item.status === "pending-approval" || item.status === "queued").length,
        failed: libtvState.keyframes.filter((item) => item.status === "failed").length,
        generating: libtvState.keyframes.filter((item) => item.status === "generating").length
      },
      videos: {
        total: libtvState.videos.length,
        generated: libtvState.videos.filter((item) => item.status === "generated").length,
        failed: libtvState.videos.filter((item) => item.status === "failed").length,
        generating: libtvState.videos.filter((item) => item.status === "generating").length
      }
    } : undefined
  };

  return {
    project: {
      pack: options.pack,
      projectRoot: "."
    },
    steps: workflowSteps,
    shots,
    verificationCommands: [
      "ai-video-workflow verify --project <path> --ide codex",
      "ai-video-workflow export-obsidian --project <path> --in-project-view",
      "ai-video-workflow verify-obsidian --project <path> --in-project-view",
      "ai-video-workflow mcp-context --project <path>"
    ],
    editBoundaries: {
      research: "真实资料、来源台账、摘录卡片、主题归纳和创作简报修改写入步骤零前期研究文件。",
      story: "故事和画面叙事修改写入步骤三分镜脚本文件。",
      image: "视觉一致性和图片提示词修改写入步骤四图片提示词文件。",
      motion: "运动和镜头行为修改写入步骤五视频提示词文件。",
      execution: "执行组织和生产排期修改写入步骤六执行计划文件。",
      generated: "不要把 _views/obsidian 下的 Obsidian 投影、IDE 运行镜像、Cherry Studio 的 SOUL/USER/memory 宿主表面或 MCP 资源当作源文件编辑。"
    },
    viewLayers: {
      obsidian: {
        defaultVaultPath: "_views/obsidian",
        sourceOfTruth: false,
        refreshCommand: "ai-video-workflow export-obsidian --project <path> --in-project-view"
      }
    },
    libtv
  };
}
