import fs from "fs-extra";
import path from "node:path";
import type { LibTvBackend, LibTvCreateGroupInput, LibTvCreateNodeInput, LibTvGenerationInput, LibTvUpdateNodeInput, LibTvUploadInput } from "./backend.js";
import type {
  LibTvAccount,
  LibTvAccountInfo,
  LibTvAccountListResult,
  LibTvGenerationProgress,
  LibTvGenerationResult,
  LibTvModel,
  LibTvNodeDetail,
  LibTvProjectDetailResult,
  LibTvProjectEdge,
  LibTvProjectMeta,
  LibTvProjectNodeSummary,
  LibTvToolSpec,
  LibTvUploadResult,
  LibTvWorkspace,
  LibTvWorkspaceListResult
} from "./types.js";

let nextNodeSeq = 1;
let nextEdgeSeq = 1;
let nextProjectSeq = 1;

function makeNodeId(type: string): string {
  const prefix = type === "video" ? "v" : type === "group" ? "g" : "i";
  return `${prefix}-mock-${nextNodeSeq++}`;
}

function makeEdgeId(): string {
  return `e-mock-${nextEdgeSeq++}`;
}

export class MockLibTvBackend implements LibTvBackend {
  private projects = new Map<string, LibTvProjectDetailResult>();
  private projectMetas = new Map<string, LibTvProjectMeta>();
  private nodeData = new Map<string, LibTvNodeDetail>();
  private accounts: LibTvAccount[] = [
    { accountId: 1, accountName: "Mock User", isActive: true, owner: true, ownerUuid: "mock-user-uuid", memberAccount: { memberName: "Mock VIP", accountLevel: 7, effective: true } }
  ];
  private models: LibTvModel[] = [
    { modelKey: "mock-image-1", modelName: "Mock Image", supportModality: "image" },
    { modelKey: "mock-video-1", modelName: "Mock Video", supportModality: "video" },
    { modelKey: "star-video2", modelName: "Seedance 2.0 VIP", modelVendor: "star-video2", supportModality: "video" },
    { modelKey: "midjourney-v8.2", modelName: "Midjourney V8.2", supportModality: "image" }
  ];
  private tasks = new Map<string, { status: number; progressPercent: number }>();
  private workspaces = new Map<number | string, LibTvWorkspace>();

  constructor() {
    this.ensureProject({
      uuid: "mock-project",
      name: "Mock Project",
      id: 1,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      folderId: 0,
      projectSpaceId: 0,
      projectType: 0,
      ownerId: 1
    });
    this.workspaces.set("mock-workspace", {
      id: "mock-workspace",
      name: "Mock Workspace",
      teamId: 0,
      fileCnt: 0
    });
  }

  private ensureProject(meta: LibTvProjectMeta): LibTvProjectDetailResult {
    const existing = this.projects.get(meta.uuid);
    if (existing) {
      return existing;
    }
    const detail: LibTvProjectDetailResult = { projectUuid: meta.uuid, projectMeta: meta, nodes: [], edges: [] };
    this.projects.set(meta.uuid, detail);
    this.projectMetas.set(meta.uuid, meta);
    return detail;
  }

  async listWorkspaces(query: { page?: number; pageSize?: number; orderBy?: string; name?: string; teamId?: number } = {}): Promise<LibTvWorkspaceListResult> {
    let folders = [...this.workspaces.values()];
    if (query.name) {
      folders = folders.filter((folder) => folder.name.includes(query.name ?? ""));
    }
    return { folders, total: folders.length };
  }

  async getWorkspaceDetail(workspaceId: number | string): Promise<LibTvWorkspace> {
    const workspace = this.workspaces.get(String(workspaceId)) ?? this.workspaces.get(workspaceId);
    if (!workspace) throw new Error(`Mock workspace not found: ${workspaceId}`);
    return workspace;
  }

  async createWorkspace(input: { name: string; description?: string; coverUrl?: string; teamId?: number }): Promise<LibTvWorkspace> {
    const id = `mock-workspace-${nextProjectSeq++}`;
    const workspace: LibTvWorkspace = { id, name: input.name, description: input.description, coverUrl: input.coverUrl, teamId: input.teamId ?? 0, fileCnt: 0 };
    this.workspaces.set(id, workspace);
    return workspace;
  }

  async updateWorkspace(workspaceId: number | string, input: { name?: string; description?: string; coverUrl?: string; teamId?: number }): Promise<LibTvWorkspace> {
    const workspace = await this.getWorkspaceDetail(workspaceId);
    Object.assign(workspace, input);
    return workspace;
  }

  async getAccountInfo(): Promise<LibTvAccountInfo> {
    return {
      user: { uuid: "mock-user-uuid", id: 1, nickname: "Mock User" },
      activeAccount: this.accounts[0],
      teamId: null,
      accountsCount: this.accounts.length
    };
  }

