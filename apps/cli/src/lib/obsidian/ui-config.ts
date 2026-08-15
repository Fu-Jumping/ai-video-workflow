import type { ObsidianGeneratedFile } from "./types.js";
import {
  agentHandoffPath,
  notesIndexPath,
  productionBoardPath,
  projectHomePath,
  reviewMapCanvasPath,
  reviewOverviewPath,
  shotLookupIndexPath,
  shotPipelineCanvasPath,
  stageReviewOverviewPath,
  workflowCanvasPath
} from "./routes.js";

interface SuggestedUiFile {
  fileName: string;
  content: string;
}

const suggestedDir = ".obsidian/ai-video-workflow-suggested";

function jsonContent(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function uiFile(fileName: string, content: string): ObsidianGeneratedFile[] {
  return [
    {
      vaultPath: `.obsidian/${fileName}`,
      content
    },
    {
      vaultPath: `${suggestedDir}/${fileName}`,
      content
    }
  ];
}

function suggestedFiles(): SuggestedUiFile[] {
  return [
    {
      fileName: "bookmarks.json",
      content: jsonContent({
        items: [
          {
            type: "file",
            ctime: 0,
            path: projectHomePath,
            title: "项目首页"
          },
          {
            type: "file",
            ctime: 0,
            path: agentHandoffPath,
            title: "智能体交接"
          },
          {
            type: "file",
            ctime: 0,
            path: stageReviewOverviewPath,
            title: "阶段审核"
          },
          {
            type: "file",
            ctime: 0,
            path: shotLookupIndexPath,
            title: "镜头索引"
          },
          {
            type: "file",
            ctime: 0,
            path: productionBoardPath,
            title: "制作看板"
          },
          {
            type: "file",
            ctime: 0,
            path: reviewMapCanvasPath,
            title: "审阅地图"
          },
          {
            type: "file",
            ctime: 0,
            path: shotPipelineCanvasPath,
            title: "镜头流水线"
          },
          {
            type: "file",
            ctime: 0,
            path: notesIndexPath,
            title: "笔记"
          }
        ]
      })
    },
    {
      fileName: "workspace.json",
      content: jsonContent({
        main: {
          id: "ai-video-workflow-main",
          type: "split",
          children: [
            {
              id: "ai-video-workflow-home-leaf",
              type: "leaf",
              state: {
                type: "markdown",
                state: {
                  file: projectHomePath,
                  mode: "preview",
                  source: false
                }
              }
            },
            {
              id: "ai-video-workflow-review-leaf",
              type: "leaf",
              state: {
                type: "markdown",
                state: {
                  file: reviewOverviewPath,
                  mode: "preview",
                  source: false
                }
              }
            }
          ],
          direction: "horizontal"
        },
        left: {
          id: "ai-video-workflow-left",
          type: "split",
          children: [],
          direction: "horizontal",
          width: 300
        },
        right: {
          id: "ai-video-workflow-right",
          type: "split",
          children: [],
          direction: "horizontal",
          width: 300
        },
        active: "ai-video-workflow-home-leaf",
        lastOpenFiles: [projectHomePath, stageReviewOverviewPath, reviewOverviewPath, shotLookupIndexPath, productionBoardPath, reviewMapCanvasPath, workflowCanvasPath, shotPipelineCanvasPath]
      })
    },
    {
      fileName: "core-plugins.json",
      content: jsonContent({
        bookmarks: true,
        graph: true,
        canvas: true,
        backlink: true,
        "outgoing-link": true,
        "page-preview": true,
        templates: true
      })
    },
    {
      fileName: "appearance.json",
      content: jsonContent({
        baseFontSize: 16
      })
    }
  ];
}

export function isDirectObsidianUiConfigPath(vaultPath: string): boolean {
  return /^\.obsidian\/[^/]+\.json$/.test(vaultPath);
}

export function renderObsidianUiConfigFiles(): ObsidianGeneratedFile[] {
  return suggestedFiles().flatMap((file) => uiFile(file.fileName, file.content));
}
