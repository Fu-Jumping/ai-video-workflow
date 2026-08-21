import type {
  LibTvAccount,
  LibTvAccountInfo,
  LibTvAccountListResult,
  LibTvGenerationProgress,
  LibTvGenerationResult,
  LibTvModel,
  LibTvNodeDetail,
  LibTvNodeType,
  LibTvProjectDetailResult,
  LibTvProjectMeta,
  LibTvProjectNodeSummary,
  LibTvToolSpec,
  LibTvUploadResult
} from "./types.js";

export interface LibTvCreateNodeInput {
  projectUuid: string;
  name: string;
  type: LibTvNodeType | string;
  prompt?: string;
  params?: Record<string, unknown>;
  data?: Record<string, unknown>;
  groupNodeKey?: string;
  left?: string[];
  right?: string[];
  x?: number;
  y?: number;
  run?: boolean;
}

export interface LibTvUpdateNodeInput {
  projectUuid: string;
  nodeKey: string;
  name?: string;
  prompt?: string;
  params?: Record<string, unknown>;
  data?: Record<string, unknown>;
  leftAdd?: string[];
  leftRemove?: string[];
  rightAdd?: string[];
  rightRemove?: string[];
  run?: boolean;
}

export interface LibTvCreateGroupInput {
  projectUuid: string;
  name: string;
  parentGroupNodeKey?: string;
  nodeKeys?: string[];
  run?: boolean;
}

export interface LibTvUploadInput {
  projectUuid: string;
  nodeName: string;
  filePath: string;
  kind: "image" | "video" | "audio";
  groupNodeKey?: string;
  x?: number;
  y?: number;
}

export interface LibTvGenerationInput {
  projectUuid: string;
  nodeId: string;
  modelKey: string;
  prompt: string;
  params?: Record<string, unknown>;
}

export interface LibTvBackend {
  getAccountInfo(): Promise<LibTvAccountInfo>;
  listAccounts(): Promise<LibTvAccountListResult>;
  activateAccount(accountId: number | string): Promise<LibTvAccountListResult>;
  listProjects(): Promise<LibTvProjectMeta[]>;
  getProjectDetail(projectUuid: string): Promise<LibTvProjectDetailResult>;
  createProject(input: { name: string; description?: string; coverUrl?: string; teamId?: number; folderId?: number }): Promise<LibTvProjectMeta>;
  updateProject(projectUuid: string, input: { name?: string; description?: string; coverUrl?: string; folderId?: number }): Promise<LibTvProjectMeta>;
  deleteProject(projectUuid: string, teamId?: number): Promise<void>;
  listNodes(projectUuid: string, groupNodeKey?: string): Promise<LibTvProjectNodeSummary[]>;
  getNode(projectUuid: string, ref: string): Promise<LibTvNodeDetail | null>;
  createNode(input: LibTvCreateNodeInput): Promise<LibTvNodeDetail>;
  updateNode(input: LibTvUpdateNodeInput): Promise<LibTvNodeDetail>;
  deleteNode(projectUuid: string, nodeKey: string): Promise<void>;
  listGroups(projectUuid: string, parentGroupNodeKey?: string): Promise<LibTvProjectNodeSummary[]>;
  createGroup(input: LibTvCreateGroupInput): Promise<LibTvProjectNodeSummary>;
  uploadAsset(input: LibTvUploadInput): Promise<LibTvUploadResult>;
  createGeneration(input: LibTvGenerationInput): Promise<LibTvGenerationResult>;
  getGenerationProgress(taskIds: string[]): Promise<LibTvGenerationProgress[]>;
  listModels(nodeType?: string): Promise<LibTvModel[]>;
  getModelSchema(ref: string): Promise<LibTvToolSpec | null>;
}
