import path from "node:path";

import { sanitizeVaultFileName, toVaultPath } from "./paths.js";
import { obsidianProperties, obsidianPropertyValues } from "./properties.js";
import type { ObsidianSourceFile } from "./types.js";

const stepNames: Record<number, string> = {
  1: "概念策划",
  2: "世界设定",
  3: "分镜脚本",
  4: "图片提示词",
  5: "视频提示词",
  6: "执行计划"
};

const stepFolders: Record<number, string> = {
  1: "步骤一 - 概念策划",
  2: "步骤二 - 世界设定",
  3: "步骤三 - 分镜脚本",
  4: "步骤四 - 图片提示词",
  5: "步骤五 - 视频提示词",
  6: "步骤六 - 执行计划"
};

const stepTags: Record<number, string> = {
  1: "ai-video/step/01-concept",
  2: "ai-video/step/02-setting",
  3: "ai-video/step/03-storyboard",
  4: "ai-video/step/04-image-prompt",
  5: "ai-video/step/05-video-prompt",
  6: "ai-video/step/06-execution"
};

type StageGroup = keyof typeof obsidianPropertyValues.stageGroup;
type ReviewStatus = keyof typeof obsidianPropertyValues.reviewStatus;
type ExecutionStatus = keyof typeof obsidianPropertyValues.executionStatus;

const stageGroups: Record<number, StageGroup> = {
  1: "foundation",
  2: "foundation",
  3: "shot-review",
  4: "prompt-production",
  5: "prompt-production",
  6: "execution"
};

export function stepFolderName(step: number): string {
  return stepFolders[step] ?? `步骤${step}`;
}

export function generatedFileName(sourceFile: ObsidianSourceFile): string {
  if (sourceFile.shotId) {
    const suffixByKind: Partial<Record<typeof sourceFile.sourceKind, string>> = {
      storyboard: "分镜脚本",
      "image-prompt": "图片提示词",
      "video-prompt": "视频提示词"
    };
    const suffix = suffixByKind[sourceFile.sourceKind];
    if (suffix) {
      return `${sanitizeVaultFileName(`${sourceFile.title} - ${suffix}`)}.md`;
    }
  }
  return `${sanitizeVaultFileName(sourceFile.title)}.md`;
}

export function workflowVaultPath(sourceFile: ObsidianSourceFile): string {
  return toVaultPath(path.join("流程", stepFolderName(sourceFile.step), generatedFileName(sourceFile)));
}

