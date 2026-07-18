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
  return `画布/镜头审阅/${shotId}.canvas`;
}

export function renderWorkflowCanvas(sourceFiles: ObsidianSourceFile[]): ObsidianGeneratedFile {
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];
  const firstNodeByStep = new Map<number, string>();

  for (let step = 1; step <= 6; step += 1) {
    nodes.push({
      id: `step-${step}-group`,
      type: "group",
      label: `步骤 ${step}`,
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

  const labels = ["设定上下文", "拆成镜头", "生成图片提示词", "供给视频提示词", "跟踪执行"];
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

  return { vaultPath: "画布/流程图.canvas", content: canvasJson({ nodes, edges }) };
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
          label: "下一步"
        });
        nodeIndex += 1;
      }
      previousNodeId = nodeId;
    });
  });

  return { vaultPath: "画布/镜头流水线.canvas", content: canvasJson({ nodes, edges }) };
}

export function renderShotReviewCanvases(sourceFiles: ObsidianSourceFile[]): ObsidianGeneratedFile[] {
  return uniqueShotIds(sourceFiles).map((shotId) => {
    const nodes: CanvasNode[] = [
      {
        id: "shot-review",
        type: "file",
        file: `镜头/${shotId}.md`,
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
      missingText: `${shotId} 缺少分镜脚本`,
      x: 420,
      y: -150,
      color: "3",
      edgeLabel: "审阅起点 / 画面"
    });
    previousNodeId = addSourceOrMissingNode({
      nodes,
      edges,
      nodeId: "image-prompt",
      previousNodeId,
      sourceFile: imagePrompt,
      missingText: `${shotId} 缺少图片提示词`,
      x: 840,
      y: -150,
      color: "4",
      edgeLabel: "图片提示词"
    });
    previousNodeId = addSourceOrMissingNode({
      nodes,
      edges,
      nodeId: "video-prompt",
      previousNodeId,
      sourceFile: videoPrompt,
      missingText: `${shotId} 缺少视频提示词`,
      x: 1260,
      y: -150,
      color: "5",
      edgeLabel: "视频提示词"
    });

    nodes.push(
      {
        id: "production-board",
        type: "file",
        file: "03_制作看板.md",
        x: 1680,
        y: -150,
        width: 320,
        height: 110,
        color: "6"
      },
      {
        id: "notes",
        type: "file",
        file: "笔记/README.md",
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
        label: "执行"
      },
      {
        id: "shot-notes",
        fromNode: "shot-review",
        toNode: "notes",
        fromSide: "bottom",
        toSide: "left",
        toEnd: "arrow",
        label: "笔记"
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
      file: "00_项目首页.md",
      x: 0,
      y: 0,
      width: 300,
      height: 100,
      color: "1"
    },
    {
      id: "review-dashboard",
      type: "file",
      file: "01_审阅总览.md",
      x: 420,
      y: -160,
      width: 300,
      height: 100,
      color: "2"
    },
    {
      id: "shot-index",
      type: "file",
      file: "02_镜头索引.md",
      x: 420,
      y: 0,
      width: 300,
      height: 100,
      color: "3"
    },
    {
      id: "production-board",
      type: "file",
      file: "03_制作看板.md",
      x: 420,
      y: 160,
      width: 300,
      height: 100,
      color: "4"
    },
    {
      id: "agent-handoff",
      type: "file",
      file: "04_智能体交接.md",
      x: 420,
      y: 320,
      width: 300,
      height: 100,
      color: "6"
    },
    {
      id: "notes",
      type: "file",
      file: "笔记/README.md",
      x: 0,
      y: 240,
      width: 300,
      height: 100,
      color: "5"
    },
    {
      id: "workflow-base",
      type: "file",
      file: "数据表/流程文件.base",
      x: 840,
      y: -220,
      width: 320,
      height: 90,
      color: "2"
    },
    {
      id: "shots-base",
      type: "file",
      file: "数据表/镜头.base",
      x: 840,
      y: 0,
      width: 320,
      height: 90,
      color: "3"
    },
    {
      id: "production-base",
      type: "file",
      file: "数据表/制作状态.base",
      x: 840,
      y: 220,
      width: 320,
      height: 90,
      color: "4"
    },
    {
      id: "workflow-map",
      type: "file",
      file: "画布/流程图.canvas",
      x: 1240,
      y: -120,
      width: 320,
      height: 90,
      color: "6"
    },
    {
      id: "shot-pipeline",
      type: "file",
      file: "画布/镜头流水线.canvas",
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
      label: "审阅队列"
    },
    {
      id: "home-shots",
      fromNode: "home",
      toNode: "shot-index",
      fromSide: "right",
      toSide: "left",
      toEnd: "arrow",
      label: "镜头进度"
    },
    {
      id: "home-production",
      fromNode: "home",
      toNode: "production-board",
      fromSide: "right",
      toSide: "left",
      toEnd: "arrow",
      label: "执行就绪"
    },
    {
      id: "home-notes",
      fromNode: "home",
      toNode: "notes",
      fromSide: "bottom",
      toSide: "top",
      toEnd: "arrow",
      label: "手写笔记"
    },
    {
      id: "home-agent-handoff",
      fromNode: "home",
      toNode: "agent-handoff",
      fromSide: "right",
      toSide: "left",
      toEnd: "arrow",
      label: "智能体交接"
    },
    {
      id: "shots-agent-handoff",
      fromNode: "shot-index",
      toNode: "agent-handoff",
      fromSide: "bottom",
      toSide: "top",
      toEnd: "arrow",
      label: "复制上下文"
    },
    {
      id: "review-base",
      fromNode: "review-dashboard",
      toNode: "workflow-base",
      fromSide: "right",
      toSide: "left",
      toEnd: "arrow",
      label: "查询"
    },
    {
      id: "shots-base",
      fromNode: "shot-index",
      toNode: "shots-base",
      fromSide: "right",
      toSide: "left",
      toEnd: "arrow",
      label: "查询"
    },
    {
      id: "production-base",
      fromNode: "production-board",
      toNode: "production-base",
      fromSide: "right",
      toSide: "left",
      toEnd: "arrow",
      label: "查询"
    },
    {
      id: "workflow-map",
      fromNode: "workflow-base",
      toNode: "workflow-map",
      fromSide: "right",
      toSide: "left",
      toEnd: "arrow",
      label: "步骤图"
    },
    {
      id: "shot-pipeline",
      fromNode: "shots-base",
      toNode: "shot-pipeline",
      fromSide: "right",
      toSide: "left",
      toEnd: "arrow",
      label: "镜头图"
    }
  ];

  return { vaultPath: "画布/审阅地图.canvas", content: canvasJson({ nodes, edges }) };
}
