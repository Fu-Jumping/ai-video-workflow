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
  "Read the source Step files first.",
  "Edit only source Step files when changes are needed.",
  "Do not edit Obsidian projections, IDE runtime mirrors, or MCP resources as source files.",
  "Run verification after edits."
].join(" ");

export function buildMcpPrompts(): McpPromptDefinition[] {
  return [
    {
      name: "review_project",
      description: "Review the whole AI video workflow project and identify source-file issues.",
      arguments: [{ name: "focus", required: false, description: "Optional review focus." }],
      template: `${boundaryText}\n\nReview the project context, summarize risks, and point each recommendation to Step 1 through Step 6 source files.`
    },
    {
      name: "inspect_shot",
      description: "Inspect one shot across storyboard, image prompt, video prompt, and execution context.",
      arguments: [
        { name: "shotId", required: true, description: "Shot id such as shot-001." },
        { name: "focus", required: false, description: "Optional inspection focus." }
      ],
      template: `${boundaryText}\n\nInspect {{shotId}} across Step 3, Step 4, Step 5, and Step 6. Report which source file should change for each issue.`
    },
    {
      name: "revise_storyboard",
      description: "Prepare a source-file edit plan for story or frame changes.",
      arguments: [
        { name: "shotId", required: true, description: "Shot id such as shot-001." },
        { name: "focus", required: false, description: "Requested story or frame change." }
      ],
      template: `${boundaryText}\n\nFor story, continuity, or frame-level changes in {{shotId}}, inspect and edit Step 3 storyboard files. Keep Step 3 and Step 4 frame-aligned.`
    },
    {
      name: "revise_image_prompt",
      description: "Prepare a source-file edit plan for Step 4 visual prompt changes.",
      arguments: [
        { name: "shotId", required: true, description: "Shot id such as shot-001." },
        { name: "focus", required: false, description: "Requested visual prompt change." }
      ],
      template: `${boundaryText}\n\nFor visual style, subject consistency, or image prompt changes in {{shotId}}, inspect and edit Step 4 image prompt files. Keep the Step 4 file contract intact.`
    },
    {
      name: "revise_video_prompt",
      description: "Prepare a source-file edit plan for Step 5 motion and camera changes.",
      arguments: [
        { name: "shotId", required: true, description: "Shot id such as shot-001." },
        { name: "focus", required: false, description: "Requested motion or camera change." }
      ],
      template: `${boundaryText}\n\nFor motion, camera behavior, timing, or animation changes in {{shotId}}, inspect and edit Step 5 video prompt files.`
    },
    {
      name: "verify_project",
      description: "Run or explain verification after source-file edits.",
      arguments: [{ name: "focus", required: false, description: "Optional verification focus." }],
      template: `${boundaryText}\n\nRun or request the verification commands from the MCP context. Report issues by source path and do not repair generated adapter surfaces directly.`
    }
  ].sort((a, b) => a.name.localeCompare(b.name));
}
