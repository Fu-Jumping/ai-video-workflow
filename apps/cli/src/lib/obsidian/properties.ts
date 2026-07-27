import type { ObsidianSourceKind } from "./types.js";

export const obsidianProperties = {
  projectionGenerated: "投影生成",
  workflowPack: "工作流包",
  project: "项目",
  title: "标题",
  shotTitle: "镜头标题",
  nextAction: "下一步",
  sourcePath: "源文件路径",
  sourceKind: "源文件类型",
  step: "步骤",
  stepName: "步骤名称",
  stageGroup: "阶段",
  reviewStatus: "审阅状态",
  executionStatus: "执行状态",
  needsAttention: "需要关注",
  shotId: "镜头ID",
  shotOrder: "镜头顺序",
  shotIndex: "镜头索引",
  referenceAssets: "参考资产",
  status: "状态",
  reviewMode: "审阅模式",
  reviewCanvas: "审阅画布",
  reviewNote: "审阅笔记",
  agentHandoff: "智能体交接",
  hasStoryboard: "有分镜脚本",
  hasImagePrompt: "有图片提示词",
  hasVideoPrompt: "有视频提示词",
  tags: "tags"
} as const;

export const legacyObsidianProperties: Partial<Record<keyof typeof obsidianProperties, string>> = {
  projectionGenerated: "projection_generated",
  workflowPack: "workflow_pack",
  title: "title",
  shotTitle: "shot_title",
  nextAction: "next_action",
  sourcePath: "source_path",
  sourceKind: "source_kind",
  stepName: "step_name",
  stageGroup: "stage_group",
  reviewStatus: "review_status",
  executionStatus: "execution_status",
  needsAttention: "needs_attention",
  shotId: "shot_id",
  shotOrder: "shot_order",
  shotIndex: "shot_index",
  referenceAssets: "reference_assets",
  reviewMode: "review_mode",
  reviewCanvas: "review_canvas",
  reviewNote: "review_note",
  agentHandoff: "agent_handoff",
  hasStoryboard: "has_storyboard",
  hasImagePrompt: "has_image_prompt",
  hasVideoPrompt: "has_video_prompt"
};

export const obsidianPropertyValues = {
  yes: "是",
  no: "否",
  ready: "就绪",
  sourceKind: {
    concept: "概念策划",
    setting: "世界设定",
    storyboard: "分镜脚本",
    "image-prompt": "图片提示词",
    "video-prompt": "视频提示词",
    "execution-plan": "执行计划",
    index: "索引"
  } satisfies Record<ObsidianSourceKind, string>,
  stageGroup: {
    foundation: "基础设定",
    "shot-review": "镜头审阅",
    "prompt-production": "提示词制作",
    execution: "执行",
    other: "其他"
  },
  reviewStatus: {
    "execution-review": "执行审阅",
    "shot-review": "镜头审阅",
    reference: "参考"
  },
  executionStatus: {
    "ready-for-execution": "可执行",
    "prompt-ready": "提示词就绪",
    "not-applicable": "不适用"
  },
  reviewMode: {
    immersive: "沉浸式"
  },
  nextAction: {
    concept: "完善故事内核",
    setting: "核对设定一致性",
    storyboard: "审阅镜头画面",
    "image-prompt": "检查图片提示词",
    "video-prompt": "检查视频提示词",
    "execution-plan": "执行前检查",
    index: "检查镜头对齐"
  }
} as const;

export function frontmatterValue(frontmatter: Record<string, string>, key: keyof typeof obsidianProperties): string | undefined {
  const legacyKey = legacyObsidianProperties[key];
  return frontmatter[obsidianProperties[key]] ?? (legacyKey ? frontmatter[legacyKey] : undefined);
}

export function isGeneratedFrontmatter(frontmatter: Record<string, string> | null): boolean {
  if (!frontmatter) {
    return false;
  }
  const value = frontmatterValue(frontmatter, "projectionGenerated");
  return value === obsidianPropertyValues.yes || value === "true";
}

export function hasGeneratedFrontmatterMarker(content: string): boolean {
  return (
    content.startsWith("---\n") &&
    (content.includes(`\n${obsidianProperties.projectionGenerated}: ${obsidianPropertyValues.yes}\n`) ||
      content.includes("\nprojection_generated: true\n"))
  );
}
