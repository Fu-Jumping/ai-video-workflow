import path from "node:path";

import { sanitizeVaultFileName, toVaultPath } from "./paths.js";
import type { ObsidianSourceFile } from "./types.js";

const stepNames: Record<number, string> = {
  1: "concept",
  2: "setting",
  3: "storyboard",
  4: "image-prompt",
  5: "video-prompt",
  6: "execution"
};

const stepFolders: Record<number, string> = {
  1: "Step 1 - Concept",
  2: "Step 2 - Setting",
  3: "Step 3 - Storyboard",
  4: "Step 4 - Image Prompts",
  5: "Step 5 - Video Prompts",
  6: "Step 6 - Execution Plan"
};

const stepTags: Record<number, string> = {
  1: "ai-video/step/01-concept",
  2: "ai-video/step/02-setting",
  3: "ai-video/step/03-storyboard",
  4: "ai-video/step/04-image-prompt",
  5: "ai-video/step/05-video-prompt",
  6: "ai-video/step/06-execution"
};

const stageGroups: Record<number, string> = {
  1: "foundation",
  2: "foundation",
  3: "shot-review",
  4: "prompt-production",
  5: "prompt-production",
  6: "execution"
};

export function stepFolderName(step: number): string {
  return stepFolders[step] ?? `Step ${step}`;
}

export function generatedFileName(sourceFile: ObsidianSourceFile): string {
  if (sourceFile.shotId) {
    const suffixByKind: Partial<Record<typeof sourceFile.sourceKind, string>> = {
      storyboard: "Storyboard",
      "image-prompt": "Image Prompt",
      "video-prompt": "Video Prompt"
    };
    const suffix = suffixByKind[sourceFile.sourceKind];
    if (suffix) {
      return `${sanitizeVaultFileName(`${sourceFile.title} - ${suffix}`)}.md`;
    }
  }
  return `${sanitizeVaultFileName(sourceFile.title)}.md`;
}

export function workflowVaultPath(sourceFile: ObsidianSourceFile): string {
  return toVaultPath(path.join("Workflow", stepFolderName(sourceFile.step), generatedFileName(sourceFile)));
}

function shotOrder(shotId: string | undefined): number | undefined {
  const match = shotId?.match(/(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

function reviewStatus(sourceFile: ObsidianSourceFile): string {
  if (sourceFile.step === 6) {
    return "execution-review";
  }
  if (sourceFile.step >= 3) {
    return "shot-review";
  }
  return "reference";
}

function executionStatus(sourceFile: ObsidianSourceFile): string {
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

export function renderFrontmatter(sourceFile: ObsidianSourceFile, projectName: string): string {
  const order = shotOrder(sourceFile.shotId);
  const lines = [
    "---",
    "projection_generated: true",
    "workflow_pack: official-ai-video",
    `project: ${projectName}`,
    `source_path: ${sourceFile.sourcePath}`,
    `source_kind: ${sourceFile.sourceKind}`,
    `step: ${sourceFile.step}`,
    `step_name: ${stepNames[sourceFile.step] ?? sourceFile.sourceKind}`,
    `stage_group: ${stageGroups[sourceFile.step] ?? "other"}`,
    `review_status: ${reviewStatus(sourceFile)}`,
    `execution_status: ${executionStatus(sourceFile)}`,
    "needs_attention: false"
  ];
  if (sourceFile.shotId) {
    lines.push(`shot_id: ${sourceFile.shotId}`);
    if (order !== undefined) {
      lines.push(`shot_order: ${order}`);
    }
    lines.push(`shot_index: "[[${sourceFile.shotId}]]"`);
  }
  lines.push("status: ready", "tags:");
  for (const tag of renderTags(sourceFile)) {
    lines.push(`  - ${tag}`);
  }
  lines.push("---");
  return lines.join("\n");
}

export function renderGeneratedWorkflowNote(sourceFile: ObsidianSourceFile, originalContent: string, projectName: string): string {
  const navigation = [
    `> Generated Obsidian projection. Edit the source file instead: \`${sourceFile.sourcePath}\`.`,
    "",
    "## Obsidian Navigation",
    "",
    "- Project home: [[00_Project_Home]]",
    "- Review dashboard: [[01_Review_Dashboard]]",
    "- Production board: [[03_Production_Board]]",
    "- Workflow map: [[Canvas/Workflow Map.canvas]]",
    "- Review map: [[Canvas/Review Map.canvas]]",
    `- Source path: \`${sourceFile.sourcePath}\``
  ];
  if (sourceFile.shotId) {
    navigation.splice(5, 0, `- Shot index: [[${sourceFile.shotId}]]`);
  }

  return [renderFrontmatter(sourceFile, projectName), "", ...navigation, "", stripFrontmatter(originalContent).trim(), ""].join("\n");
}