  async listAccounts(): Promise<LibTvAccountListResult> {
    return { accounts: this.accounts };
  }

  async activateAccount(accountId: number | string): Promise<LibTvAccountListResult> {
    const id = Number(accountId);
    this.accounts = this.accounts.map((account) => ({ ...account, isActive: account.accountId === id }));
    return { accounts: this.accounts };
  }

  async sendLoginPhoneCode(_input: { phone: string; captcha?: string }): Promise<unknown> {
    return { ok: true, needCaptcha: false };
  }

  async loginByPhoneCode(input: { phone: string; code: string; captcha?: string }): Promise<unknown> {
    if (input.code === "123456") {
      return { ok: true, token: "mock-token", phone: input.phone };
    }
    throw new Error("验证码失败");
  }

  async listProjects(query?: { page?: number; pageSize?: number; orderBy?: string; name?: string; teamId?: number; workspaceId?: number | string }): Promise<LibTvProjectMeta[]> {
    let metas = [...this.projectMetas.values()];
    if (query?.name) {
      metas = metas.filter((meta) => meta.name.includes(query.name ?? ""));
    }
    if (query?.workspaceId !== undefined && Number(query.workspaceId) !== 0) {
      metas = metas.filter((meta) => meta.folderId === Number(query.workspaceId));
    }
    return metas;
  }

  async getProjectDetail(projectUuid: string): Promise<LibTvProjectDetailResult> {
    const detail = this.projects.get(projectUuid);
    if (!detail) {
      throw new Error(`Mock project not found: ${projectUuid}`);
    }
    return detail;
  }

  async createProject(input: { name: string; description?: string; coverUrl?: string; teamId?: number; folderId?: number; workspaceId?: number | string }): Promise<LibTvProjectMeta> {
    const uuid = `mock-project-${nextProjectSeq++}`;
    const folderId = Number(input.folderId ?? input.workspaceId ?? 0);
    const meta: LibTvProjectMeta = {
      id: nextProjectSeq,
      uuid,
      name: input.name,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      folderId,
      projectSpaceId: folderId,
      projectType: 0,
      ownerId: 1
    };
    this.ensureProject(meta);
    return meta;
  }

  async updateProject(projectUuid: string, input: { name?: string; description?: string; coverUrl?: string; folderId?: number }): Promise<LibTvProjectMeta> {
    const meta = this.projectMetas.get(projectUuid);
    if (!meta) throw new Error(`Mock project not found: ${projectUuid}`);
    Object.assign(meta, input);
    return meta;
  }

  async deleteProject(projectUuid: string, _teamId?: number): Promise<void> {
    this.projects.delete(projectUuid);
    this.projectMetas.delete(projectUuid);
  }

  async listNodes(projectUuid: string, _groupNodeKey?: string): Promise<LibTvProjectNodeSummary[]> {
    return (await this.getProjectDetail(projectUuid)).nodes;
  }

  async getNode(projectUuid: string, ref: string): Promise<LibTvNodeDetail | null> {
    const detail = await this.getProjectDetail(projectUuid);
    const summary = detail.nodes.find((node) => node.id === ref || node.name === ref);
    if (!summary) return null;
    return this.nodeData.get(summary.id) ?? { nodeKey: summary.id, nodeType: summary.type, name: summary.name, data: {} };
  }

  async createNode(input: LibTvCreateNodeInput): Promise<LibTvNodeDetail> {
    const detail = await this.getProjectDetail(input.projectUuid);
    if (detail.nodes.some((node) => node.name === input.name)) {
      throw new Error(`Mock node name already exists: ${input.name}`);
    }
    const id = makeNodeId(input.type);
    const summary: LibTvProjectNodeSummary = {
      id,
      name: input.name,
      type: input.type,
      position: { x: input.x ?? 0, y: input.y ?? 0 }
    };
    detail.nodes.push(summary);
    const data: Record<string, unknown> = {
      ...(input.data ?? {}),
      params: {
        ...(input.params ?? {}),
        ...(input.prompt !== undefined ? { prompt: input.prompt } : {})
      }
    };
    this.nodeData.set(id, { nodeKey: id, nodeType: input.type, name: input.name, data });
    for (const source of input.left ?? []) {
      detail.edges.push({ id: makeEdgeId(), source, target: id });
    }
    for (const target of input.right ?? []) {
      detail.edges.push({ id: makeEdgeId(), source: id, target });
    }
    if (input.groupNodeKey) {
      detail.edges.push({ id: makeEdgeId(), source: input.groupNodeKey, target: id });
    }
    if (input.run) {
      this.tasks.set(id, { status: 2, progressPercent: 100 });
    }
    return this.nodeData.get(id)!;
  }