function shotOrder(shotId: string | undefined): number | undefined {
  const match = shotId?.match(/(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

function shotDisplayName(sourceFile: ObsidianSourceFile, sourceFiles: ObsidianSourceFile[] = [sourceFile]): string {
  if (!sourceFile.shotId) {
    return sourceFile.headingTitle?.trim() || sourceFile.title;
  }
  const shotFiles = sourceFiles.filter((file) => file.shotId === sourceFile.shotId);
  const storyboard = shotFiles.find((file) => file.sourceKind === "storyboard");
  const title = storyboard?.headingTitle ?? storyboard?.title ?? sourceFile.headingTitle ?? sourceFile.title;
  return title?.trim() || sourceFile.shotId;
}

function shotIndexLink(sourceFile: ObsidianSourceFile, sourceFiles: ObsidianSourceFile[] = [sourceFile]): string | undefined {
  if (!sourceFile.shotId) {
    return undefined;
  }
  return `[[镜头/${sourceFile.shotId}|${shotDisplayName(sourceFile, sourceFiles)}]]`;
}

function reviewStatus(sourceFile: ObsidianSourceFile): ReviewStatus {
  if (sourceFile.step === 6) {
    return "execution-review";
  }
  if (sourceFile.step >= 3) {
    return "shot-review";
  }
  return "reference";
}

function executionStatus(sourceFile: ObsidianSourceFile): ExecutionStatus {
  if (sourceFile.step === 6) {
    return "ready-for-execution";
  }
  if (sourceFile.step >= 4) {
    return "prompt-ready";
  }
  return "not-applicable";
}

function stripFrontmatter(content: string): string {
  if (!content.startsWith("---\n")) {
    return content;
  }
  const end = content.indexOf("\n---\n", 4);
  return end === -1 ? content : content.slice(end + 5);
}

function renderTags(sourceFile: ObsidianSourceFile): string[] {
  const tags = [
    "ai-video/project",
    stepTags[sourceFile.step] ?? `ai-video/step/${sourceFile.step}`,
    `ai-video/type/${sourceFile.sourceKind}`,
    "ai-video/status/ready"
  ];
  if (sourceFile.shotId) {
    tags.push(`ai-video/shot/${sourceFile.shotId}`);
  }
  return tags;
}

export function renderFrontmatter(sourceFile: ObsidianSourceFile, projectName: string, sourceFiles: ObsidianSourceFile[] = [sourceFile]): string {
  const order = shotOrder(sourceFile.shotId);
  const stageGroup = stageGroups[sourceFile.step] ?? "other";
  const lines = [
    "---",
    `${obsidianProperties.projectionGenerated}: ${obsidianPropertyValues.yes}`,
    `${obsidianProperties.workflowPack}: official-ai-video`,
    `${obsidianProperties.project}: ${projectName}`,
    `${obsidianProperties.sourcePath}: ${sourceFile.sourcePath}`,
    `${obsidianProperties.sourceKind}: ${obsidianPropertyValues.sourceKind[sourceFile.sourceKind]}`,
    `${obsidianProperties.step}: ${sourceFile.step}`,
    `${obsidianProperties.stepName}: ${stepNames[sourceFile.step] ?? obsidianPropertyValues.sourceKind[sourceFile.sourceKind]}`,
    `${obsidianProperties.stageGroup}: ${obsidianPropertyValues.stageGroup[stageGroup]}`,
    `${obsidianProperties.reviewStatus}: ${obsidianPropertyValues.reviewStatus[reviewStatus(sourceFile)]}`,
    `${obsidianProperties.executionStatus}: ${obsidianPropertyValues.executionStatus[executionStatus(sourceFile)]}`,
    `${obsidianProperties.needsAttention}: ${obsidianPropertyValues.no}`
  ];
  if (sourceFile.shotId) {
    lines.push(`${obsidianProperties.shotId}: ${sourceFile.shotId}`);
    if (order !== undefined) {
      lines.push(`${obsidianProperties.shotOrder}: ${order}`);
    }
    lines.push(`${obsidianProperties.shotIndex}: "${shotIndexLink(sourceFile, sourceFiles)}"`);
  }
  lines.push(`${obsidianProperties.status}: ${obsidianPropertyValues.ready}`, `${obsidianProperties.tags}:`);
  for (const tag of renderTags(sourceFile)) {
    lines.push(`  - ${tag}`);
  }
  lines.push("---");
  return lines.join("\n");
}

export function renderGeneratedWorkflowNote(
  sourceFile: ObsidianSourceFile,
  originalContent: string,
  projectName: string,
  sourceFiles: ObsidianSourceFile[] = [sourceFile]
): string {
  const navigation = [
    `> 这是生成的 Obsidian 观看层文件。需要修改项目事实时，请编辑源文件：\`${sourceFile.sourcePath}\`。`,
    "",
    "## Obsidian 导航",
    "",
    "- 项目首页：[[00_项目首页]]",
    "- 审阅总览：[[01_审阅总览]]",
    "- 制作看板：[[03_制作看板]]",
    "- 流程图：[[画布/流程图.canvas]]",
    "- 审阅地图：[[画布/审阅地图.canvas]]",
    `- 源路径：\`${sourceFile.sourcePath}\``
  ];
  if (sourceFile.shotId) {
    navigation.splice(5, 0, `- 镜头索引：${shotIndexLink(sourceFile, sourceFiles)}`);
  }

  return [renderFrontmatter(sourceFile, projectName, sourceFiles), "", ...navigation, "", stripFrontmatter(originalContent).trim(), ""].join("\n");
}
