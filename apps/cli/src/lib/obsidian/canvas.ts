import { workflowVaultPath } from "./markdown.js";
import type { ObsidianGeneratedFile, ObsidianSourceFile } from "./types.js";

interface CanvasNode {
  id: string;
  type: "text" | "file" | "link" | "group";
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  text?: string;
  file?: string;
  label?: string;
}

interface CanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  fromSide?: "top" | "right" | "bottom" | "left";
  toSide?: "top" | "right" | "bottom" | "left";
  toEnd?: "arrow" | "none";
  label?: string;
  color?: string;
}

interface CanvasFile {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

const stepColors: Record<number, string> = {
  1: "1",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6"
};

function canvasJson(canvas: CanvasFile): string {
  return `${JSON.stringify(canvas, null, 2)}\n`;
}

function uniqueShotIds(sourceFiles: ObsidianSourceFile[]): string[] {
  return [...new Set(sourceFiles.map((file) => file.shotId).filter((shotId): shotId is string => Boolean(shotId)))].sort();
}

function shotFileForKind(sourceFiles: ObsidianSourceFile[], shotId: string, sourceKind: ObsidianSourceFile["sourceKind"]): ObsidianSourceFile | undefined {
  return sourceFiles.find((file) => file.shotId === shotId && file.sourceKind === sourceKind);
}

function addSourceOrMissingNode({
  nodes,
  edges,
  nodeId,
  previousNodeId,
  sourceFile,
  missingText,
  x,
  y,
  color,
  edgeLabel
}: {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  nodeId: string;
  previousNodeId: string;
  sourceFile: ObsidianSourceFile | undefined;
  missingText: string;
  x: number;
  y: number;
  color: string;
  edgeLabel: string;
}): string {
  if (sourceFile) {
    nodes.push({
      id: nodeId,
      type: "file",
      file: workflowVaultPath(sourceFile),
      x,
      y,
      width: 320,
      height: 110,
      color
    });
  } else {
    nodes.push({
      id: nodeId,
      type: "text",
      text: missingText,
      x,
      y,
      width: 320,
      height: 110,
      color
    });
  }
  edges.push({
    id: `${previousNodeId}-${nodeId}`,
    fromNode: previousNodeId,
    toNode: nodeId,
    fromSide: "right",
    toSide: "left",
    toEnd: "arrow",
    label: edgeLabel
  });
  return nodeId;
}

export function shotReviewCanvasPath(shotId: string): string {
  return `Canvas/Shot Reviews/${shotId}.canvas`;
}

export function renderWorkflowCanvas(sourceFiles: ObsidianSourceFile[]): ObsidianGeneratedFile {
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];
  const firstNodeByStep = new Map<number, string>();

  for (let step = 1; step <= 6; step += 1) {
    nodes.push({
      id: `step-${step}-group`,
      type: "group",
      label: `Step ${step}`,
      x: (step - 1) * 420,
      y: 0,
      width: 360,
      height: 520,
      color: stepColors[step]
    });
  }

  sourceFiles.forEach((sourceFile, index) => {
    const nodeId = `file-${index}`;
    const sameStepIndex = sourceFiles.filter((file, fileIndex) => file.step === sourceFile.step && fileIndex < index).length;
    nodes.push({
      id: nodeId,
      type: "file",
      file: workflowVaultPath(sourceFile),
      x: (sourceFile.step - 1) * 420 + 30,
      y: 70 + sameStepIndex * 110,
      width: 300,
      height: 90,
      color: stepColors[sourceFile.step]
    });
    if (!firstNodeByStep.has(sourceFile.step)) {
      firstNodeByStep.set(sourceFile.step, nodeId);
    }
  });

  const labels = ["sets context", "frames", "generates image prompt", "feeds video prompt", "tracks execution"];
  for (let step = 1; step < 6; step += 1) {
    const fromNode = firstNodeByStep.get(step);
    const toNode = firstNodeByStep.get(step + 1);
    if (fromNode && toNode) {
      edges.push({
        id: `edge-step-${step}-${step + 1}`,
        fromNode,
        toNode,
        fromSide: "right",
        toSide: "left",
        toEnd: "arrow",
        label: labels[step - 1]
      });
    }
  }

  return { vaultPath: "Canvas/Workflow Map.canvas", content: canvasJson({ nodes, edges }) };
}

