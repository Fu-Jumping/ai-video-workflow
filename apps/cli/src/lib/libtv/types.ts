export type LibTvNodeType = "text" | "image" | "video" | "audio" | "group" | "script" | "video-clip";

export interface LibTvCredentials {
  usertoken: string;
  useruuid: string;
  webid: string;
  savedAt?: string;
  activeAccountId?: number;
}

export interface LibTvProjectBinding {
  projectUuid?: string;
  workspaceId?: number | string;
  teamId?: number | string;
  groupNodeKey?: string;
}

export interface LibTvAccountMember {
  memberName?: string;
  accountLevel?: number;
  effective?: boolean;
}

export interface LibTvAccount {
  accountId: number;
  accountName: string;
  accountType?: number;
  ownerType?: number;
  ownerUuid?: string;
  isActive?: boolean;
  owner?: boolean;
  source?: unknown;
  memberAccount?: LibTvAccountMember;
}

export interface LibTvAccountInfo {
  user: {
    uuid: string;
    id: number;
    nickname: string;
  };
  activeAccount: LibTvAccount;
  teamId?: number | null;
  accountsCount?: number;
}

export interface LibTvAccountListResult {
  accounts: LibTvAccount[];
}

export interface LibTvProjectMeta {
  id: number;
  uuid: string;
  name: string;
  visibility?: number;
  ownerId?: number;
  createdAtMs?: number;
  updatedAtMs?: number;
  folderId?: number;
  projectSpaceId?: number;
  projectType?: number;
}

export interface LibTvProjectListResult {
  projectMetaList: LibTvProjectMeta[];
}

export interface LibTvWorkspace {
  id: number | string;
  name: string;
  description?: string;
  parentFolderId?: number;
  spaceType?: number;
  depth?: number;
  coverUrl?: string;
  ownerId?: number;
  teamId?: number;
  fileCnt?: number;
  createAt?: string;
  updateAt?: string;
  isFolder?: boolean;
  creatorNickname?: string;
}

export interface LibTvWorkspaceListResult {
  folders: LibTvWorkspace[];
  total?: number;
}

export interface LibTvProjectDetailResult {
  projectUuid: string;
  projectMeta?: LibTvProjectMeta;
  nodes: LibTvProjectNodeSummary[];
  edges: LibTvProjectEdge[];
}

export interface LibTvProjectNodeSummary {
  id: string;
  name: string;
  type: LibTvNodeType | string;
  position?: { x: number; y: number };
  width?: number;
  height?: number;
  data?: Record<string, unknown>;
}

export interface LibTvProjectEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface LibTvNodeData {
  type?: string;
  name?: string;
  url?: string[];
  alt?: string;
  action?: string;
  generatorType?: string;
  params?: Record<string, unknown>;
  taskInfo?: {
    taskId?: string;
    loading?: boolean;
    status?: number;
    progressPercent?: number;
    ownerUserId?: string;
  };
  isStale?: boolean;
  protectionType?: string;
  contentWidth?: number;
  contentHeight?: number;
  resourceMeta?: {
    items?: Array<{ kind?: string; width?: number; height?: number; url?: string }>;
  };
  [key: string]: unknown;
}

export interface LibTvNodeDetail {
  nodeKey: string;
  data: LibTvNodeData;
  nodeType: LibTvNodeType | string;
  name: string;
}

export interface LibTvNodeListResult {
  projectUuid: string;
  scope?: string;
  count?: number;
  nodes: LibTvProjectNodeSummary[];
}

export interface LibTvGroupListResult {
  projectUuid: string;
  scope?: string;
  count?: number;
  groups: LibTvProjectNodeSummary[];
}

export interface LibTvModel {
  modelKey: string;
  modelName: string;
  description?: string;
  prefix?: unknown[];
  labels?: unknown[];
  icon?: string;
  estimatedTime?: string;
  supportModality?: string;
  [key: string]: unknown;
}

export interface LibTvModelListResult {
  nodeType?: string;
  query?: string;
  matchKind?: string;
  matches: LibTvModel[];
}

