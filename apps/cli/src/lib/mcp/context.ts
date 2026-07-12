import fs from "fs-extra";
import path from "node:path";

import { STEP6_FILES } from "../constants.js";
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

const workflowSteps: McpWorkflowStepContext[] = [
  { step: 1, label: "Concept", directory: "01_concept" },
  { step: 2, label: "Setting", directory: "02_setting" },
  { step: 3, label: "Storyboard", directory: "03_storyboard" },
  { step: 4, label: "Image prompts", directory: "04_image_prompts" },
  { step: 5, label: "Video prompts", directory: "05_video_prompts" },
  { step: 6, label: "Execution plan", directory: "06_execution_plan" }
];

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

async function findByPrefix(projectRoot: string, dir: string, shotId: string): Promise<string> {
  const fullDir = path.join(projectRoot, dir);
  const entries = (await fs.pathExists(fullDir)) ? await fs.readdir(fullDir) : [];
  const match = entries.filter((entry) => entry.endsWith(".md") && entry.startsWith(shotId)).sort()[0];
  return match ? `${dir}/${match}` : `${dir}/${shotId}.md`;
}

function titleFromMarkdown(content: string, fallback: string): string {
  const heading = content.match(/^#\s+(.+)$/m);
  return heading?.[1]?.trim() || fallback;
}

async function buildShotContext(projectRoot: string, storyboardFileName: string): Promise<McpShotContext> {
  const shotId = path.basename(storyboardFileName, ".md");
  const storyboardPath = `03_storyboard/${storyboardFileName}`;
  const storyboardContent = await fs.readFile(path.join(projectRoot, storyboardPath), "utf8");

  return {
    id: shotId,
    title: titleFromMarkdown(storyboardContent, shotId),
    sourcePaths: {
      storyboard: storyboardPath,
      imagePrompt: findDownstreamLink(storyboardContent, storyboardPath, "04_image_prompts") ?? (await findByPrefix(projectRoot, "04_image_prompts", shotId)),
      videoPrompt: findDownstreamLink(storyboardContent, storyboardPath, "05_video_prompts") ?? (await findByPrefix(projectRoot, "05_video_prompts", shotId)),
      executionPlan: STEP6_FILES.map((file) => `06_execution_plan/${file}`)
    }
  };
}

async function assertValidProjectShape(projectRoot: string): Promise<void> {
  await readWorkflowProjectConfig(projectRoot);
}

export async function buildMcpContext(options: BuildMcpContextOptions): Promise<McpProjectContext> {
  await assertValidProjectShape(options.projectRoot);

  const storyboardDir = path.join(options.projectRoot, "03_storyboard");
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
      story: "Edit Step 3 storyboard files.",
      image: "Edit Step 4 image prompt files.",
      motion: "Edit Step 5 video prompt files.",
      execution: "Edit Step 6 execution plan files.",
      generated: "Do not edit Obsidian projections under _views/obsidian, IDE runtime mirrors, Cherry Studio SOUL/USER/memory host surfaces, or MCP resources as source files."
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
