import type { ObsidianGeneratedFile, ObsidianSourceFile } from "./types.js";
import { workflowVaultPath } from "./markdown.js";

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

function renderShotHub(shotId: string, shotFiles: ObsidianSourceFile[]): ObsidianGeneratedFile {
  const sourcePath = shotFiles.find((file) => file.sourceKind === "storyboard")?.sourcePath ?? shotFiles[0]?.sourcePath;
  const sourcePathLine = sourcePath ? `source_path: ${sourcePath}\n` : "";
  const order = shotOrder(shotId);
  const shotOrderLine = order === undefined ? "" : `shot_order: ${order}\n`;
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
status: ready
tags:
  - ai-video/project
  - ai-video/shot/${shotId}
  - ai-video/type/index
  - ai-video/status/ready
---

# ${shotId}

## Shot Links

- Storyboard: ${linkForKind(shotFiles, "storyboard", "Storyboard")}
- Image prompt: ${linkForKind(shotFiles, "image-prompt", "Image Prompt")}
- Video prompt: ${linkForKind(shotFiles, "video-prompt", "Video Prompt")}
- Review dashboard: [[01_Review_Dashboard]]
- Production board: [[03_Production_Board]]
- Review map: [[Canvas/Review Map.canvas]]

## Shot Records

![[Bases/Shots.base#Shot Table]]

## Progress View

![[Bases/Shots.base#Shot Progress]]
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
  const shotLinks = shotIds.length > 0 ? shotIds.map((shotId) => `- [[Shots/${shotId}|${shotId}]]`).join("\n") : "- No shot files found yet.";
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
- [[Notes/README|Obsidian Notes]]
- [[Canvas/Review Map.canvas|Review Map]]
- [[Canvas/Workflow Map.canvas|Workflow Map]]
- [[Canvas/Shot Pipeline.canvas|Shot Pipeline]]

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

## Review Map

![[Canvas/Review Map.canvas]]

`
    },
    {
      vaultPath: "02_Shot_Index.md",
      content: `# Shot Index

${shotLinks}

## Shot Table

![[Bases/Shots.base#Shot Table]]

## Shot Progress

![[Bases/Shots.base#Shot Progress]]
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
- Workflow map: [[Canvas/Workflow Map.canvas]]
- Review map: [[Canvas/Review Map.canvas]]
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
    ...shotIds.map((shotId) => renderShotHub(shotId, sourceFiles.filter((file) => file.shotId === shotId)))
  ];
  if (includePluginRecipes) {
    files.push(renderCommunityPluginRecipes());
  }
  return files;
}
