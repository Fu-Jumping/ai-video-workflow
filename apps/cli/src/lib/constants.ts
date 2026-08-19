import type { Ide, Platform, ProjectConfig } from "./types.js";

export const WORKFLOW_STEPS = [
  { step: 0, directory: "00_前期研究", label: "前期研究", sourceKind: "research" },
  { step: 1, directory: "01_概念策划", label: "概念策划", sourceKind: "concept" },
  { step: 2, directory: "02_世界设定", label: "世界设定", sourceKind: "setting" },
  { step: 3, directory: "03_分镜脚本", label: "分镜脚本", sourceKind: "storyboard" },
  { step: 4, directory: "04_图片提示词", label: "图片提示词", sourceKind: "image-prompt" },
  { step: 5, directory: "05_视频提示词", label: "视频提示词", sourceKind: "video-prompt" },
  { step: 6, directory: "06_执行计划", label: "执行计划", sourceKind: "execution-plan" },
  { step: 7, directory: "07_发布物料", label: "发布物料", sourceKind: "publish" }
] as const;

export const STEP_DIRS = WORKFLOW_STEPS.map((step) => step.directory);

export const STEP_DIR_BY_NUMBER = Object.fromEntries(WORKFLOW_STEPS.map((step) => [step.step, step.directory])) as Record<number, string>;

export type WorkflowStep = typeof WORKFLOW_STEPS[number];

export const STEP0_FILES = [
  "00_研究总览.md",
  "01_资料索引.md",
  "02_摘录卡片.md",
  "03_主题归纳.md",
  "04_创作简报.md"
] as const;

export const STORY_KERNEL_FILE = "故事内核.md";

export const STEP6_FILES = [
  "00_执行计划.md",
  "01_图片执行计划.md",
  "02_视频执行计划.md"
] as const;

export const STEP7_FILES = [
  "00_发布总表.md",
  "01_标题.md",
  "02_简介正文.md",
  "03_话题标签.md",
  "04_封面文案.md"
] as const;

export const SUPPORTED_IDES: Ide[] = ["codex", "cursor", "claude-code", "trae"];
export const SUPPORTED_PLATFORMS: Platform[] = ["openai", "veo", "runway", "luma", "minimax", "seedance", "midjourney"];
export const DEFAULT_VIDEO_PLATFORM: Platform = "seedance";
export const DEFAULT_PACK = "official-ai-video";

export function researchStepEnabled(config: ProjectConfig): boolean {
  return config.workflow.research_step?.enabled === true;
}

export function activeWorkflowSteps(config: ProjectConfig): WorkflowStep[] {
  return researchStepEnabled(config) ? [...WORKFLOW_STEPS] : WORKFLOW_STEPS.filter((step) => step.step !== 0);
}

export function activeStepDirs(config: ProjectConfig): string[] {
  return activeWorkflowSteps(config).map((step) => step.directory);
}
