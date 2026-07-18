export interface McpPromptArgument {
  name: string;
  required: boolean;
  description: string;
}

export interface McpPromptDefinition {
  name: string;
  description: string;
  arguments: McpPromptArgument[];
  template: string;
}

const boundaryText = [
  "先读取步骤源文件。",
  "需要修改时只编辑步骤源文件。",
  "将 _views/obsidian 视为生成的观看层。",
  "笔记/ 可以包含用户观察，但不能替代步骤文件。",
  "不要把 _views/obsidian 下的 Obsidian 投影、IDE 运行镜像或 MCP 资源当作源文件编辑。",
  "修改后运行验证。"
].join(" ");

export function buildMcpPrompts(): McpPromptDefinition[] {
  return [
    {
      name: "review_project",
      description: "审阅整个 AI 视频工作流项目，并识别源文件问题。",
      arguments: [{ name: "focus", required: false, description: "可选审阅重点。" }],
      template: `${boundaryText}\n\n审阅项目上下文，总结风险，并把每条建议指向步骤一到步骤六的源文件。`
    },
    {
      name: "inspect_shot",
      description: "跨分镜、图片提示词、视频提示词和执行上下文检查单个镜头。",
      arguments: [
        { name: "shotId", required: true, description: "镜头 id，例如 shot-001。" },
        { name: "focus", required: false, description: "可选检查重点。" }
      ],
      template: `${boundaryText}\n\n跨步骤三、步骤四、步骤五和步骤六检查 {{shotId}}。针对每个问题说明应该修改哪个源文件。`
    },
    {
      name: "revise_storyboard",
      description: "为故事或画面修改准备源文件编辑计划。",
      arguments: [
        { name: "shotId", required: true, description: "镜头 id，例如 shot-001。" },
        { name: "focus", required: false, description: "请求的故事或画面修改。" }
      ],
      template: `${boundaryText}\n\n对于 {{shotId}} 的故事、连续性或画面级修改，检查并编辑步骤三分镜脚本文件。保持步骤三和步骤四逐镜头对齐。`
    },
    {
      name: "revise_image_prompt",
      description: "为步骤四视觉提示词修改准备源文件编辑计划。",
      arguments: [
        { name: "shotId", required: true, description: "镜头 id，例如 shot-001。" },
        { name: "focus", required: false, description: "请求的视觉提示词修改。" }
      ],
      template: `${boundaryText}\n\n对于 {{shotId}} 的视觉风格、主体一致性或图片提示词修改，检查并编辑步骤四图片提示词文件。保持步骤四文件合同完整。`
    },
    {
      name: "revise_video_prompt",
      description: "为步骤五运动和镜头修改准备源文件编辑计划。",
      arguments: [
        { name: "shotId", required: true, description: "镜头 id，例如 shot-001。" },
        { name: "focus", required: false, description: "请求的运动或镜头修改。" }
      ],
      template: `${boundaryText}\n\n对于 {{shotId}} 的运动、镜头行为、时长或动画修改，检查并编辑步骤五视频提示词文件。`
    },
    {
      name: "verify_project",
      description: "在源文件修改后运行或解释验证。",
      arguments: [{ name: "focus", required: false, description: "可选验证重点。" }],
      template: `${boundaryText}\n\n运行或请求 MCP 上下文中的验证命令。按源路径报告问题，不要直接修复生成的适配器表面。`
    }
  ].sort((a, b) => a.name.localeCompare(b.name));
}
