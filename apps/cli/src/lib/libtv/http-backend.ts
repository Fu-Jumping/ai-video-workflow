import { LibTvApiClient } from "./api.js";
import type { LibTvBackend, LibTvCreateGroupInput, LibTvCreateNodeInput, LibTvGenerationInput, LibTvUpdateNodeInput, LibTvUploadInput } from "./backend.js";
import type {
  LibTvNodeDetail,
  LibTvNodeType,
  LibTvProjectNodeSummary,
  LibTvToolSpec,
  LibTvUploadResult
} from "./types.js";
import { CliUserError } from "../cli-errors.js";

/**
 * HTTP backend. Endpoint paths were extracted from the installed LibTV CLI binary.
 * Some request bodies are still best-effort and need to be validated against a real API capture.
 */
export class HttpLibTvBackend implements LibTvBackend {
  constructor(private readonly client: LibTvApiClient) {}

  async getAccountInfo() {
    return this.client.getAccountInfo();
  }

  async listAccounts() {
    return this.client.listAccounts();
  }

  async activateAccount(accountId: number | string) {
    return this.client.activateAccount({ accountId });
  }

  async listProjects() {
    const result = await this.client.listProjects();
    return result.projectMetaList ?? [];
  }

  async getProjectDetail(projectUuid: string) {
    return this.client.getProjectDetail(projectUuid);
  }

  async createProject(input: { name: string; description?: string; coverUrl?: string; teamId?: number; folderId?: number }) {
    return this.client.createProject(input);
  }

  async updateProject(projectUuid: string, input: { name?: string; description?: string; coverUrl?: string; folderId?: number }) {
    return this.client.updateProject(projectUuid, input);
  }

  async deleteProject(projectUuid: string, teamId?: number) {
    await this.client.deleteProject(projectUuid, { teamId });
  }

  async listNodes(projectUuid: string, groupNodeKey?: string): Promise<LibTvProjectNodeSummary[]> {
    const detail = await this.client.getProjectDetail(projectUuid);
    if (!groupNodeKey) {
      return detail.nodes ?? [];
    }
    const group = (detail.nodes ?? []).find((node) => node.id === groupNodeKey || node.name === groupNodeKey);
    const allowed = new Set<string>([group?.id ?? groupNodeKey]);
    for (const edge of detail.edges ?? []) {
      if (edge.source === group?.id || edge.source === groupNodeKey) {
        allowed.add(edge.target);
      }
      if (edge.target === group?.id || edge.target === groupNodeKey) {
        allowed.add(edge.source);
      }
    }
    return (detail.nodes ?? []).filter((node) => allowed.has(node.id));
  }

  async getNode(projectUuid: string, ref: string): Promise<LibTvNodeDetail | null> {
    const detail = await this.client.getProjectDetail(projectUuid);
    const summary = (detail.nodes ?? []).find((node) => node.id === ref || node.name === ref);
    if (!summary) {
      return null;
    }
    // The official CLI returns full node data through the same project detail flow; the HTTP
    // contract for full data is still pending. Summary is enough for idempotent planning.
    return {
      nodeKey: summary.id,
      nodeType: summary.type as LibTvNodeType | string,
      name: summary.name,
      data: summary.data ?? {}
    };
  }

  async createNode(input: LibTvCreateNodeInput): Promise<LibTvNodeDetail> {
    // TODO: confirm exact /api/canvas/nodes/batch payload with a real capture.
    const body = {
      projectUuid: input.projectUuid,
      nodes: [
        {
          type: input.type,
          name: input.name,
          data: {
            ...(input.data ?? {}),
            params: {
              ...(input.params ?? {}),
              ...(input.prompt !== undefined ? { prompt: input.prompt } : {})
            }
          },
          position: input.x !== undefined || input.y !== undefined ? { x: input.x ?? 0, y: input.y ?? 0 } : undefined,
          groupNodeKey: input.groupNodeKey
        }
      ],
      edges: [
        ...(input.left ?? []).map((source) => ({ source, target: "__new__" })),
        ...(input.right ?? []).map((target) => ({ source: "__new__", target }))
      ]
    };
    await this.client.batchNodes(body);
    const created = await this.getNode(input.projectUuid, input.name);
    if (!created) {
      throw new CliUserError(`节点创建后未找到: ${input.name}`);
    }
    return created;
  }

