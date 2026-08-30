import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { LibTvApiClient } from "./api.js";
import type { LibTvBackend, LibTvCreateGroupInput, LibTvCreateNodeInput, LibTvGenerationInput, LibTvUpdateNodeInput, LibTvUploadInput } from "./backend.js";
import type {
  LibTvGenerationProgress,
  LibTvNodeDetail,
  LibTvNodeType,
  LibTvProjectNodeSummary,
  LibTvToolSpec,
  LibTvUploadResult
} from "./types.js";
import { CliUserError } from "../cli-errors.js";

const execFileAsync = promisify(execFile);

/**
 * HTTP backend. Endpoint paths were extracted from the installed LibTV CLI binary.
 * Some request bodies are still best-effort and need to be validated against a real API capture.
 */

function nodeTypeNumber(type: string): number {
  const map: Record<string, number> = {
    text: 1,
    image: 2,
    video: 3,
    audio: 4,
    group: 5,
    script: 6,
    "video-clip": 7
  };
  return map[type] ?? 1;
}

function buildNodeData(
  type: string,
  name: string,
  data: Record<string, unknown>,
  params: Record<string, unknown> | undefined,
  prompt: string | undefined,
  left: string[] = [],
  leftUrls: Record<string, string> = {}
): Record<string, unknown> {
  const mergedParams: Record<string, unknown> = {
    ...(params ?? {}),
    ...(prompt !== undefined ? { prompt } : {})
  };
  if (type === "group") {
    return { type: "group", name, childNodeIds: [], ...data };
  }
  const base: Record<string, unknown> = { type, name, ...data };
  if (type === "text") {
    base.content ??= [];
    base.action ??= "text_generate";
    base.generatorType ??= "default";
  } else if (type === "image") {
    base.url ??= [];
    base.alt ??= "图片";
    base.action ??= "image_generate";
    base.generatorType ??= "default";
  } else if (type === "video") {
    base.url ??= [];
    base.poster ??= "";
    base.action ??= "video_generate";
    base.generatorType ??= "default";
  } else if (type === "audio") {
    base.url ??= [];
    base.action ??= "audio_generate";
    base.generatorType ??= "default";
  } else if (type === "script") {
    base.rows ??= [];
    base.action ??= "script_generate";
    base.generatorType ??= "default";
  }
  const nodeParams: Record<string, unknown> = {
    ...mergedParams,
    count: mergedParams.count ?? 1
  };
  if (type === "image") {
    nodeParams.modeType = mergedParams.modeType ?? (left.length > 0 ? "image2image" : "text2image");
    nodeParams.settings = mergedParams.settings ?? { quality: "medium", resolution: "2K", ratio: "16:9" };
    nodeParams.advancedSettings = mergedParams.advancedSettings ?? {};
    if (left.length > 0) {
      nodeParams.imageList = left.map((nodeId) => ({ nodeId, url: leftUrls[nodeId] ?? "" }));
      nodeParams.imageListOrder = left;
    } else {
      nodeParams.imageList ??= [];
      nodeParams.imageListOrder ??= [];
    }
  } else if (type === "video") {
    nodeParams.modeType = mergedParams.modeType ?? "text2video";
    nodeParams.settings = mergedParams.settings ?? { ratio: "16:9", resolution: "720p", duration: 5, enableSound: "on" };
    nodeParams.advancedSettings = mergedParams.advancedSettings ?? { search_enabled: 1, autoCompliance: 1 };
    nodeParams.imageList = mergedParams.imageList ?? left.map((nodeId) => ({ nodeId, url: leftUrls[nodeId] ?? "" }));
    nodeParams.videoList = mergedParams.videoList ?? [];
    nodeParams.audioList = mergedParams.audioList ?? [];
    nodeParams.textList = mergedParams.textList ?? [];
    if (left.length > 0) {
      nodeParams.imageListOrder = left;
      nodeParams.mixedListOrder = left;
    } else {
      nodeParams.imageListOrder ??= [];
      nodeParams.mixedListOrder ??= [];
    }
  }
  base.params = nodeParams;
  return base;
}

