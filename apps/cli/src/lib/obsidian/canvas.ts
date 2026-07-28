import { workflowVaultPath } from "./markdown.js";
import { notesIndexPath } from "./routes.js";
import type { ObsidianGeneratedFile, ObsidianSourceFile } from "./types.js";
import { formatReferenceAssets } from "../reference-assets.js";
import type { ReferenceAssetToken } from "../reference-assets.js";

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
  0: "1",
  1: "1",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6"
};

const layout = {
  workflow: {
    columnGap: 680,
    groupWidth: 560,
    groupHeight: 920,
    fileXOffset: 50,
    fileYOffset: 100,
    fileRowGap: 210,
    fileWidth: 480,
    fileHeight: 170
  },
  shotPipeline: {
    rowGap: 660,
    groupWidth: 2040,
    groupHeight: 540,
    fileXOffset: 70,
    fileYOffset: 120,
    fileColumnGap: 660,
    fileWidth: 520,
    fileHeight: 210
  },
  shotReview: {
    mainWidth: 500,
    mainHeight: 200,
    fileWidth: 520,
    fileHeight: 250,
    referenceWidth: 680,
    referenceHeight: 220,
    columnGap: 800,
    sourceY: -260,
    notesY: 300,
    referenceY: 320
  },
  reviewMap: {
    columnGap: 700,
    rowGap: 260,
    fileWidth: 460,
    fileHeight: 170,
    baseWidth: 500,
    baseHeight: 160
  }
};

function canvasJson(canvas: CanvasFile): string {
  return `${JSON.stringify(canvas, null, 2)}\n`;
}

function uniqueShotIds(sourceFiles: ObsidianSourceFile[]): string[] {
  return [...new Set(sourceFiles.map((file) => file.shotId).filter((shotId): shotId is string => Boolean(shotId)))].sort();
}

function shotDisplayName(sourceFiles: ObsidianSourceFile[], shotId: string): string {
  const shotFiles = sourceFiles.filter((file) => file.shotId === shotId);
  const storyboard = shotFiles.find((file) => file.sourceKind === "storyboard");
  const title = storyboard?.headingTitle ?? storyboard?.title ?? shotFiles[0]?.headingTitle ?? shotFiles[0]?.title;
  return title?.trim() || shotId;
}

function shotFileForKind(sourceFiles: ObsidianSourceFile[], shotId: string, sourceKind: ObsidianSourceFile["sourceKind"]): ObsidianSourceFile | undefined {
  return sourceFiles.find((file) => file.shotId === shotId && file.sourceKind === sourceKind);
}

function shotFilesForKind(sourceFiles: ObsidianSourceFile[], shotId: string, sourceKind: ObsidianSourceFile["sourceKind"]): ObsidianSourceFile[] {
  return sourceFiles.filter((file) => file.shotId === shotId && file.sourceKind === sourceKind);
}