export function renderShotPipelineCanvas(sourceFiles: ObsidianSourceFile[]): ObsidianGeneratedFile {
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];
  const shotIds = uniqueShotIds(sourceFiles);
  let nodeIndex = 0;

  shotIds.forEach((shotId, shotIndex) => {
    const shotFiles = sourceFiles.filter((file) => file.shotId === shotId).sort((left, right) => left.step - right.step);
    nodes.push({
      id: `shot-${shotIndex}-group`,
      type: "group",
      label: shotId,
      x: 0,
      y: shotIndex * 460,
      width: 1200,
      height: 380,
      color: "5"
    });
    let previousNodeId: string | undefined;
    shotFiles.forEach((sourceFile, fileIndex) => {
      const nodeId = `shot-${shotIndex}-file-${fileIndex}`;
      nodes.push({
        id: nodeId,
        type: "file",
        file: workflowVaultPath(sourceFile),
        x: 40 + fileIndex * 360,
        y: shotIndex * 460 + 90,
        width: 300,
        height: 120,
        color: stepColors[sourceFile.step]
      });
      if (previousNodeId) {
        edges.push({
          id: `shot-edge-${nodeIndex}`,
          fromNode: previousNodeId,
          toNode: nodeId,
          fromSide: "right",
          toSide: "left",
          toEnd: "arrow",
          label: "next"
        });
        nodeIndex += 1;
      }
      previousNodeId = nodeId;
    });
  });

  return { vaultPath: "Canvas/Shot Pipeline.canvas", content: canvasJson({ nodes, edges }) };
}

export function renderShotReviewCanvases(sourceFiles: ObsidianSourceFile[]): ObsidianGeneratedFile[] {
  return uniqueShotIds(sourceFiles).map((shotId) => {
    const nodes: CanvasNode[] = [
      {
        id: "shot-review",
        type: "file",
        file: `Shots/${shotId}.md`,
        x: 0,
        y: 0,
        width: 320,
        height: 120,
        color: "1"
      }
    ];
    const edges: CanvasEdge[] = [];
    const storyboard = shotFileForKind(sourceFiles, shotId, "storyboard");
    const imagePrompt = shotFileForKind(sourceFiles, shotId, "image-prompt");
    const videoPrompt = shotFileForKind(sourceFiles, shotId, "video-prompt");

    let previousNodeId = addSourceOrMissingNode({
      nodes,
      edges,
      nodeId: "storyboard",
      previousNodeId: "shot-review",
      sourceFile: storyboard,
      missingText: `Missing storyboard for ${shotId}`,
      x: 420,
      y: -150,
      color: "3",
      edgeLabel: "review start / frame"
    });
    previousNodeId = addSourceOrMissingNode({
      nodes,
      edges,
      nodeId: "image-prompt",
      previousNodeId,
      sourceFile: imagePrompt,
      missingText: `Missing image prompt for ${shotId}`,
      x: 840,
      y: -150,
      color: "4",
      edgeLabel: "image prompt"
    });
    previousNodeId = addSourceOrMissingNode({
      nodes,
      edges,
      nodeId: "video-prompt",
      previousNodeId,
      sourceFile: videoPrompt,
      missingText: `Missing video prompt for ${shotId}`,
      x: 1260,
      y: -150,
      color: "5",
      edgeLabel: "video prompt"
    });

    nodes.push(
      {
        id: "production-board",
        type: "file",
        file: "03_Production_Board.md",
        x: 1680,
        y: -150,
        width: 320,
        height: 110,
        color: "6"
      },
      {
        id: "notes",
        type: "file",
        file: "Notes/README.md",
        x: 420,
        y: 120,
        width: 320,
        height: 110,
        color: "5"
      }
    );
    edges.push(
      {
        id: "video-production",
        fromNode: previousNodeId,
        toNode: "production-board",
        fromSide: "right",
        toSide: "left",
        toEnd: "arrow",
        label: "execute"
      },
      {
        id: "shot-notes",
        fromNode: "shot-review",
        toNode: "notes",
        fromSide: "bottom",
        toSide: "left",
        toEnd: "arrow",
        label: "notes"
      }
    );

    return { vaultPath: shotReviewCanvasPath(shotId), content: canvasJson({ nodes, edges }) };
  });
}