function buildNodeRecord(input: {
  projectUuid: string;
  nodeKey: string;
  type: string;
  name: string;
  data?: Record<string, unknown>;
  params?: Record<string, unknown>;
  prompt?: string;
  x?: number;
  y?: number;
  parentKey?: string;
  left?: string[];
  leftUrls?: Record<string, string>;
}): Record<string, unknown> {
  const data = buildNodeData(input.type, input.name, input.data ?? {}, input.params, input.prompt, input.left ?? [], input.leftUrls ?? {});
  const record: Record<string, unknown> = {
    nodeKey: input.nodeKey,
    projectUuid: input.projectUuid,
    type: nodeTypeNumber(input.type),
    name: input.name,
    position: { positionX: String(input.x ?? 0), positionY: String(input.y ?? 0) },
    parentKey: input.parentKey ?? "",
    data: JSON.stringify(data)
  };
  if (input.type === "group") {
    record.measured = { width: "400", height: "300" };
  }
  return record;
}

function inferTaskType(nodeId: string): string {
  const lower = nodeId.toLowerCase();
  if (lower.startsWith("v-")) return "video";
  if (lower.startsWith("i-")) return "image";
  if (lower.startsWith("a-")) return "audio";
  return "text";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function installLibtvCli(): Promise<void> {
  const isWindows = process.platform === "win32";
  if (isWindows) {
    const psUrl = "https://liblibai-web-static.liblib.cloud/cli/latest/install-libtv-cli.ps1";
    await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `Invoke-WebRequest -Uri '${psUrl}' -UseBasicParsing | Invoke-Expression`
    ]);
  } else {
    const shUrl = "https://liblibai-web-static.liblib.cloud/cli/latest/install-libtv-cli.sh";
    await execFileAsync("bash", ["-c", `curl -fsSL '${shUrl}' | bash`]);
  }
}

