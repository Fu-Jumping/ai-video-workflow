import type { ObsidianGeneratedFile } from "./types.js";

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
            path: "00_Project_Home.md",
            title: "Project Home"
          },
          {
            type: "file",
            ctime: 0,
            path: "01_Review_Dashboard.md",
            title: "Review Dashboard"
          },
          {
            type: "file",
            ctime: 0,
            path: "03_Production_Board.md",
            title: "Production Board"
          },
          {
            type: "file",
            ctime: 0,
            path: "Canvas/Review Map.canvas",
            title: "Review Map"
          },
          {
            type: "file",
            ctime: 0,
            path: "Notes/README.md",
            title: "Notes"
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
                  file: "00_Project_Home.md",
                  mode: "preview",
                  source: false
                }
              }
            }
          ],
          direction: "vertical"
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
        lastOpenFiles: ["00_Project_Home.md", "01_Review_Dashboard.md", "Canvas/Review Map.canvas"]
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
