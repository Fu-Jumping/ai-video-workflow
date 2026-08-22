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

export interface LibTvState {
  version: 1;
  projectUuid: string;
  anchors: Array<LibTvAssetRef & { nodeId: string; fileSha256: string; uploadedAt: string; cdnUrl?: string }>;
  keyframes: Array<LibTvKeyframeRef & { nodeId: string; status: string; localOutput?: string; cdnUrl?: string }>;
  videos: Array<LibTvVideoRef & { nodeId: string; status: string; localOutput?: string; cdnUrl?: string }>;
  updatedAt: string;
}

export interface LibTvApplyOptions {
  dryRun?: boolean;
  only?: Array<"anchors" | "keyframes" | "videos">;
}

export interface LibTvStatusResult {
  projectUuid: string;
  anchors: Array<{ token: string; local: boolean; remote: boolean; nodeId?: string }>;
  keyframes: Array<{ id: string; remote: boolean; nodeId?: string; status?: string }>;
  videos: Array<{ id: string; remote: boolean; nodeId?: string; status?: string }>;
}

export interface LibTvVerifyIssue {
  code: string;
  message: string;
  path?: string;
}
