import type { Ide, Platform } from "./types.js";

export const WORKFLOW_STEPS = [
  { step: 1, directory: "01_概念策划", label: "概念策划", sourceKind: "concept" },
  { step: 2, directory: "02_世界设定", label: "世界设定", sourceKind: "setting" },
  { step: 3, directory: "03_分镜脚本", label: "分镜脚本", sourceKind: "storyboard" },
  { step: 4, directory: "04_图片提示词", label: "图片提示词", sourceKind: "image-prompt" },
  { step: 5, directory: "05_视频提示词", label: "视频提示词", sourceKind: "video-prompt" },
  { step: 6, directory: "06_执行计划", label: "执行计划", sourceKind: "execution-plan" }
] as const;

export const STEP_DIRS = WORKFLOW_STEPS.map((step) => step.directory);

export const STEP_DIR_BY_NUMBER = Object.fromEntries(WORKFLOW_STEPS.map((step) => [step.step, step.directory])) as Record<number, string>;

export const STORY_KERNEL_FILE = "故事内核.md";

export const STEP6_FILES = [
  "00_执行计划.md",
  "01_图片执行计划.md",
  "02_视频执行计划.md"
] as const;

export const SUPPORTED_IDES: Ide[] = ["codex", "cursor", "claude-code", "trae"];
export const SUPPORTED_PLATFORMS: Platform[] = ["openai", "veo", "runway", "luma", "minimax"];
export const DEFAULT_PACK = "official-ai-video";
