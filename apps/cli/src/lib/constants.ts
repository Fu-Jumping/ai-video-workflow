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
export const SUPPORTED_PLATFORMS: Platform[] = ["openai", "gpt-image-2", "veo", "runway", "luma", "minimax", "seedance", "midjourney"];

export const PLATFORM_DISPLAY_NAMES: Record<Platform, string> = {
  openai: "OpenAI",
  "gpt-image-2": "GPT Image 2（LibTV）",
  veo: "Veo",
  runway: "Runway",
  luma: "Luma",
  minimax: "MiniMax",
  seedance: "Seedance",
  midjourney: "Midjourney"
};
export const DEFAULT_VIDEO_PLATFORM: Platform = "seedance";
export const DEFAULT_PACK = "official-ai-video";

/**
 * 内容树（内容/ 目录）的格式版本号，写在 project.config.yaml 的 content.format_version。
 *
 * 旧项目没有这个键，读取时按旧格式（legacy）处理、不报错；只有明确声明了本工具
 * 不认识的版本号时才报错，避免把新结构当旧结构读、或把旧项目当新结构写。
 */
export const CONTENT_FORMAT_VERSION = 1;
export const SUPPORTED_CONTENT_FORMAT_VERSIONS: readonly number[] = [1];

/** 内容树根目录名。 */
export const CONTENT_ROOT_DIRECTORY = "内容";

/** 迁移快照目录名：迁移后的旧文件在此保留为只读快照，不参与当前内容检查与投影。 */
export const MIGRATED_SNAPSHOT_DIRECTORY = "已迁移";

/** 内容树顶层两张总表。 */
export const CONTENT_SHOT_OVERVIEW_FILE = "00_镜头总表.md";
export const CONTENT_STORYBOARD_OVERVIEW_FILE = "01_分镜总表.md";

/** 场／镜头组的总览文件名（各自目录内固定同名）。 */
export const SCENE_OVERVIEW_FILE = "00_场总览.md";
export const SHOT_GROUP_OVERVIEW_FILE = "00_镜头组总览.md";

/** 目录名前缀：场-001 / 镜头组-001 / 镜头-001。 */
export const SCENE_DIRECTORY_PREFIX = "场-";
export const SHOT_GROUP_DIRECTORY_PREFIX = "镜头组-";
export const SHOT_DIRECTORY_PREFIX = "镜头-";

/** 单分镜文件名前缀：分镜-01.md（两位补零）。 */
export const STORYBOARD_FILE_PREFIX = "分镜-";

/** Step 3 目录下的内容树索引文件名（只放索引，不复制正文）。 */
export const CONTENT_INDEX_FILE = "00_内容树索引.md";

/** 单镜头内分镜数量上限（与 Step 3 门槛一致：1—6）。 */
export const MAX_STORYBOARD_SEGMENTS = 6;

/** 单镜头内关键帧数量上限（与 Step 4 门槛一致：不超过 4，也不超过分镜数）。 */
export const MAX_KEYFRAMES_PER_SHOT = 4;

/**
 * 自动区块与人工区块的标记名。
 *
 * 自动区块由工具刷新时整块替换，人工区块永不覆盖；区块以外的正文一律视为人工内容。
 */
export const CONTENT_BLOCK_NAMES = {
  shotOverview: "镜头总表",
  storyboardOverview: "分镜总表",
  sceneGroups: "场镜头组表",
  groupShots: "组镜头表",
  shotSegmentDigest: "分镜速览",
  shotImagePrompts: "图片提示词",
  shotSegments: "镜头段拼装",
  shotPromptBefore: "视频提示词前段",
  shotPromptAfter: "视频提示词后段",
  manualSummary: "人工摘要"
} as const;

export function researchStepEnabled(config: ProjectConfig): boolean {
  return config.workflow.research_step?.enabled === true;
}

export function activeWorkflowSteps(config: ProjectConfig): WorkflowStep[] {
  return researchStepEnabled(config) ? [...WORKFLOW_STEPS] : WORKFLOW_STEPS.filter((step) => step.step !== 0);
}

export function activeStepDirs(config: ProjectConfig): string[] {
  return activeWorkflowSteps(config).map((step) => step.directory);
}