  async updateNode(input: LibTvUpdateNodeInput): Promise<LibTvNodeDetail> {
    // TODO: confirm exact batch payload.
    const body = {
      projectUuid: input.projectUuid,
      nodes: [
        {
          nodeKey: input.nodeKey,
          name: input.name,
          data: {
            ...(input.data ?? {}),
            params: {
              ...(input.params ?? {}),
              ...(input.prompt !== undefined ? { prompt: input.prompt } : {})
            }
          }
        }
      ],
      edges: {
        leftAdd: input.leftAdd,
        leftRemove: input.leftRemove,
        rightAdd: input.rightAdd,
        rightRemove: input.rightRemove
      }
    };
    await this.client.batchNodes(body);
    const updated = await this.getNode(input.projectUuid, input.nodeKey);
    if (!updated) {
      throw new CliUserError(`节点更新后未找到: ${input.nodeKey}`);
    }
    return updated;
  }

  async deleteNode(projectUuid: string, nodeKey: string): Promise<void> {
    await this.client.batchNodes({ projectUuid, nodeKeyList: [nodeKey] });
  }

  async listGroups(projectUuid: string, parentGroupNodeKey?: string): Promise<LibTvProjectNodeSummary[]> {
    const detail = await this.client.getProjectDetail(projectUuid);
    const groups = (detail.nodes ?? []).filter((node) => node.type === "group");
    if (!parentGroupNodeKey) {
      return groups;
    }
    const parent = (detail.nodes ?? []).find((node) => node.id === parentGroupNodeKey || node.name === parentGroupNodeKey);
    const allowed = new Set<string>([parent?.id ?? parentGroupNodeKey]);
    for (const edge of detail.edges ?? []) {
      if (edge.source === parent?.id || edge.source === parentGroupNodeKey) {
        allowed.add(edge.target);
      }
      if (edge.target === parent?.id || edge.target === parentGroupNodeKey) {
        allowed.add(edge.source);
      }
    }
    return groups.filter((node) => allowed.has(node.id));
  }

  async createGroup(input: LibTvCreateGroupInput): Promise<LibTvProjectNodeSummary> {
    // TODO: confirm exact batch payload.
    const body = {
      projectUuid: input.projectUuid,
      nodes: [{ type: "group", name: input.name, data: {}, groupNodeKey: input.parentGroupNodeKey }],
      edges: (input.nodeKeys ?? []).map((nodeKey) => ({ source: "__new__", target: nodeKey }))
    };
    await this.client.batchNodes(body);
    const created = (await this.listGroups(input.projectUuid, input.parentGroupNodeKey)).find((node) => node.name === input.name);
    if (!created) {
      throw new CliUserError(`分组创建后未找到: ${input.name}`);
    }
    return created;
  }

  async uploadAsset(input: LibTvUploadInput): Promise<LibTvUploadResult> {
    // TODO: The real upload flow is OSS presign + /api/third_asset/create. This is a placeholder
    // that only works against a mock backend.
    throw new CliUserError(
      "HTTP 上传尚未完成：需要先实现 OSS 预签名上传与 /api/third_asset/create 的真实请求体。"
    );
  }

  async createGeneration(input: LibTvGenerationInput) {
    // TODO: confirm exact /api/task/generation/create payload.
    const body = {
      projectUuid: input.projectUuid,
      nodeId: input.nodeId,
      modelKey: input.modelKey,
      prompt: input.prompt,
      params: input.params ?? {}
    };
    return this.client.createGeneration(body);
  }

  async getGenerationProgress(taskIds: string[]) {
    return this.client.getGenerationProgress({ taskIds });
  }

  async listModels(nodeType?: string) {
    const result = await this.client.listToolSpecs({ nodeType });
    return result.matches ?? [];
  }

  async getModelSchema(ref: string): Promise<LibTvToolSpec | null> {
    const models = await this.listModels();
    const match = models.find((model) => model.modelKey === ref || model.modelName === ref);
    return match ? (match as LibTvToolSpec) : null;
  }
}