  async updateNode(input: LibTvUpdateNodeInput): Promise<LibTvNodeDetail> {
    const detail = await this.getProjectDetail(input.projectUuid);
    const existing = detail.nodes.find((node) => node.id === input.nodeKey || node.name === input.nodeKey);
    if (!existing) throw new Error(`Mock node not found: ${input.nodeKey}`);
    if (input.name) existing.name = input.name;
    const data = this.nodeData.get(existing.id) ?? { nodeKey: existing.id, nodeType: existing.type, name: existing.name, data: {} };
    data.name = input.name ?? data.name;
    data.data = {
      ...(data.data ?? {}),
      ...(input.data ?? {}),
      params: {
        ...((data.data?.params as Record<string, unknown>) ?? {}),
        ...(input.params ?? {}),
        ...(input.prompt !== undefined ? { prompt: input.prompt } : {})
      }
    };
    this.nodeData.set(existing.id, data);
    if (input.leftAdd) {
      for (const source of input.leftAdd) detail.edges.push({ id: makeEdgeId(), source, target: existing.id });
    }
    if (input.rightAdd) {
      for (const target of input.rightAdd) detail.edges.push({ id: makeEdgeId(), source: existing.id, target });
    }
    const remove = new Set([...(input.leftRemove ?? []), ...(input.rightRemove ?? [])]);
    if (remove.size > 0) {
      detail.edges = detail.edges.filter((edge) => !remove.has(edge.source) && !remove.has(edge.target));
    }
    if (input.run) {
      this.tasks.set(existing.id, { status: 2, progressPercent: 100 });
    }
    return data;
  }

  async deleteNode(projectUuid: string, nodeKey: string): Promise<void> {
    const detail = await this.getProjectDetail(projectUuid);
    const node = detail.nodes.find((n) => n.id === nodeKey || n.name === nodeKey);
    if (!node) return;
    detail.nodes = detail.nodes.filter((n) => n.id !== node.id);
    detail.edges = detail.edges.filter((e) => e.source !== node.id && e.target !== node.id);
    this.nodeData.delete(node.id);
  }

  async listGroups(projectUuid: string, _parentGroupNodeKey?: string): Promise<LibTvProjectNodeSummary[]> {
    const detail = await this.getProjectDetail(projectUuid);
    return detail.nodes.filter((node) => node.type === "group");
  }

  async createGroup(input: LibTvCreateGroupInput): Promise<LibTvProjectNodeSummary> {
    const detail = await this.getProjectDetail(input.projectUuid);
    const id = makeNodeId("group");
    const summary: LibTvProjectNodeSummary = { id, name: input.name, type: "group", position: { x: 0, y: 0 } };
    detail.nodes.push(summary);
    this.nodeData.set(id, { nodeKey: id, nodeType: "group", name: input.name, data: {} });
    if (input.parentGroupNodeKey) {
      detail.edges.push({ id: makeEdgeId(), source: input.parentGroupNodeKey, target: id });
    }
    for (const nodeKey of input.nodeKeys ?? []) {
      detail.edges.push({ id: makeEdgeId(), source: id, target: nodeKey });
    }
    if (input.run) {
      this.tasks.set(id, { status: 2, progressPercent: 100 });
    }
    return summary;
  }

  async uploadAsset(input: LibTvUploadInput): Promise<LibTvUploadResult> {
    const node = await this.createNode({
      projectUuid: input.projectUuid,
      name: input.nodeName,
      type: input.kind,
      groupNodeKey: input.groupNodeKey,
      x: input.x,
      y: input.y,
      data: { url: [path.resolve(input.filePath)] }
    });
    return { node, url: path.resolve(input.filePath) };
  }

  async createGeneration(input: LibTvGenerationInput): Promise<LibTvGenerationResult> {
    const node = await this.getNode(input.projectUuid, input.nodeId);
    if (!node) throw new Error(`Mock node not found: ${input.nodeId}`);
    this.tasks.set(node.nodeKey, { status: 1, progressPercent: 0 });
    return { taskId: `task-${node.nodeKey}`, nodeId: node.nodeKey, status: 1 };
  }

  async getGenerationProgress(taskIds: string[]): Promise<LibTvGenerationProgress[]> {
    return taskIds.map((taskId) => {
      const key = taskId.replace(/^task-/, "");
      const status = this.tasks.get(key)?.status ?? 2;
      const progressPercent = this.tasks.get(key)?.progressPercent ?? 100;
      return { taskId, status, progressPercent, loading: status === 1 };
    });
  }

  async listModels(nodeType?: string): Promise<LibTvModel[]> {
    if (!nodeType) return this.models;
    return this.models.filter((model) => model.supportModality === nodeType);
  }

  async getModelSchema(ref: string): Promise<LibTvToolSpec | null> {
    const model = this.models.find((m) => m.modelKey === ref || m.modelName === ref);
    return model ? { ...model } : null;
  }
}