function connectionRecord(source: string, target: string): Record<string, unknown> {
  return {
    connectionId: randomUUID(),
    source,
    target,
    sourceHandle: "source",
    targetHandle: "target"
  };
}

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

  async sendLoginPhoneCode(input: { phone: string; captcha?: string }) {
    return this.client.sendLoginPhoneCode(input);
  }

  async loginByPhoneCode(input: { phone: string; code: string; captcha?: string }) {
    return this.client.loginByPhoneCode(input);
  }

  async listProjects(query?: { page?: number; pageSize?: number; orderBy?: string; name?: string; teamId?: number; workspaceId?: number | string }) {
    const result = await this.client.listProjects(query ?? {});
    return result.projectMetaList;
  }

  async getProjectDetail(projectUuid: string) {
    return this.client.getProjectDetail(projectUuid);
  }

  async createProject(input: { name: string; description?: string; coverUrl?: string; teamId?: number; folderId?: number; workspaceId?: number | string }) {
    return this.client.createProject(input);
  }

  async updateProject(projectUuid: string, input: { name?: string; description?: string; coverUrl?: string; folderId?: number }) {
    return this.client.updateProject(projectUuid, input);
  }

  async deleteProject(projectUuid: string, teamId?: number) {
    await this.client.deleteProject(projectUuid, { teamId });
  }

  async listWorkspaces(query?: { page?: number; pageSize?: number; orderBy?: string; name?: string; teamId?: number }) {
    return this.client.listWorkspaces(query ?? {});
  }

  async getWorkspaceDetail(workspaceId: number | string) {
    return this.client.getWorkspaceDetail(workspaceId);
  }

  async createWorkspace(input: { name: string; description?: string; coverUrl?: string; teamId?: number }) {
    return this.client.createWorkspace(input);
  }

  async updateWorkspace(workspaceId: number | string, input: { name?: string; description?: string; coverUrl?: string; teamId?: number }) {
    return this.client.updateWorkspace(workspaceId, input);
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
    const nodeKey = randomUUID();
    const nodesCreate = [
      buildNodeRecord({
        projectUuid: input.projectUuid,
        nodeKey,
        type: input.type,
        name: input.name,
        data: input.data,
        params: input.params,
        prompt: input.prompt,
        x: input.x,
        y: input.y,
        parentKey: input.groupNodeKey ? "" : "",
        left: input.left,
        leftUrls: input.leftUrls
      })
    ];
    const connectionsCreate = [
      ...(input.left ?? []).map((source) => connectionRecord(source, nodeKey)),
      ...(input.right ?? []).map((target) => connectionRecord(nodeKey, target)),
      ...(input.groupNodeKey ? [connectionRecord(input.groupNodeKey, nodeKey)] : [])
    ];
    const body = {
      projectUuid: input.projectUuid,
      nodes: { create: nodesCreate },
      connections: connectionsCreate.length > 0 ? { create: connectionsCreate } : {}
    };
    await this.client.batchNodes(body);
    const created = await this.getNode(input.projectUuid, input.name);
    if (!created) {
      throw new CliUserError(`节点创建后未找到: ${input.name}`);
    }
    if (input.run) {
      return this.runNode(input.projectUuid, created, input.prompt, input.params);
    }
    return created;
  }

  async updateNode(input: LibTvUpdateNodeInput): Promise<LibTvNodeDetail> {
    const existing = await this.getNode(input.projectUuid, input.nodeKey);
    if (!existing) {
      throw new CliUserError(`节点更新前未找到: ${input.nodeKey}`);
    }
    const detail = await this.client.getProjectDetail(input.projectUuid);
    const summary = detail.nodes.find((node) => node.id === existing.nodeKey || node.name === existing.nodeKey);
    const type = summary?.type ?? existing.nodeType;
    const name = input.name ?? existing.name;
    const leftAdd = input.leftAdd ?? [];
    const rightAdd = input.rightAdd ?? [];
    const leftRemove = input.leftRemove ?? [];
    const rightRemove = input.rightRemove ?? [];
    const existingParams = (existing.data?.params ?? {}) as Record<string, unknown>;
    const mergedParams = { ...existingParams, ...(input.params ?? {}) };
    const prompt = input.prompt ?? (typeof existingParams.prompt === "string" ? existingParams.prompt : undefined);
    const existingOrder = (existingParams.imageListOrder ?? existingParams.mixedListOrder ?? []) as string[];
    const leftForRecord = leftAdd.length > 0 ? leftAdd : existingOrder;
    const existingImageList = Array.isArray(existingParams.imageList) ? existingParams.imageList as Array<{ nodeId?: string; url?: string }> : [];
    const leftUrls: Record<string, string> = { ...(input.leftUrls ?? {}) };
    for (const item of existingImageList) {
      if (item.nodeId && item.url) leftUrls[item.nodeId] = item.url;
    }
    const nodesUpdate = [
      buildNodeRecord({
        projectUuid: input.projectUuid,
        nodeKey: existing.nodeKey,
        type,
        name,
        data: {
          ...(existing.data ?? {}),
          ...(input.data ?? {})
        },
        params: mergedParams,
        prompt,
        x: summary?.position?.x,
        y: summary?.position?.y,
        parentKey: "",
        left: leftForRecord,
        leftUrls
      })
    ];
    const connectionsCreate = [
      ...leftAdd.map((source) => connectionRecord(source, existing.nodeKey)),
      ...rightAdd.map((target) => connectionRecord(existing.nodeKey, target))
    ];
    const removeKeys = new Set([...leftRemove, ...rightRemove]);
    const connectionsDelete = (detail.edges ?? [])
      .filter((edge) => removeKeys.has(edge.source) || removeKeys.has(edge.target))
      .map((edge) => edge.id);
    const body = {
      projectUuid: input.projectUuid,
      nodes: { update: nodesUpdate },
      connections: {
        ...(connectionsCreate.length > 0 ? { create: connectionsCreate } : {}),
        ...(connectionsDelete.length > 0 ? { delete: connectionsDelete.map((edge) => ({
          connectionId: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle ?? "source",
          targetHandle: edge.targetHandle ?? "target"
        })) } : {})
      }
    };
    await this.client.batchNodes(body);
    const updated = await this.getNode(input.projectUuid, existing.nodeKey);
    if (!updated) {
      throw new CliUserError(`节点更新后未找到: ${input.nodeKey}`);
    }
    if (input.run) {
      return this.runNode(input.projectUuid, updated, input.prompt, input.params);
    }
    return updated;
  }

  async deleteNode(projectUuid: string, nodeKey: string): Promise<void> {
    const existing = await this.getNode(projectUuid, nodeKey);
    if (!existing) return;
    const detail = await this.client.getProjectDetail(projectUuid);
    const summary = detail.nodes.find((node) => node.id === existing.nodeKey || node.name === existing.nodeKey);
    const record = buildNodeRecord({
      projectUuid,
      nodeKey: existing.nodeKey,
      type: summary?.type ?? existing.nodeType,
      name: existing.name,
      data: existing.data ?? {},
      x: summary?.position?.x,
      y: summary?.position?.y,
      parentKey: ""
    });
    const connectedEdges = (detail.edges ?? []).filter((edge) => edge.source === existing.nodeKey || edge.target === existing.nodeKey);
    if (connectedEdges.length > 0) {
      await this.client.batchNodes({
        projectUuid,
        nodes: {},
        connections: {
          delete: connectedEdges.map((edge) => ({
            connectionId: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle ?? "source",
            targetHandle: edge.targetHandle ?? "target"
          }))
        }
      });
    }
    await this.client.batchNodes({
      projectUuid,
      nodes: { delete: [record] },
      connections: {}
    });
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
    const groupKey = randomUUID();
    const nodesCreate = [
      buildNodeRecord({
        projectUuid: input.projectUuid,
        nodeKey: groupKey,
        type: "group",
        name: input.name,
        data: { childNodeIds: (input.nodeKeys ?? []) },
        x: 0,
        y: 0
      })
    ];
    const connectionsCreate = (input.nodeKeys ?? []).map((childKey) => connectionRecord(groupKey, childKey));
    const body = {
      projectUuid: input.projectUuid,
      nodes: { create: nodesCreate },
      connections: connectionsCreate.length > 0 ? { create: connectionsCreate } : {}
    };
    await this.client.batchNodes(body);
    const created = (await this.listGroups(input.projectUuid, input.parentGroupNodeKey)).find((node) => node.name === input.name);
    if (!created) {
      throw new CliUserError(`分组创建后未找到: ${input.name}`);
    }
    return created;
  }

  private async runNode(
    projectUuid: string,
    node: LibTvNodeDetail,
    prompt?: string,
    params?: Record<string, unknown>
  ): Promise<LibTvNodeDetail> {
    const dataParams = (node.data?.params ?? {}) as Record<string, unknown>;
    const modelKey = typeof params?.model === "string"
      ? params.model
      : typeof dataParams.model === "string"
        ? dataParams.model
        : undefined;
    if (!modelKey) {
      throw new CliUserError(`无法确定生成模型，请通过 -s model=... 指定`);
    }
    const taskType = node.nodeType === "video" ? "video" : node.nodeType === "image" ? "image" : node.nodeType === "audio" ? "audio" : "text";
    const result = await this.createGeneration({
      projectUuid,
      nodeId: node.nodeKey,
      modelKey,
      prompt: prompt ?? (typeof dataParams.prompt === "string" ? dataParams.prompt : ""),
      taskType,
      params: { ...dataParams, ...(params ?? {}) }
    });
    if (!result.taskId) {
      return node;
    }
    for (let i = 0; i < 600; i += 1) {
      await sleep(2000);
      const progress = await this.client.getGenerationProgress({ taskIds: [result.taskId] });
      const current = progress?.[0];
      if (current?.status === 2 || current?.status === 3) {
        if (current.status === 3) {
          throw new CliUserError(`生成失败: ${result.taskId} status=${current.status} result=${typeof current.taskResult === "string" ? current.taskResult.slice(0, 200) : ""}`);
        }
        if (current.status === 2) {
          await this.saveGenerationResult({ projectUuid, node, progress: current });
        }
        return (await this.getNode(projectUuid, node.nodeKey)) ?? node;
      }
    }
    throw new CliUserError(`生成超时: ${result.taskId}`);
  }

  async saveGenerationResult(
    input: { projectUuid: string; node: LibTvNodeDetail; progress: LibTvGenerationProgress }
  ): Promise<LibTvNodeDetail> {
    const { projectUuid, node, progress } = input;
    const detail = await this.client.getProjectDetail(projectUuid);
    const summary = detail.nodes.find((candidate) => candidate.id === node.nodeKey || candidate.name === node.nodeKey);
    const updatedData: Record<string, unknown> = {
      ...(node.data ?? {})
    };
    if (typeof progress.taskResult === "string" && progress.taskResult) {
      try {
        const parsed = JSON.parse(progress.taskResult) as Record<string, unknown>;
        if (Array.isArray(parsed.texts)) {
          updatedData.content = parsed.texts;
        }
        if (Array.isArray(parsed.images)) {
          updatedData.url = (parsed.images as Array<unknown>).map((item) =>
            typeof item === "string" ? item : (item as { url?: string })?.url ?? ""
          );
        }
        if (Array.isArray(parsed.videos)) {
          updatedData.url = (parsed.videos as Array<unknown>).map((item) => {
            if (typeof item === "string") return item;
            const record = item as { url?: string; previewPath?: string };
            return record.url ?? record.previewPath ?? "";
          });
        }
      } catch {
        // ignore malformed taskResult
      }
    }
    updatedData.taskInfo = {
      taskId: progress.taskId ?? "",
      loading: false,
      status: 2,
      progressPercent: progress.progressPercent ?? 100
    };
    const record = buildNodeRecord({
      projectUuid,
      nodeKey: node.nodeKey,
      type: summary?.type ?? node.nodeType,
      name: node.name,
      data: updatedData,
      x: summary?.position?.x,
      y: summary?.position?.y,
      parentKey: ""
    });
    await this.client.batchNodes({
      projectUuid,
      nodes: { update: [record] },
      connections: {}
    });
    return (await this.getNode(projectUuid, node.nodeKey)) ?? node;
  }

  async uploadAsset(input: LibTvUploadInput): Promise<LibTvUploadResult> {
    // TODO: Replace with a pure HTTP OSS presign upload when the bridge contract is available.
    // For now, fall back to the locally installed official `libtv` CLI so `upload` is usable.
    const binary = await this.ensureLibtvBinary();
    const args = [
      "upload",
      input.nodeName,
      "--project",
      input.projectUuid,
      "-f",
      input.filePath,
      ...(input.groupNodeKey ? ["-g", input.groupNodeKey] : []),
      ...(input.kind ? ["-t", input.kind] : []),
      "--x",
      String(input.x ?? 0),
      "--y",
      String(input.y ?? 0)
    ];
    const { stdout } = await execFileAsync(binary, args, { cwd: process.cwd() });
    try {
      return JSON.parse(stdout) as LibTvUploadResult;
    } catch {
      throw new CliUserError(`libtv upload 输出无法解析: ${stdout.slice(0, 500)}`);
    }
  }

  private resolveLibtvBinarySync(): string | undefined {
    const candidates = [
      process.env.LIBTV_CLI_BINARY,
      path.join(os.homedir(), ".libtv", process.platform === "win32" ? "libtv.exe" : "libtv"),
      process.platform === "win32" ? "libtv.exe" : "libtv"
    ].filter((value): value is string => Boolean(value));
    for (const candidate of candidates) {
      try {
        if (candidate.includes("/") || candidate.includes("\\") || candidate.includes(":")) {
          if (fs.existsSync(candidate)) return candidate;
        } else {
          return candidate;
        }
      } catch {
        // ignore
      }
    }
    return undefined;
  }

  private async ensureLibtvBinary(): Promise<string> {
    const existing = this.resolveLibtvBinarySync();
    if (existing) return existing;
    await installLibtvCli();
    const installed = this.resolveLibtvBinarySync();
    if (!installed) {
      throw new CliUserError("未找到 libtv CLI，且自动安装失败。请手动安装官方 libtv 后重试。");
    }
    return installed;
  }

  async createGeneration(input: LibTvGenerationInput) {
    const schema = await this.getModelSchema(input.modelKey);
    const provider = typeof schema?.modelVendor === "string"
      ? schema.modelVendor.toLowerCase()
      : input.modelKey.split("-")[0]?.toLowerCase() ?? input.modelKey.toLowerCase();
    const taskType = input.taskType ?? inferTaskType(input.nodeId);
    const dataParams = (input.params ?? {}) as Record<string, unknown>;
    const settings = (dataParams.settings ?? {}) as Record<string, unknown>;
    const imageList = Array.isArray(dataParams.imageList)
      ? (dataParams.imageList as Array<unknown>).map((item) => typeof item === "string" ? item : (item as { url?: string })?.url ?? "")
      : [];
    const videoList = Array.isArray(dataParams.videoList)
      ? (dataParams.videoList as Array<unknown>).map((item) => typeof item === "string" ? item : (item as { url?: string })?.url ?? "")
      : [];
    const audioList = Array.isArray(dataParams.audioList)
      ? (dataParams.audioList as Array<unknown>).map((item) => typeof item === "string" ? item : (item as { url?: string })?.url ?? "")
      : [];
    const body = {
      params: {
        prompt: input.prompt,
        model: input.modelKey,
        count: dataParams.count ?? 1,
        modeType: dataParams.modeType,
        ...settings,
        textList: dataParams.textList ?? [],
        imageList,
        videoList,
        audioList
      },
      metadata: {
        node_id: input.nodeId,
        project_id: input.projectUuid
      },
      provider,
      model: input.modelKey,
      taskType,
      requestId: randomUUID()
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
