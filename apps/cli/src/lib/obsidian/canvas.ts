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
  const shotIds = [...new Set(sourceFiles.map((file) => file.shotId).filter((shotId): shotId is string => Boolean(shotId)))].sort();
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