export interface LibTvToolSpec {
  modelKey?: string;
  modelName?: string;
  toolKey?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LibTvUploadResult {
  node?: LibTvNodeDetail;
  nodeKey?: string;
  resourceMeta?: LibTvNodeData["resourceMeta"];
  url?: string;
  [key: string]: unknown;
}

export interface LibTvGenerationResult {
  taskId?: string;
  nodeId?: string;
  status?: number;
  [key: string]: unknown;
}

export interface LibTvGenerationProgress {
  taskId?: string;
  status?: number;
  progressPercent?: number;
  loading?: boolean;
  taskResult?: unknown;
  errorMessage?: string;
  [key: string]: unknown;
}

export type LibTvAssetKind = "character-triview" | "scene-image";

export interface LibTvAssetRef {
  token: string;
  name: string;
  kind: LibTvAssetKind;
  localPath?: string;
  nodeId?: string;
  uploaded?: boolean;
}

export interface LibTvKeyframeRef {
  groupId: string;
  shotId: string;
  keyframeId: string;
  sourcePath: string;
  prompt: string;
  referenceTokens: string[];
  modelKey?: string;
  params?: Record<string, unknown>;
  nodeId?: string;
  status?: "planned" | "pending-approval" | "approved" | "generated" | "failed";
}

export interface LibTvVideoRef {
  groupId: string;
  shotId: string;
  sourcePath: string;
  prompt: string;
  referenceTokens: string[];
  keyframePaths: string[];
  modelKey?: string;
  orderTokens?: string[];
  params?: Record<string, unknown>;
  nodeId?: string;
  status?: "planned" | "pending-approval" | "generated" | "failed";
}

export interface LibTvPlan {
  projectUuid?: string;
  anchors: LibTvAssetRef[];
  keyframes: LibTvKeyframeRef[];
  videos: LibTvVideoRef[];
  groups: string[];
}

export type LibTvImageReviewDecision = "direct" | "refine" | "regenerate";
export type LibTvRefineBase = "first" | "current";

export interface LibTvRefineRound {
  round: number;
  base: LibTvRefineBase;
  baseNodeId: string;
  instruction: string;
  refineNodeId?: string;
  cdnUrl?: string;
  localOutput?: string;
  status: "refining" | "generated" | "failed";
  taskId?: string;
  progressPercent?: number;
  generationError?: string;
  attempts?: number;
}

export interface LibTvAnchorState extends LibTvAssetRef {
  nodeId: string;
  fileSha256: string;
  uploadedAt: string;
  cdnUrl?: string;
  reviewDecision?: LibTvImageReviewDecision;
  feedback?: string;
  finalNodeId?: string;
  refineRounds?: LibTvRefineRound[];
}

/**
 * 三类失败态：远端状态未知、远端明确失败、生成成功但本地保存失败。
 * 与素材记录（media-records.ts）的 failureClass 保持同一套取值，便于跨模块对齐。
 */
export type LibTvFailureClass = "remote-unknown" | "remote-failed" | "local-save-failed";

/** 下载用的最小 fetch 形状；默认用全局 fetch，测试可注入，避免真实网络访问。 */
export interface LibTvFetchResponseLike {
  ok: boolean;
  status?: number;
  statusText?: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type LibTvFetchLike = (url: string) => Promise<LibTvFetchResponseLike>;

export interface LibTvKeyframeState extends LibTvKeyframeRef {
  nodeId: string;
  status: string;
  localOutput?: string;
  cdnUrl?: string;
  reviewDecision?: LibTvImageReviewDecision;
  feedback?: string;
  finalNodeId?: string;
  refineRounds?: LibTvRefineRound[];
  taskId?: string;
  progressPercent?: number;
  generationError?: string;
  /** 失败类型：remote-unknown / remote-failed / local-save-failed。成功时清空。 */
  failureClass?: LibTvFailureClass;
  /** 只描述本地保存（下载）失败的原因，与 generationError 分开记。 */
  downloadError?: string;
  attempts?: number;
}

export interface LibTvVideoState extends LibTvVideoRef {
  nodeId: string;
  status: string;
  localOutput?: string;
  cdnUrl?: string;
  taskId?: string;
  progressPercent?: number;
  generationError?: string;
  /** 失败类型：remote-unknown / remote-failed / local-save-failed。成功时清空。 */
  failureClass?: LibTvFailureClass;
  /** 只描述本地保存（下载）失败的原因，与 generationError 分开记。 */
  downloadError?: string;
  attempts?: number;
}

export interface LibTvState {
  version: 1;
  projectUuid: string;
  anchors: LibTvAnchorState[];
  keyframes: LibTvKeyframeState[];
  videos: LibTvVideoState[];
  updatedAt: string;
}

export interface LibTvApplyOptions {
  dryRun?: boolean;
  only?: Array<"anchors" | "keyframes" | "videos">;
  allowGeneration?: boolean;
  pollIntervalMs?: number;
  timeoutMs?: number;
  retryIds?: string[];
  /** 下载用的 fetch；默认全局 fetch，测试注入以免真实网络访问。 */
  fetchImpl?: LibTvFetchLike;
}

export interface LibTvApplyFailure {
  id: string;
  reason: string;
  message: string;
  nodeId?: string;
  /** 三类失败态；只有失败项才有。 */
  failureClass?: LibTvFailureClass;
}

export interface LibTvApplySectionSummary {
  total: number;
  skipped: number;
  generated: number;
  /** 远端明确失败（状态写 failed）。 */
  failed: number;
  /** 远端状态未知（状态写 unknown），不算失败、不消耗 --retry。 */
  unknown: number;
  failures: LibTvApplyFailure[];
}

export interface LibTvApplySummary {
  dryRun: boolean;
  allowGeneration: boolean;
  keyframes: LibTvApplySectionSummary;
  videos: LibTvApplySectionSummary;
}

export interface LibTvStatusResult {
  projectUuid: string;
  anchors: Array<{ token: string; local: boolean; remote: boolean; nodeId?: string; reviewDecision?: LibTvImageReviewDecision; finalNodeId?: string; refineRounds?: number }>;
  keyframes: Array<{ id: string; remote: boolean; nodeId?: string; status?: string; reviewDecision?: LibTvImageReviewDecision; finalNodeId?: string; refineRounds?: number; taskId?: string; progressPercent?: number; generationError?: string; failureClass?: LibTvFailureClass; downloadError?: string; localOutput?: string; attempts?: number }>;
  videos: Array<{ id: string; remote: boolean; nodeId?: string; status?: string; taskId?: string; progressPercent?: number; generationError?: string; failureClass?: LibTvFailureClass; downloadError?: string; localOutput?: string; attempts?: number }>;
}

/** 只补下载、不重新生成。 */
export interface LibTvRedownloadOptions {
  /** 只补这些 id（关键帧 group/shot/keyframe、视频 group/shot）；不传=全部待补。 */
  ids?: string[];
  /** 只补关键帧或视频。 */
  only?: Array<"keyframes" | "videos">;
  /** 默认全局 fetch；测试注入以免真实网络访问。 */
  fetchImpl?: LibTvFetchLike;
}

export interface LibTvRedownloadItem {
  id: string;
  kind: "keyframes" | "videos";
  /** 本次补下载动作的结果：saved / no-url / failed / skipped。 */
  outcome: "saved" | "no-url" | "failed" | "skipped";
  localOutput?: string;
  message?: string;
  /** 沿用原 taskId，用于证明补下载没有重新提交生成任务。 */
  taskId?: string;
  failureClass?: LibTvFailureClass;
}

export interface LibTvRedownloadSummary {
  /** 只补下载绝不触发真实生成；恒为 0，便于测试与审计断言。 */
  generationCalls: 0;
  saved: number;
  failed: number;
  skipped: number;
  items: LibTvRedownloadItem[];
}

export interface LibTvVerifyIssue {
  code: string;
  message: string;
  path?: string;
}
