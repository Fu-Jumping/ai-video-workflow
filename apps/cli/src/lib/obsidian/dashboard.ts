import type { ObsidianGeneratedFile, ObsidianSourceFile } from "./types.js";
import { workflowVaultPath } from "./markdown.js";
import { shotReviewCanvasPath } from "./canvas.js";

function uniqueShotIds(sourceFiles: ObsidianSourceFile[]): string[] {
  return [...new Set(sourceFiles.map((file) => file.shotId).filter((shotId): shotId is string => Boolean(shotId)))].sort();
}

function shotOrder(shotId: string): number | undefined {
  const match = shotId.match(/(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

function linkForKind(sourceFiles: ObsidianSourceFile[], kind: ObsidianSourceFile["sourceKind"], label: string): string {
  const file = sourceFiles.find((sourceFile) => sourceFile.sourceKind === kind);
  return file ? `[[${workflowVaultPath(file)}|${label}]]` : `${label}: missing`;
}

function fileForKind(sourceFiles: ObsidianSourceFile[], kind: ObsidianSourceFile["sourceKind"]): ObsidianSourceFile | undefined {
  return sourceFiles.find((sourceFile) => sourceFile.sourceKind === kind);
}

function embeddedFileForKind(sourceFiles: ObsidianSourceFile[], kind: ObsidianSourceFile["sourceKind"], missingLabel: string): string {
  const file = fileForKind(sourceFiles, kind);
  return file ? `![[${workflowVaultPath(file)}]]` : `> ${missingLabel}: missing`;
}

function sourcePathForKind(sourceFiles: ObsidianSourceFile[], kind: ObsidianSourceFile["sourceKind"]): string {
  return fileForKind(sourceFiles, kind)?.sourcePath ?? "missing";
}

function shotNavigation(shotId: string, shotIds: string[]): string {
  const index = shotIds.indexOf(shotId);
  const previousShotId = index > 0 ? shotIds[index - 1] : undefined;
  const nextShotId = index >= 0 && index < shotIds.length - 1 ? shotIds[index + 1] : undefined;
  return [
    previousShotId ? `- Previous shot: [[Shots/${previousShotId}|${previousShotId}]]` : "- Previous shot: none",
    nextShotId ? `- Next shot: [[Shots/${nextShotId}|${nextShotId}]]` : "- Next shot: none"
  ].join("\n");
}

function booleanProperty(value: boolean): string {
  return value ? "true" : "false";
}

function renderShotAgentHandoff(shotId: string, shotFiles: ObsidianSourceFile[], allSourceFiles: ObsidianSourceFile[]): string {
  const storyboardSourcePath = sourcePathForKind(shotFiles, "storyboard");
  const imagePromptSourcePath = sourcePathForKind(shotFiles, "image-prompt");
  const videoPromptSourcePath = sourcePathForKind(shotFiles, "video-prompt");
  const executionPlanSourcePath = sourcePathForKind(allSourceFiles, "execution-plan");
  return `## Agent Handoff

Use this section to copy context into an agent conversation. Give feedback in the agent chat; do not edit generated Obsidian projection files.

### Source Files for Agent

- Storyboard source: \`${storyboardSourcePath}\`
- Step 4 image prompt source: \`${imagePromptSourcePath}\`
- Step 5 video prompt source: \`${videoPromptSourcePath}\`
- Execution plan source: \`${executionPlanSourcePath}\`
- Project handoff hub: [[04_Agent_Handoff|Agent Handoff]]

### Source Editing Boundary

- Narrative frame or shot intent changes belong in Step 3: \`${storyboardSourcePath}\`
- Image and frame consistency changes belong in Step 4: \`${imagePromptSourcePath}\`
- Motion, timing, and camera behavior changes belong in Step 5: \`${videoPromptSourcePath}\`
- Generated Obsidian files under \`Shots/\`, \`Workflow/\`, \`Bases/\`, and \`Canvas/\` are projection outputs.

### Copy-ready Prompt

\`\`\`text
Please inspect ${shotId} across its Step 3 storyboard, Step 4 image prompt, and Step 5 video prompt.

Source files:
- Storyboard: ${storyboardSourcePath}
- Step 4 image prompt: ${imagePromptSourcePath}
- Step 5 video prompt: ${videoPromptSourcePath}
- Execution plan: ${executionPlanSourcePath}

Keep Step 3 and Step 4 frame-aligned. If changes are needed, edit only the source Step files. Do not edit generated Obsidian projection files.
\`\`\`

### Verification Commands

\`\`\`powershell
node apps/cli/dist/index.js verify --project <project-path> --ide codex
node apps/cli/dist/index.js export-obsidian --project <project-path> --out <vault-path>
node apps/cli/dist/index.js verify-obsidian --project <project-path> --vault <vault-path>
\`\`\`
`;
}

function renderShotHub(shotId: string, shotFiles: ObsidianSourceFile[], allSourceFiles: ObsidianSourceFile[], shotIds: string[]): ObsidianGeneratedFile {
  const sourcePath = shotFiles.find((file) => file.sourceKind === "storyboard")?.sourcePath ?? shotFiles[0]?.sourcePath;
  const sourcePathLine = sourcePath ? `source_path: ${sourcePath}\n` : "";
  const order = shotOrder(shotId);
  const shotOrderLine = order === undefined ? "" : `shot_order: ${order}\n`;
  const storyboard = fileForKind(shotFiles, "storyboard");
  const imagePrompt = fileForKind(shotFiles, "image-prompt");
  const videoPrompt = fileForKind(shotFiles, "video-prompt");
  const reviewCanvasPath = shotReviewCanvasPath(shotId);
  return {
    vaultPath: `Shots/${shotId}.md`,
    content: `---
projection_generated: true
source_kind: index
${sourcePathLine}shot_id: ${shotId}
${shotOrderLine}stage_group: shot-review
review_status: shot-review
execution_status: prompt-ready
needs_attention: false
review_mode: immersive
review_canvas: "[[${reviewCanvasPath}]]"
review_note: "[[Notes/Shot Reviews/${shotId}]]"
agent_handoff: "[[04_Agent_Handoff#Single-Shot Handoff|Agent Handoff]]"
has_storyboard: ${booleanProperty(Boolean(storyboard))}
has_image_prompt: ${booleanProperty(Boolean(imagePrompt))}
has_video_prompt: ${booleanProperty(Boolean(videoPrompt))}
status: ready
tags:
  - ai-video/project
  - ai-video/shot/${shotId}
  - ai-video/type/index
  - ai-video/status/ready
---

# ${shotId}

## Immersive Review

- Storyboard: ${linkForKind(shotFiles, "storyboard", "Storyboard")}
- Image prompt: ${linkForKind(shotFiles, "image-prompt", "Image Prompt")}
- Video prompt: ${linkForKind(shotFiles, "video-prompt", "Video Prompt")}
- Execution plan: ${linkForKind(allSourceFiles, "execution-plan", "Execution Plan")}
- Review canvas: [[${reviewCanvasPath}|Shot Review Canvas]]
- User review note: [[Notes/Shot Reviews/${shotId}|${shotId} Review Note]]

## Review Route

- Review dashboard: [[01_Review_Dashboard]]
- Production board: [[03_Production_Board]]
- Review map: [[Canvas/Review Map.canvas]]
${shotNavigation(shotId, shotIds)}

## Source Sequence

${embeddedFileForKind(shotFiles, "storyboard", "Storyboard")}

## Frame Continuity

Use the storyboard frame as the reference when reviewing Step 4 image prompt continuity.

${embeddedFileForKind(shotFiles, "image-prompt", "Image prompt")}

## Prompt Handoff

Check whether the Step 5 video prompt preserves the Step 4 visual frame and adds only motion, timing, and camera behavior.

${embeddedFileForKind(shotFiles, "video-prompt", "Video prompt")}

## Execution Readiness

- Source Step files remain the source of truth.
- Confirm the storyboard, image prompt, and video prompt are aligned before execution.
- Use [[03_Production_Board]] for project-level execution checks.

${renderShotAgentHandoff(shotId, shotFiles, allSourceFiles)}

## Shot Records

![[Bases/Shots.base#Shot Table]]

## Progress View

![[Bases/Shots.base#Shot Progress]]

## User Notes

Write durable review comments under [[Notes/Shot Reviews/${shotId}|Notes/Shot Reviews/${shotId}]] so incremental export can keep generated files replaceable.

## Review Canvas

![[${reviewCanvasPath}]]
`
  };
}

function renderAgentHandoffPage(shotIds: string[]): ObsidianGeneratedFile {
  const shotLinks = shotIds.length > 0 ? shotIds.map((shotId) => `- [[Shots/${shotId}|${shotId}]] - [[Canvas/Shot Reviews/${shotId}.canvas|Review Canvas]]`).join("\n") : "- No shot files found yet.";
  return {
    vaultPath: "04_Agent_Handoff.md",
    content: `# Agent Handoff

Use this page when you have inspected the project in Obsidian and want an agent to modify source Step files. Obsidian is the viewing and location layer. The project Step files remain the source of truth.

## Navigation

- Project home: [[00_Project_Home]]
- Review dashboard: [[01_Review_Dashboard]]
- Shot index: [[02_Shot_Index]]
- Production board: [[03_Production_Board]]
- Workflow files: [[Bases/Workflow Files.base]]
- Shots base: [[Bases/Shots.base]]
- Production status: [[Bases/Production Status.base]]

## Single-Shot Handoff

${shotLinks}

## Source Editing Boundary

- Change story intent or shot framing in Step 3 storyboard files.
- Change image composition, subject description, and frame continuity in Step 4 image prompt files.
- Change motion, timing, camera movement, and video behavior in Step 5 video prompt files.
- Do not edit generated Obsidian projection files as the workflow source.

## Copy-ready Prompts

### Single-shot check

\`\`\`text
Please inspect the selected shot across Step 3 storyboard, Step 4 image prompt, and Step 5 video prompt.
Keep Step 3 and Step 4 frame-aligned.
If changes are needed, edit only the source Step files and do not edit generated Obsidian projection files.
\`\`\`

### Step 4 image prompt edit

\`\`\`text
Please update the Step 4 image prompt for the selected shot so it stays frame-aligned with the Step 3 storyboard.
Keep the Step 4 file contract intact and avoid context-dependent wording.
Do not edit generated Obsidian projection files.
\`\`\`

### Step 5 video prompt edit

\`\`\`text
Please update the Step 5 video prompt for the selected shot.
Preserve the Step 4 visual frame, and change only motion, timing, camera behavior, or video-specific details.
Do not edit generated Obsidian projection files.
\`\`\`

### Full project verification

\`\`\`text
Please verify the project after the source Step file edits.
Run the project verifier, refresh the Obsidian projection if needed, then run verify-obsidian.
Report any remaining Step 3 to Step 4 alignment or projection issues with exact source paths.
\`\`\`

## Verification Commands

\`\`\`powershell
pnpm build
node apps/cli/dist/index.js verify --project <project-path> --ide codex
node apps/cli/dist/index.js export-obsidian --project <project-path> --out <vault-path>
node apps/cli/dist/index.js verify-obsidian --project <project-path> --vault <vault-path>
\`\`\`
`
  };
}

function renderCommunityPluginRecipes(): ObsidianGeneratedFile {
  return {
    vaultPath: "Community Plugin Recipes.md",
    content: `# Community Plugin Recipes

The default Obsidian projection works with core Obsidian features only. These recipes are optional.

## Dataview

Use Dataview only when a project wants richer queries than core Bases.

## Tasks

Use Tasks only when the project wants interactive task queries across the vault.

## Kanban

Use Kanban only when the project wants a Markdown-backed board view.

## Excalidraw

Use Excalidraw only when the project needs richer visual sketching than core Canvas.
`
  };
}

export function renderDashboardFiles(projectName: string, sourceFiles: ObsidianSourceFile[], includePluginRecipes: boolean): ObsidianGeneratedFile[] {
  const shotIds = uniqueShotIds(sourceFiles);
  const shotLinks = shotIds.length > 0 ? shotIds.map((shotId) => `- [[Shots/${shotId}|${shotId}]] - [[${shotReviewCanvasPath(shotId)}|Review Canvas]]`).join("\n") : "- No shot files found yet.";
  const files: ObsidianGeneratedFile[] = [
    {
      vaultPath: "README.md",
      content: `# ${projectName} Obsidian Projection

Start with [[00_Project_Home]] for the project overview, then use [[01_Review_Dashboard]], [[03_Production_Board]], and [[Canvas/Review Map.canvas|Review Map]] for review.

Do not treat generated projection files as the source of truth. Edit the original Step files for workflow changes, and use [[Notes/README]] for Obsidian-only notes.
`
    },
    {
      vaultPath: "00_Project_Home.md",
      content: `# Project Home

## Review Command Center

- [[01_Review_Dashboard|Review Dashboard]]
- [[02_Shot_Index|Shot Index]]
- [[03_Production_Board|Production Board]]
- [[04_Agent_Handoff|Agent Handoff]]
- [[Notes/README|Obsidian Notes]]
- [[Canvas/Review Map.canvas|Review Map]]
- [[Canvas/Workflow Map.canvas|Workflow Map]]
- [[Canvas/Shot Pipeline.canvas|Shot Pipeline]]

## Immersive Shot Reviews

${shotLinks}

## Project Health

![[Bases/Workflow Files.base#Review Queue]]

## Shot Progress

![[Bases/Shots.base#Shot Progress]]

## Execution Readiness

![[Bases/Production Status.base#Execution Readiness]]

## Graph and Canvas Navigation

- Open Graph view to inspect generated Markdown links between project home, dashboards, shot hubs, and workflow files.
- Use [[Canvas/Review Map.canvas|Review Map]] for the review route.
- Use [[Canvas/Workflow Map.canvas|Workflow Map]] for step-level flow.
- Use [[Canvas/Shot Pipeline.canvas|Shot Pipeline]] for shot-level flow.

## Base Tables

- [[Bases/Workflow Files.base|Workflow Files Base]]
- [[Bases/Shots.base|Shots Base]]
- [[Bases/Production Status.base|Production Status Base]]

## Generated Conflict Check

- Incremental exports skip generated files that were edited in Obsidian and report \`skipped-user-modified\`.
- Run \`verify-obsidian\` to detect manifest hash mismatches before execution.

## Editing Boundary

- Source Step files remain the workflow source of truth.
- Generated projection files may be refreshed by \`export-obsidian\`.
- User-authored Obsidian notes belong under [[Notes/README|Notes]].

## Workflow Files

![[Bases/Workflow Files.base#Workflow Files]]

## Shot Cards

![[Bases/Shots.base#Shot Cards]]

## Workflow Map

![[Canvas/Workflow Map.canvas]]

## Shot Pipeline

![[Canvas/Shot Pipeline.canvas]]

## Review Queries

\`\`\`query
tag:#ai-video/review/needs-step4-link OR tag:#ai-video/status/blocked
\`\`\`
`
    },
    {
      vaultPath: "01_Review_Dashboard.md",
      content: `# Review Dashboard

## Needs Attention

![[Bases/Workflow Files.base#Review Queue]]

## Blocked

\`\`\`query
tag:#ai-video/status/blocked OR tag:#ai-video/review/needs-source-link OR tag:#ai-video/review/needs-step4-link
\`\`\`

## Ready for Execution

![[Bases/Production Status.base#Execution Readiness]]

## Generated File Conflicts

![[Bases/Workflow Files.base#Modified Generated Files]]

Use \`verify-obsidian\` when this queue shows possible projection conflicts. Move durable review notes into [[Notes/README|Notes]] instead of editing generated files.

## Agent Handoff

[[04_Agent_Handoff|Agent Handoff]]

## Review Map

![[Canvas/Review Map.canvas]]

## Shot Review Canvases

${shotLinks}

`
    },
    {
      vaultPath: "02_Shot_Index.md",
      content: `# Shot Index

${shotLinks}

## Agent Handoff

[[04_Agent_Handoff|Agent Handoff]]

## Shot Table

![[Bases/Shots.base#Shot Table]]

## Shot Progress

![[Bases/Shots.base#Shot Progress]]

## Immersive Review Table

![[Bases/Shots.base#Immersive Review]]

## Agent Handoff Table

![[Bases/Shots.base#Agent Handoff]]
`
    },
    {
      vaultPath: "03_Production_Board.md",
      content: `# Production Board

## Execution Readiness

![[Bases/Production Status.base#Execution Readiness]]

## Production Status

![[Bases/Production Status.base#Production Status]]

## Shot Progress

![[Bases/Shots.base#Shot Progress]]

## Ready Items

\`\`\`query
tag:#ai-video/status/ready
\`\`\`

## Handoff Links

- Review queue: [[01_Review_Dashboard]]
- Shot index: [[02_Shot_Index]]
- Agent handoff: [[04_Agent_Handoff]]
- Workflow map: [[Canvas/Workflow Map.canvas]]
- Review map: [[Canvas/Review Map.canvas]]
- Shot reviews: [[02_Shot_Index]]
`
    },
    {
      vaultPath: "Templates/Review Note Template.md",
      content: `---
tags:
  - ai-video/review
---

# Review Note

## Finding

## Source Link

## Follow-up
`
    },
    {
      vaultPath: "Templates/Shot Follow-up Template.md",
      content: `---
tags:
  - ai-video/shot
---

# Shot Follow-up

## Shot

## Issue

## Next Action
`
    },
    {
      vaultPath: "Notes/README.md",
      content: `# Obsidian Notes

Use this folder for Obsidian-only notes, review comments, meeting notes, and research that should live beside the generated projection.

Files you create in this folder are not part of the generated projection manifest and will be preserved by incremental \`export-obsidian\` runs.

If you edit a generated file, the next incremental export will skip that file and report it as \`skipped-user-modified\`.
`
    },
    renderAgentHandoffPage(shotIds),
    ...shotIds.map((shotId) => renderShotHub(shotId, sourceFiles.filter((file) => file.shotId === shotId), sourceFiles, shotIds))
  ];
  if (includePluginRecipes) {
    files.push(renderCommunityPluginRecipes());
  }
  return files;
}