function referenceAssetsForFiles(sourceFiles: ObsidianSourceFile[]): ReferenceAssetToken[] {
  const seen = new Set<string>();
  const assets: ReferenceAssetToken[] = [];
  for (const sourceFile of sourceFiles) {
    for (const asset of sourceFile.referenceAssets ?? []) {
      if (seen.has(asset.token)) {
        continue;
      }
      seen.add(asset.token);
      assets.push(asset);
    }
  }
  return assets;
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
      width: layout.shotReview.fileWidth,
      height: layout.shotReview.fileHeight,
      color
    });
  } else {
    nodes.push({
      id: nodeId,
      type: "text",
      text: missingText,
      x,
      y,
      width: layout.shotReview.fileWidth,
      height: layout.shotReview.fileHeight,
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
  const steps = [...new Set(sourceFiles.map((file) => file.step))].sort((left, right) => left - right);
  const stepIndex = new Map(steps.map((step, index) => [step, index]));

  for (const step of steps) {
    const columnIndex = stepIndex.get(step) ?? 0;
    nodes.push({
      id: `step-${step}-group`,
      type: "group",
      label: `步骤 ${step}`,
      x: columnIndex * layout.workflow.columnGap,
      y: 0,
      width: layout.workflow.groupWidth,
      height: layout.workflow.groupHeight,
      color: stepColors[step]
    });
  }

  sourceFiles.forEach((sourceFile, index) => {
    const nodeId = `file-${index}`;
    const sameStepIndex = sourceFiles.filter((file, fileIndex) => file.step === sourceFile.step && fileIndex < index).length;
    const columnIndex = stepIndex.get(sourceFile.step) ?? 0;
    nodes.push({
      id: nodeId,
      type: "file",
      file: workflowVaultPath(sourceFile),
      x: columnIndex * layout.workflow.columnGap + layout.workflow.fileXOffset,
      y: layout.workflow.fileYOffset + sameStepIndex * layout.workflow.fileRowGap,
      width: layout.workflow.fileWidth,
      height: layout.workflow.fileHeight,
      color: stepColors[sourceFile.step]
    });
    if (!firstNodeByStep.has(sourceFile.step)) {
      firstNodeByStep.set(sourceFile.step, nodeId);
    }
  });

  const labels = new Map<number, string>([
    [0, "交接创作简报"],
    [1, "设定上下文"],
    [2, "拆成镜头"],
    [3, "生成图片提示词"],
    [4, "供给视频提示词"],
    [5, "跟踪执行"]
  ]);
  for (let index = 0; index < steps.length - 1; index += 1) {
    const step = steps[index];
    const nextStep = steps[index + 1];
    const fromNode = firstNodeByStep.get(step);
    const toNode = firstNodeByStep.get(nextStep);
    if (fromNode && toNode) {
      edges.push({
        id: `edge-step-${step}-${nextStep}`,
        fromNode,
        toNode,
        fromSide: "right",
        toSide: "left",
        toEnd: "arrow",
        label: labels.get(step) ?? "下一步"
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
      label: shotDisplayName(sourceFiles, shotId),
      x: 0,
      y: shotIndex * layout.shotPipeline.rowGap,
      width: layout.shotPipeline.groupWidth,
      height: layout.shotPipeline.groupHeight,
      color: "5"
    });
    let previousNodeId: string | undefined;
    shotFiles.forEach((sourceFile, fileIndex) => {
      const nodeId = `shot-${shotIndex}-file-${fileIndex}`;
      nodes.push({
        id: nodeId,
        type: "file",
        file: workflowVaultPath(sourceFile),
        x: layout.shotPipeline.fileXOffset + fileIndex * layout.shotPipeline.fileColumnGap,
        y: shotIndex * layout.shotPipeline.rowGap + layout.shotPipeline.fileYOffset,
        width: layout.shotPipeline.fileWidth,
        height: layout.shotPipeline.fileHeight,
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
    const shotFiles = sourceFiles.filter((file) => file.shotId === shotId);
    const referenceAssets = formatReferenceAssets(referenceAssetsForFiles(shotFiles));
    const nodes: CanvasNode[] = [
      {
        id: "shot-review",
        type: "file",
        file: `镜头/${shotId}.md`,
        x: 0,
        y: 0,
        width: layout.shotReview.mainWidth,
        height: layout.shotReview.mainHeight,
        color: "1"
      }
    ];
    const edges: CanvasEdge[] = [];
    const storyboard = shotFileForKind(sourceFiles, shotId, "storyboard");
    const imagePrompts = shotFilesForKind(sourceFiles, shotId, "image-prompt");
    const videoPrompt = shotFileForKind(sourceFiles, shotId, "video-prompt");

    let previousNodeId = addSourceOrMissingNode({
      nodes,
      edges,
      nodeId: "storyboard",
      previousNodeId: "shot-review",
      sourceFile: storyboard,
      missingText: `${shotId} 缺少分镜脚本`,
      x: layout.shotReview.columnGap,
      y: layout.shotReview.sourceY,
      color: "3",
      edgeLabel: "审阅起点 / 画面"
    });
    if (imagePrompts.length === 0) {
      previousNodeId = addSourceOrMissingNode({
        nodes,
        edges,
        nodeId: "image-prompt-missing",
        previousNodeId,
        sourceFile: undefined,
        missingText: `${shotId} 缺少图片提示词`,
        x: layout.shotReview.columnGap * 2,
        y: layout.shotReview.sourceY,
        color: "4",
        edgeLabel: "图片提示词"
      });
    } else {
      imagePrompts.forEach((imagePrompt, index) => {
        previousNodeId = addSourceOrMissingNode({
          nodes,
          edges,
          nodeId: index === 0 ? "image-prompt" : `image-prompt-${index + 1}`,
          previousNodeId,
          sourceFile: imagePrompt,
          missingText: `${shotId} 缺少关键帧 ${index + 1}`,
          x: layout.shotReview.columnGap * (2 + index),
          y: layout.shotReview.sourceY,
          color: "4",
          edgeLabel: `关键帧 ${index + 1}`
        });
      });
    }
    const videoColumn = 2 + Math.max(imagePrompts.length, 1);
    previousNodeId = addSourceOrMissingNode({
      nodes,
      edges,
      nodeId: "video-prompt",
      previousNodeId,
      sourceFile: videoPrompt,
      missingText: `${shotId} 缺少视频提示词`,
      x: layout.shotReview.columnGap * (videoColumn + 1),
      y: layout.shotReview.sourceY,
      color: "5",
      edgeLabel: "视频提示词"
    });

    nodes.push(
      {
        id: "production-board",
        type: "file",
        file: "03_制作看板.md",
        x: layout.shotReview.columnGap * (videoColumn + 2),
        y: layout.shotReview.sourceY,
        width: layout.shotReview.fileWidth,
        height: layout.shotReview.fileHeight,
        color: "6"
      },
      {
        id: "notes",
        type: "file",
        file: notesIndexPath,
        x: layout.shotReview.columnGap,
        y: layout.shotReview.notesY,
        width: layout.shotReview.fileWidth,
        height: layout.shotReview.fileHeight,
        color: "5"
      },
      {
        id: "reference-assets",
        type: "text",
        text: `参考资产\n${referenceAssets}`,
        x: layout.shotReview.columnGap * 2,
        y: layout.shotReview.referenceY,
        width: layout.shotReview.referenceWidth,
        height: layout.shotReview.referenceHeight,
        color: "4"
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
      },
      {
        id: "shot-reference-assets",
        fromNode: "shot-review",
        toNode: "reference-assets",
        fromSide: "bottom",
        toSide: "left",
        toEnd: "arrow",
        label: "参考资产"
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
      width: layout.reviewMap.fileWidth,
      height: layout.reviewMap.fileHeight,
      color: "1"
    },
    {
      id: "review-dashboard",
      type: "file",
      file: "01_审阅总览.md",
      x: layout.reviewMap.columnGap,
      y: -layout.reviewMap.rowGap,
      width: layout.reviewMap.fileWidth,
      height: layout.reviewMap.fileHeight,
      color: "2"
    },
    {
      id: "shot-index",
      type: "file",
      file: "02_镜头索引.md",
      x: layout.reviewMap.columnGap,
      y: 0,
      width: layout.reviewMap.fileWidth,
      height: layout.reviewMap.fileHeight,
      color: "3"
    },
    {
      id: "production-board",
      type: "file",
      file: "03_制作看板.md",
      x: layout.reviewMap.columnGap,
      y: layout.reviewMap.rowGap,
      width: layout.reviewMap.fileWidth,
      height: layout.reviewMap.fileHeight,
      color: "4"
    },
    {
      id: "agent-handoff",
      type: "file",
      file: "04_智能体交接.md",
      x: layout.reviewMap.columnGap,
      y: layout.reviewMap.rowGap * 2,
      width: layout.reviewMap.fileWidth,
      height: layout.reviewMap.fileHeight,
      color: "6"
    },
    {
      id: "notes",
      type: "file",
      file: notesIndexPath,
      x: 0,
      y: layout.reviewMap.rowGap + 120,
      width: layout.reviewMap.fileWidth,
      height: layout.reviewMap.fileHeight,
      color: "5"
    },
    {
      id: "workflow-base",
      type: "file",
      file: "数据表/流程文件.base",
      x: layout.reviewMap.columnGap * 2,
      y: -layout.reviewMap.rowGap - 80,
      width: layout.reviewMap.baseWidth,
      height: layout.reviewMap.baseHeight,
      color: "2"
    },
    {
      id: "shots-base",
      type: "file",
      file: "数据表/镜头.base",
      x: layout.reviewMap.columnGap * 2,
      y: 0,
      width: layout.reviewMap.baseWidth,
      height: layout.reviewMap.baseHeight,
      color: "3"
    },
    {
      id: "production-base",
      type: "file",
      file: "数据表/制作状态.base",
      x: layout.reviewMap.columnGap * 2,
      y: layout.reviewMap.rowGap + 80,
      width: layout.reviewMap.baseWidth,
      height: layout.reviewMap.baseHeight,
      color: "4"
    },
    {
      id: "workflow-map",
      type: "file",
      file: "画布/流程图.canvas",
      x: layout.reviewMap.columnGap * 3,
      y: -layout.reviewMap.rowGap / 2,
      width: layout.reviewMap.baseWidth,
      height: layout.reviewMap.baseHeight,
      color: "6"
    },
    {
      id: "shot-pipeline",
      type: "file",
      file: "画布/镜头流水线.canvas",
      x: layout.reviewMap.columnGap * 3,
      y: layout.reviewMap.rowGap / 2,
      width: layout.reviewMap.baseWidth,
      height: layout.reviewMap.baseHeight,
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
