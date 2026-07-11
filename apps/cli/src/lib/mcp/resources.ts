import type { McpProjectContext } from "./context.js";

export interface McpResourceDefinition {
  uri: string;
  name: string;
  mimeType: "application/json" | "text/markdown";
  text: string;
}

function asJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function projectHandoffMarkdown(context: McpProjectContext): string {
  const shotLines = context.shots.map((shot) => `- ${shot.id}: ${shot.sourcePaths.storyboard}, ${shot.sourcePaths.imagePrompt}, ${shot.sourcePaths.videoPrompt}`);
  return [
    "# AI Video Workflow Agent Handoff",
    "",
    "Use source Step files as the editable truth.",
    "",
    "- Story and frame changes: Step 3 storyboard files.",
    "- Visual prompt and consistency changes: Step 4 image prompt files.",
    "- Motion and camera behavior changes: Step 5 video prompt files.",
    "- Execution logistics: Step 6 execution plan files.",
    "- Do not edit Obsidian projections, IDE runtime mirrors, or MCP resources as source files.",
    "",
    "## Shots",
    "",
    ...shotLines
  ].join("\n");
}

function verificationMarkdown(context: McpProjectContext): string {
  return ["# Verification Commands", "", ...context.verificationCommands.map((command) => `- \`${command}\``)].join("\n");
}

function packOverviewMarkdown(context: McpProjectContext): string {
  return [
    "# Official AI Video Pack",
    "",
    `Pack: \`${context.project.pack}\``,
    "",
    "The pack defines the Step 1 to Step 6 workflow, templates, skills, and file contracts.",
    "Project Step files remain the source of truth. MCP resources are read-only context."
  ].join("\n");
}

export function buildMcpResources(context: McpProjectContext): McpResourceDefinition[] {
  const resources: McpResourceDefinition[] = [
    {
      uri: "ai-video-workflow://project/summary",
      name: "Project summary",
      mimeType: "application/json",
      text: asJson({
        project: context.project,
        shotCount: context.shots.length,
        steps: context.steps
      })
    },
    {
      uri: "ai-video-workflow://project/config",
      name: "Project config",
      mimeType: "application/json",
      text: asJson(context.project)
    },
    {
      uri: `ai-video-workflow://pack/${context.project.pack}/overview`,
      name: "Pack overview",
      mimeType: "text/markdown",
      text: packOverviewMarkdown(context)
    },
    {
      uri: "ai-video-workflow://workflow/steps",
      name: "Workflow steps",
      mimeType: "application/json",
      text: asJson(context.steps)
    },
    {
      uri: "ai-video-workflow://shots/index",
      name: "Shots index",
      mimeType: "application/json",
      text: asJson(context.shots.map((shot) => ({ id: shot.id, title: shot.title, sourcePaths: shot.sourcePaths })))
    },
    {
      uri: "ai-video-workflow://handoff/project",
      name: "Project agent handoff",
      mimeType: "text/markdown",
      text: projectHandoffMarkdown(context)
    },
    {
      uri: "ai-video-workflow://verification/commands",
      name: "Verification commands",
      mimeType: "text/markdown",
      text: verificationMarkdown(context)
    }
  ];

  for (const step of context.steps) {
    resources.push({
      uri: `ai-video-workflow://workflow/step/${step.step}`,
      name: `Workflow step ${step.step}: ${step.label}`,
      mimeType: "application/json",
      text: asJson(step)
    });
  }

  for (const shot of context.shots) {
    resources.push({
      uri: `ai-video-workflow://shots/${shot.id}`,
      name: `Shot context: ${shot.id}`,
      mimeType: "application/json",
      text: asJson(shot)
    });
  }

  return resources.sort((a, b) => a.uri.localeCompare(b.uri));
}
