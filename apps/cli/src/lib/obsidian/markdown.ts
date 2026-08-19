import path from "node:path";

import { formatReferenceAssets } from "../reference-assets.js";
import { shotGroupDirectoryName } from "../shot-graph.js";
import { sanitizeVaultFileName, toVaultPath } from "./paths.js";
import { obsidianProperties, obsidianPropertyValues } from "./properties.js";
import { productionBoardPath, projectHomePath, reviewOverviewPath, singleShotPagePath, stageReviewPath, stepDisplayDirectory } from "./routes.js";
import type { ObsidianSourceFile } from "./types.js";

const stepNames: Record<number, string> = {
  0: "前期研究",
  1: "概念策划",
  2: "世界设定",
  3: "分镜脚本",
  4: "图片提示词",
  5: "视频提示词",
  6: "执行计划",
  7: "发布物料"
};

const stepTags: Record<number, string> = {
  0: "ai-video/step/00-research",
  1: "ai-video/step/01-concept",
  2: "ai-video/step/02-setting",
  3: "ai-video/step/03-storyboard",
  4: "ai-video/step/04-image-prompt",
  5: "ai-video/step/05-video-prompt",
  6: "ai-video/step/06-execution",
  7: "ai-video/step/07-publish"
};

type StageGroup = keyof typeof obsidianPropertyValues.stageGroup;
type ReviewStatus = keyof typeof obsidianPropertyValues.reviewStatus;
type ExecutionStatus = keyof typeof obsidianPropertyValues.executionStatus;

const stageGroups: Record<number, StageGroup> = {
  0: "research",
  1: "foundation",
  2: "foundation",
  3: "shot-review",
  4: "prompt-production",
  5: "prompt-production",
  6: "execution",
  7: "publish"
};

export function stepFolderName(step: number): string {
  return stepDisplayDirectory(step);
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
  const groupDirectory = sourceFile.shotGroupId ? shotGroupDirectoryName(sourceFile.shotGroupId) : undefined;
  return toVaultPath(path.posix.join(stageReviewPath(sourceFile.step), ...(groupDirectory ? [groupDirectory] : []), generatedFileName(sourceFile)));
}

export function wikiLinkTargetForVaultPath(vaultPath: string): string {
  return vaultPath.endsWith(".md") ? vaultPath.slice(0, -3) : vaultPath;
}