export function renderReviewMapCanvas(): ObsidianGeneratedFile {
  const nodes: CanvasNode[] = [
    {
      id: "home",
      type: "file",
      file: "00_Project_Home.md",
      x: 0,
      y: 0,
      width: 300,
      height: 100,
      color: "1"
    },
    {
      id: "review-dashboard",
      type: "file",
      file: "01_Review_Dashboard.md",
      x: 420,
      y: -160,
      width: 300,
      height: 100,
      color: "2"
    },
    {
      id: "shot-index",
      type: "file",
      file: "02_Shot_Index.md",
      x: 420,
      y: 0,
      width: 300,
      height: 100,
      color: "3"
    },
    {
      id: "production-board",
      type: "file",
      file: "03_Production_Board.md",
      x: 420,
      y: 160,
      width: 300,
      height: 100,
      color: "4"
    },
    {
      id: "agent-handoff",
      type: "file",
      file: "04_Agent_Handoff.md",
      x: 420,
      y: 320,
      width: 300,
      height: 100,
      color: "6"
    },
    {
      id: "notes",
      type: "file",
      file: "Notes/README.md",
      x: 0,
      y: 240,
      width: 300,
      height: 100,
      color: "5"
    },
    {
      id: "workflow-base",
      type: "file",
      file: "Bases/Workflow Files.base",
      x: 840,
      y: -220,
      width: 320,
      height: 90,
      color: "2"
    },
    {
      id: "shots-base",
      type: "file",
      file: "Bases/Shots.base",
      x: 840,
      y: 0,
      width: 320,
      height: 90,
      color: "3"
    },
    {
      id: "production-base",
      type: "file",
      file: "Bases/Production Status.base",
      x: 840,
      y: 220,
      width: 320,
      height: 90,
      color: "4"
    },
    {
      id: "workflow-map",
      type: "file",
      file: "Canvas/Workflow Map.canvas",
      x: 1240,
      y: -120,
      width: 320,
      height: 90,
      color: "6"
    },
    {
      id: "shot-pipeline",
      type: "file",
      file: "Canvas/Shot Pipeline.canvas",
      x: 1240,
      y: 100,
      width: 320,
      height: 90,
      color: "6"
    }
  ];
  const edges: CanvasEdge[] = [
    {
      id: "home-review",
      fromNode: "home",
      toNode: "review-dashboard",
      fromSide: "right",
      toSide: "left",
      toEnd: "arrow",
      label: "review queue"
    },
    {
      id: "home-shots",
      fromNode: "home",
      toNode: "shot-index",
      fromSide: "right",
      toSide: "left",
      toEnd: "arrow",
      label: "shot progress"
    },
    {
      id: "home-production",
      fromNode: "home",
      toNode: "production-board",
      fromSide: "right",
      toSide: "left",
      toEnd: "arrow",
      label: "execution readiness"
    },
    {
      id: "home-notes",
      fromNode: "home",
      toNode: "notes",
      fromSide: "bottom",
      toSide: "top",
      toEnd: "arrow",
      label: "manual notes"
    },
    {
      id: "home-agent-handoff",
      fromNode: "home",
      toNode: "agent-handoff",
      fromSide: "right",
      toSide: "left",
      toEnd: "arrow",
      label: "agent handoff"
    },
    {
      id: "shots-agent-handoff",
      fromNode: "shot-index",
      toNode: "agent-handoff",
      fromSide: "bottom",
      toSide: "top",
      toEnd: "arrow",
      label: "copy context"
    },
    {
      id: "review-base",
      fromNode: "review-dashboard",
      toNode: "workflow-base",
      fromSide: "right",
      toSide: "left",
      toEnd: "arrow",
      label: "query"
    },
    {
      id: "shots-base",
      fromNode: "shot-index",
      toNode: "shots-base",
      fromSide: "right",
      toSide: "left",
      toEnd: "arrow",
      label: "query"
    },
    {
      id: "production-base",
      fromNode: "production-board",
      toNode: "production-base",
      fromSide: "right",
      toSide: "left",
      toEnd: "arrow",
      label: "query"
    },
    {
      id: "workflow-map",
      fromNode: "workflow-base",
      toNode: "workflow-map",
      fromSide: "right",
      toSide: "left",
      toEnd: "arrow",
      label: "step graph"
    },
    {
      id: "shot-pipeline",
      fromNode: "shots-base",
      toNode: "shot-pipeline",
      fromSide: "right",
      toSide: "left",
      toEnd: "arrow",
      label: "shot graph"
    }
  ];

  return { vaultPath: "Canvas/Review Map.canvas", content: canvasJson({ nodes, edges }) };
}
