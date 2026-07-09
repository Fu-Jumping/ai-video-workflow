import type { ObsidianGeneratedFile, ObsidianSourceFile } from "./types.js";
import { workflowVaultPath } from "./markdown.js";

function uniqueShotIds(sourceFiles: ObsidianSourceFile[]): string[] {
  return [...new Set(sourceFiles.map((file) => file.shotId).filter((shotId): shotId is string => Boolean(shotId)))].sort();
}

function linkForKind(sourceFiles: ObsidianSourceFile[], kind: ObsidianSourceFile["sourceKind"], label: string): string {
  const file = sourceFiles.find((sourceFile) => sourceFile.sourceKind === kind);
  return file ? `[[${workflowVaultPath(file)}|${label}]]` : `${label}: missing`;
}

function renderShotHub(shotId: string, shotFiles: ObsidianSourceFile[]): ObsidianGeneratedFile {
  const sourcePath = shotFiles.find((file) => file.sourceKind === "storyboard")?.sourcePath ?? shotFiles[0]?.sourcePath;
  const sourcePathLine = sourcePath ? `source_path: ${sourcePath}\n` : "";
  return {
    vaultPath: `Shots/${shotId}.md`,
    content: `---
projection_generated: true
source_kind: index
${sourcePathLine}shot_id: ${shotId}
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
- Production board: [[03_Production_Board]]

## Shot Records

![[Bases/Shots.base#Shot Table]]
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
  const shotLinks = shotIds.length > 0 ? shotIds.map((shotId) => `- [[${shotId}]]`).join("\n") : "- No shot files found yet.";
  const files: ObsidianGeneratedFile[] = [
    {
      vaultPath: "README.md",
      content: `# ${projectName} Obsidian Projection

Start with [[00_Project_Home]]. This vault is generated from an ai-video-workflow project.

Do not treat generated projection files as the source of truth. Edit the original Step files instead.
`
    },
    {
      vaultPath: "00_Project_Home.md",
      content: `# Project Home

## Start Here

- [[01_Review_Dashboard]]
- [[02_Shot_Index]]
- [[03_Production_Board]]
- [[Canvas/Workflow Map.canvas|Workflow Map]]
- [[Canvas/Shot Pipeline.canvas|Shot Pipeline]]

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

## Blocked or Needs Review

\`\`\`query
tag:#ai-video/status/blocked OR tag:#ai-video/review/needs-source-link OR tag:#ai-video/review/needs-step4-link
\`\`\`

## Production Status

![[Bases/Production Status.base#Production Status]]
`
    },
    {
      vaultPath: "02_Shot_Index.md",
      content: `# Shot Index

${shotLinks}

## Shot Table

![[Bases/Shots.base#Shot Table]]
`
    },
    {
      vaultPath: "03_Production_Board.md",
      content: `# Production Board

## Current Status

![[Bases/Production Status.base#Production Status]]

## Ready Items

\`\`\`query
tag:#ai-video/status/ready
\`\`\`
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
    ...shotIds.map((shotId) => renderShotHub(shotId, sourceFiles.filter((file) => file.shotId === shotId)))
  ];
  if (includePluginRecipes) {
    files.push(renderCommunityPluginRecipes());
  }
  return files;
}