function shotOrder(shotId: string | undefined): number | undefined {
  const match = shotId?.match(/(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function noteTitle(sourceFile: ObsidianSourceFile): string {
  return sourceFile.headingTitle?.trim() || sourceFile.title;
}

function shotDisplayName(sourceFile: ObsidianSourceFile, sourceFiles: ObsidianSourceFile[] = [sourceFile]): string {
  if (!sourceFile.shotId) {
    return noteTitle(sourceFile);
  }
  const shotFiles = sourceFiles.filter((file) => file.shotId === sourceFile.shotId);
  const storyboard = shotFiles.find((file) => file.sourceKind === "storyboard");
  const title = storyboard?.headingTitle ?? storyboard?.title ?? sourceFile.headingTitle ?? sourceFile.title;
  return title?.trim() || sourceFile.shotId;
}

function nextAction(sourceFile: ObsidianSourceFile): string {
  return obsidianPropertyValues.nextAction[sourceFile.sourceKind];
}

function shotIndexLink(sourceFile: ObsidianSourceFile, sourceFiles: ObsidianSourceFile[] = [sourceFile]): string | undefined {
  if (!sourceFile.shotId) {
    return undefined;
  }
  return `[[${singleShotPagePath(sourceFile.shotId)}|${shotDisplayName(sourceFile, sourceFiles)}]]`;
}

function reviewStatus(sourceFile: ObsidianSourceFile): ReviewStatus {
  if (sourceFile.step === 7) {
    return "publish-review";
  }
  if (sourceFile.step >= 6) {
    return "execution-review";
  }
  if (sourceFile.step >= 3) {
    return "shot-review";
  }
  return "reference";
}

function executionStatus(sourceFile: ObsidianSourceFile): ExecutionStatus {
  if (sourceFile.step === 7) {
    return "ready-for-publish";
  }
  if (sourceFile.step >= 6) {
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

function normalizeSourcePath(value: string): string {
  return path.posix.normalize(value.replace(/\\/g, "/")).replace(/^\.\//, "");
}

function splitLinkTarget(target: string): { pathPart: string; anchor: string } {
  const hashIndex = target.indexOf("#");
  if (hashIndex === -1) {
    return { pathPart: target, anchor: "" };
  }
  return { pathPart: target.slice(0, hashIndex), anchor: target.slice(hashIndex) };
}

function isRewritableSourceMarkdownTarget(target: string): boolean {
  return (
    target.length > 0 &&
    target.endsWith(".md") &&
    !target.startsWith("#") &&
    !target.startsWith("/") &&
    !target.includes("\\") &&
    !/^[a-z][a-z0-9+.-]*:/i.test(target)
  );
}

function rewriteSourceMarkdownLinks(content: string, sourceFile: ObsidianSourceFile, sourceFiles: ObsidianSourceFile[]): string {
  const sourcePathToVaultPath = new Map(sourceFiles.map((file) => [normalizeSourcePath(file.sourcePath), workflowVaultPath(file)]));
  const sourceDir = path.posix.dirname(normalizeSourcePath(sourceFile.sourcePath));
  const markdownLinkPattern = /(!?)\[([^\]\r\n]+)\]\(([^)\r\n]+)\)/g;
  const wikiLinkPattern = /(!?)\[\[([^\]\r\n]+)\]\]/g;

  const rewriteTarget = (target: string): string | undefined => {
    const { pathPart, anchor } = splitLinkTarget(target);
    if (!isRewritableSourceMarkdownTarget(pathPart)) {
      return undefined;
    }
    const resolvedSourcePath = normalizeSourcePath(path.posix.join(sourceDir, pathPart));
    if (resolvedSourcePath.startsWith("../")) {
      return undefined;
    }
    const vaultPath = sourcePathToVaultPath.get(resolvedSourcePath);
    return vaultPath ? `${wikiLinkTargetForVaultPath(vaultPath)}${anchor}` : undefined;
  };

  const contentWithMarkdownLinks = content.replace(markdownLinkPattern, (match, imagePrefix: string, label: string, rawTarget: string) => {
    if (imagePrefix) {
      return match;
    }
    const rewrittenTarget = rewriteTarget(rawTarget.trim());
    return rewrittenTarget ? `[[${rewrittenTarget}|${label}]]` : match;
  });

  return contentWithMarkdownLinks.replace(wikiLinkPattern, (match, embedPrefix: string, rawTarget: string) => {
    const [target, alias] = rawTarget.split("|", 2);
    const rewrittenTarget = rewriteTarget(target?.trim() ?? "");
    if (!rewrittenTarget) {
      return match;
    }
    return `${embedPrefix}[[${rewrittenTarget}${alias ? `|${alias}` : ""}]]`;
  });
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
  if (sourceFile.shotGroupId) {
    tags.push(`ai-video/shot-group/${sourceFile.shotGroupId}`);
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
    `${obsidianProperties.title}: ${yamlString(noteTitle(sourceFile))}`,
    `${obsidianProperties.nextAction}: ${nextAction(sourceFile)}`,
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
    lines.push(`${obsidianProperties.shotTitle}: ${yamlString(shotDisplayName(sourceFile, sourceFiles))}`);
    lines.push(`${obsidianProperties.shotIndex}: "${shotIndexLink(sourceFile, sourceFiles)}"`);
  }
  if (sourceFile.shotGroupId) {
    lines.push(`${obsidianProperties.shotGroupId}: ${sourceFile.shotGroupId}`);
  }
  if (sourceFile.referenceAssets?.length) {
    lines.push(`${obsidianProperties.referenceAssets}: ${yamlString(formatReferenceAssets(sourceFile.referenceAssets))}`);
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
  const shotLink = sourceFile.shotId ? ` · 镜头：${shotIndexLink(sourceFile, sourceFiles)}` : "";
  const navigation = [
    `> 源文件：\`${sourceFile.sourcePath}\` · [[${projectHomePath}|首页]] · [[${reviewOverviewPath}|审阅总览]] · [[${productionBoardPath}|制作看板]]${shotLink}`
  ];
  const body = rewriteSourceMarkdownLinks(stripFrontmatter(originalContent).trim(), sourceFile, sourceFiles);

  return [renderFrontmatter(sourceFile, projectName, sourceFiles), "", ...navigation, "", body, ""].join("\n");
}
