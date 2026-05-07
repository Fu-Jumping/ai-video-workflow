import type { Ide, Platform } from "./types.js";

export const STEP_DIRS = [
  "01_concept",
  "02_setting",
  "03_storyboard",
  "04_image_prompts",
  "05_video_prompts",
  "06_execution_plan"
] as const;

export const STEP6_FILES = [
  "00_execution_plan.md",
  "01_image_execution_plan.md",
  "02_video_execution_plan.md"
] as const;

export const SUPPORTED_IDES: Ide[] = ["codex", "cursor", "claude-code", "trae"];
export const SUPPORTED_PLATFORMS: Platform[] = ["openai", "veo", "runway", "luma", "minimax"];
export const DEFAULT_PACK = "official-ai-video";
