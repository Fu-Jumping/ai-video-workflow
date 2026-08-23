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
    "# AI 视频工作流智能体交接",
    "",
    "使用步骤源文件作为可编辑事实源。",
    "",
    "- 故事和画面修改：步骤三分镜脚本文件。",
    "- 视觉提示词和一致性修改：步骤四图片提示词文件。",
    "- 运动和镜头行为修改：步骤五视频提示词文件。",
    "- 执行组织：步骤六执行计划文件。",
    "- `_views/obsidian/` 是生成的 Obsidian 观看层；修改源文件后要刷新它。",
    "- `_views/obsidian/04_个人笔记/` 可以存放用户观察，但不能替代步骤文件。",
    "- 不要把 Obsidian 投影、IDE 运行镜像或 MCP 资源当作源文件编辑。",
    "",
    "刷新命令：",
    "",
    `- \`${context.viewLayers.obsidian.refreshCommand}\``,
    "",
    "## 镜头",
    "",
    ...shotLines
  ].join("\n");
}

function verificationMarkdown(context: McpProjectContext): string {
  return ["# 验证命令", "", ...context.verificationCommands.map((command) => `- \`${command}\``)].join("\n");
}

function packOverviewMarkdown(context: McpProjectContext): string {
  return [
    "# 官方 AI 视频工作流包",
    "",
    `Pack: \`${context.project.pack}\``,
    "",
    "这个工作流包定义可配置步骤流程、模板、技能和文件合同；研究模式包含步骤零到步骤七，剧本模式包含步骤一到步骤七。",
    "项目步骤文件仍是事实源。MCP 资源只是只读上下文。",
    "`_views/obsidian/` 是生成的观看层，不应反向作为源文件。"
  ].join("\n");
}

export function buildMcpResources(context: McpProjectContext): McpResourceDefinition[] {
  const resources: McpResourceDefinition[] = [
    {
      uri: "ai-video-workflow://project/summary",
      name: "项目摘要",
      mimeType: "application/json",
      text: asJson({
        project: context.project,
        shotCount: context.shots.length,
        steps: context.steps,
        viewLayers: context.viewLayers
      })
    },
    {
      uri: "ai-video-workflow://project/config",
      name: "项目配置",
      mimeType: "application/json",
      text: asJson(context.project)
    },
    {
      uri: "ai-video-workflow://libtv/status",
      name: "LibTV 执行状态",
      mimeType: "application/json",
      text: asJson(context.libtv)
    },
    {
      uri: `ai-video-workflow://pack/${context.project.pack}/overview`,
      name: "工作流包概览",
      mimeType: "text/markdown",
      text: packOverviewMarkdown(context)
    },
    {
      uri: "ai-video-workflow://workflow/steps",
      name: "工作流步骤",
      mimeType: "application/json",
      text: asJson(context.steps)
    },
    {
      uri: "ai-video-workflow://shots/index",
      name: "镜头索引",
      mimeType: "application/json",
      text: asJson(context.shots.map((shot) => ({ id: shot.id, title: shot.title, sourcePaths: shot.sourcePaths })))
    },
    {
      uri: "ai-video-workflow://handoff/project",
      name: "项目智能体交接",
      mimeType: "text/markdown",
      text: projectHandoffMarkdown(context)
    },
    {
      uri: "ai-video-workflow://verification/commands",
      name: "验证命令",
      mimeType: "text/markdown",
      text: verificationMarkdown(context)
    }
  ];

  for (const step of context.steps) {
    resources.push({
      uri: `ai-video-workflow://workflow/step/${step.step}`,
      name: `工作流步骤 ${step.step}: ${step.label}`,
      mimeType: "application/json",
      text: asJson(step)
    });
  }

  for (const shot of context.shots) {
    resources.push({
      uri: `ai-video-workflow://shots/${shot.id}`,
      name: `镜头上下文: ${shot.id}`,
      mimeType: "application/json",
      text: asJson(shot)
    });
  }

  return resources.sort((a, b) => a.uri.localeCompare(b.uri));
}
