import fs from "fs-extra";
import path from "node:path";

import { STEP6_FILES, STEP_DIR_BY_NUMBER, WORKFLOW_STEPS } from "../constants.js";
import { readWorkflowProjectConfig } from "../project-root.js";

export interface BuildMcpContextOptions {
  projectRoot: string;
  pack: string;
}

export interface McpShotContext {
  id: string;
  title: string;
  sourcePaths: {
    storyboard: string;
    imagePrompt: string;
    videoPrompt: string;
    executionPlan: string[];
  };
}

export interface McpWorkflowStepContext {
  step: number;
  label: string;
  directory: string;
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
}

const step3Dir = STEP_DIR_BY_NUMBER[3];
const step4Dir = STEP_DIR_BY_NUMBER[4];
const step5Dir = STEP_DIR_BY_NUMBER[5];
const step6Dir = STEP_DIR_BY_NUMBER[6];

const workflowSteps: McpWorkflowStepContext[] = WORKFLOW_STEPS.map((step) => ({
  step: step.step,
  label: step.label,
  directory: step.directory
}));

const downstreamLinkPattern = /\]\(([^)]+)\)/g;

function normalizeRelativePath(relPath: string): string {
  return relPath.split(path.sep).join("/");
}

function stripAnchor(linkTarget: string): string {
  return linkTarget.split("#")[0];
}

function resolveLinkedProjectPath(sourceRelPath: string, linkTarget: string): string {
  const sourceDir = path.posix.dirname(normalizeRelativePath(sourceRelPath));
  return path.posix.normalize(path.posix.join(sourceDir, stripAnchor(linkTarget)));
}

function findDownstreamLink(content: string, sourceRelPath: string, targetDir: string): string | undefined {
  for (const match of content.matchAll(downstreamLinkPattern)) {
    const linkedPath = resolveLinkedProjectPath(sourceRelPath, match[1]);
    if (linkedPath.startsWith(`${targetDir}/`)) {
      return linkedPath;
    }
  }
  return undefined;
}

function shotNumberFromId(shotId: string): string | undefined {
  return shotId.match(/(?:shot|镜头)[-_ ]?(\d+)/i)?.[1];
}

function canonicalShotId(fileName: string): string {
  const raw = path.basename(fileName, ".md");
  const number = shotNumberFromId(raw);
  return number ? `shot-${number}` : raw;
}

async function findByShotId(projectRoot: string, dir: string, shotId: string): Promise<string> {
  const fullDir = path.join(projectRoot, dir);
  const entries = (await fs.pathExists(fullDir)) ? await fs.readdir(fullDir) : [];
  const number = shotNumberFromId(shotId);
  const prefixes = number ? [shotId, `镜头-${number}`, `镜头_${number}`, `镜头${number}`] : [shotId];
  const match = entries
    .filter((entry) => entry.endsWith(".md") && prefixes.some((prefix) => entry.startsWith(prefix)))
    .sort()[0];
  if (match) {
    return `${dir}/${match}`;
  }
  const fallbackFile = dir === step4Dir && number ? `镜头-${number}-关键帧.md` : number ? `镜头-${number}.md` : `${shotId}.md`;
  return `${dir}/${fallbackFile}`;
}

function titleFromMarkdown(content: string, fallback: string): string {
  const heading = content.match(/^#\s+(.+)$/m);
  return heading?.[1]?.trim() || fallback;
}

async function buildShotContext(projectRoot: string, storyboardFileName: string): Promise<McpShotContext> {
  const shotId = canonicalShotId(storyboardFileName);
  const storyboardPath = `${step3Dir}/${storyboardFileName}`;
  const storyboardContent = await fs.readFile(path.join(projectRoot, storyboardPath), "utf8");

  return {
    id: shotId,
    title: titleFromMarkdown(storyboardContent, shotId),
    sourcePaths: {
      storyboard: storyboardPath,
      imagePrompt: findDownstreamLink(storyboardContent, storyboardPath, step4Dir) ?? (await findByShotId(projectRoot, step4Dir, shotId)),
      videoPrompt: findDownstreamLink(storyboardContent, storyboardPath, step5Dir) ?? (await findByShotId(projectRoot, step5Dir, shotId)),
      executionPlan: STEP6_FILES.map((file) => `${step6Dir}/${file}`)
    }
  };
}

async function assertValidProjectShape(projectRoot: string): Promise<void> {
  await readWorkflowProjectConfig(projectRoot);
}

export async function buildMcpContext(options: BuildMcpContextOptions): Promise<McpProjectContext> {
  await assertValidProjectShape(options.projectRoot);

  const storyboardDir = path.join(options.projectRoot, step3Dir);
  const storyboardFiles = (await fs.pathExists(storyboardDir))
    ? (await fs.readdir(storyboardDir)).filter((entry) => entry.endsWith(".md")).sort()
    : [];

  const shots: McpShotContext[] = [];
  for (const storyboardFile of storyboardFiles) {
    shots.push(await buildShotContext(options.projectRoot, storyboardFile));
  }

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
    }
  };
}
