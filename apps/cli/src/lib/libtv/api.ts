import { CliUserError } from "../cli-errors.js";
import { libTvAuthHeaders } from "./credentials.js";
import type {
  LibTvAccountInfo,
  LibTvAccountListResult,
  LibTvGenerationProgress,
  LibTvGenerationResult,
  LibTvModelListResult,
  LibTvProjectDetailResult,
  LibTvProjectListResult,
  LibTvProjectMeta,
  LibTvUploadResult,
  LibTvCredentials
} from "./types.js";

export const LIBTV_API_PATHS = {
  accountList: "/api/www/account/list",
  accountActivate: "/api/www/account/activate",
  loginSendCode: "/api/www/login/sendLoginPhoneCode",
  loginByPhone: "/api/www/login/loginByPhoneCode",
  projectList: "/api/canvas/project/list",
  projectCreate: "/api/canvas/project/create",
  projectUpdate: "/api/canvas/project/update",
  projectDelete: "/api/canvas/project/delete",
  projectDetail: "/api/canvas/project/detail",
  nodesBatch: "/api/canvas/nodes/batch",
  thirdAssetCheck: "/api/third_asset/check",
  thirdAssetCreate: "/api/third_asset/create",
  generationCreate: "/api/task/generation/create",
  generationProgress: "/api/task/generation/progress",
  toolSpecList: "/api/tool_spec/list"
} as const;

export interface LibTvApiClientOptions {
  /** Legacy alias for the account API base URL. */
  baseUrl?: string;
  accountBaseUrl?: string;
  canvasBaseUrl?: string;
  credentials?: LibTvCredentials;
}

interface RequestOptions {
  method?: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  host?: "account" | "canvas";
}

function unwrapResponse<T>(data: unknown): T {
  if (typeof data === "object" && data !== null && "code" in data && "data" in data) {
    const wrapped = data as { code: number; msg?: string | null; data: T };
    if (wrapped.code !== 0) {
      throw new CliUserError(`LibTV API error: ${wrapped.msg ?? wrapped.code}`);
    }
    return wrapped.data;
  }
  return data as T;
}

function mapNodeType(type: number | string): string {
  if (typeof type === "string") return type;
  const map: Record<number, string> = {
    1: "text",
    2: "image",
    3: "video",
    4: "audio",
    5: "group",
    6: "script",
    7: "video-clip"
  };
  return map[type] ?? String(type);
}

function parseNodeData(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

export class LibTvApiClient {
  readonly accountBaseUrl: string;
  readonly canvasBaseUrl: string;
  private readonly credentials?: LibTvCredentials;

  constructor(options: LibTvApiClientOptions = {}) {
    this.accountBaseUrl = (options.accountBaseUrl ?? options.baseUrl ?? process.env.LIBTV_API_BASE_URL ?? "https://api2.liblib.art").replace(/\/$/, "");
    this.canvasBaseUrl = (options.canvasBaseUrl ?? process.env.LIBTV_CANVAS_API_BASE_URL ?? "https://api.liblib.tv").replace(/\/$/, "");
    this.credentials = options.credentials;
  }

  private baseUrl(host: "account" | "canvas" = "canvas"): string {
    return host === "account" ? this.accountBaseUrl : this.canvasBaseUrl;
  }

  private buildUrl(path: string, query?: Record<string, string | number | undefined>, host: "account" | "canvas" = "canvas"): string {
    const url = new URL(path, this.baseUrl(host));
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== "") {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? (options.body === undefined ? "GET" : "POST");
    const host = options.host ?? "canvas";
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...(this.credentials ? libTvAuthHeaders(this.credentials) : {}),
      ...(options.headers ?? {})
    };
    let response: Response;
    try {
      response = await fetch(this.buildUrl(path, options.query, host), {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
      });
    } catch (error) {
      throw new CliUserError(`LibTV API 请求失败: ${error instanceof Error ? error.message : String(error)}`);
    }
    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!response.ok) {
      const detail = typeof data === "object" && data !== null && "msg" in data
        ? String((data as { msg?: unknown }).msg ?? "")
        : text;
      throw new CliUserError(`LibTV API ${response.status} ${response.statusText}: ${detail}`);
    }
    return unwrapResponse<T>(data);
  }

  getAccountInfo(): Promise<LibTvAccountInfo> {
    return this.request<LibTvAccountInfo>(LIBTV_API_PATHS.accountList, { method: "GET", host: "account" });
  }

  listAccounts(): Promise<LibTvAccountListResult> {
    return this.request<LibTvAccountListResult>(LIBTV_API_PATHS.accountList, { method: "GET", host: "account" });
  }

  activateAccount(body: { accountId: number | string }): Promise<LibTvAccountListResult> {
    return this.request<LibTvAccountListResult>(LIBTV_API_PATHS.accountActivate, { method: "POST", body, host: "account" });
  }

  sendLoginPhoneCode(body: { phone: string; captcha?: string }): Promise<unknown> {
    return this.request(LIBTV_API_PATHS.loginSendCode, { method: "POST", body, host: "account" });
  }

  loginByPhoneCode(body: { phone: string; code: string; captcha?: string }): Promise<unknown> {
    return this.request(LIBTV_API_PATHS.loginByPhone, { method: "POST", body, host: "account" });
  }

  async listProjects(query: { page?: number; pageSize?: number; orderBy?: string; name?: string; teamId?: number } = {}): Promise<LibTvProjectListResult> {
    const body: Record<string, unknown> = {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      orderBy: query.orderBy ?? "updated_at_desc",
      name: query.name ?? ""
    };
    if (query.teamId !== undefined && query.teamId !== 0) {
      body.teamId = query.teamId;
    }
    return this.request<LibTvProjectListResult>(LIBTV_API_PATHS.projectList, { method: "POST", body });
  }

  async getProjectDetail(projectUuid: string): Promise<LibTvProjectDetailResult> {
    const data = await this.request<{
      projectMeta?: LibTvProjectMeta;
      nodeList?: Array<{
        nodeKey: string;
        name: string;
        type: number | string;
        position?: { positionX?: string | number; positionY?: string | number };
        measured?: { width?: string | number; height?: string | number };
      }>;
      connectionList?: Array<{ id: string; source: string; target: string }>;
      nodeData?: string;
    }>(LIBTV_API_PATHS.projectDetail, { method: "GET", query: { uuid: projectUuid } });
    return {
      projectUuid,
      nodes: (data.nodeList ?? []).map((node) => ({
        id: node.nodeKey,
        name: node.name,
        type: mapNodeType(node.type),
        position: node.position
          ? { x: Number(node.position.positionX ?? 0), y: Number(node.position.positionY ?? 0) }
          : undefined,
        width: node.measured?.width !== undefined ? Number(node.measured.width) : undefined,
        height: node.measured?.height !== undefined ? Number(node.measured.height) : undefined,
        data: parseNodeData((node as { data?: unknown }).data)
      })),
      edges: data.connectionList ?? []
    };
  }

  createProject(body: { name: string; description?: string; coverUrl?: string; teamId?: number; folderId?: number }): Promise<LibTvProjectMeta> {
    return this.request<LibTvProjectMeta>(LIBTV_API_PATHS.projectCreate, { method: "POST", body });
  }

  updateProject(projectUuid: string, body: { name?: string; description?: string; coverUrl?: string; folderId?: number }): Promise<LibTvProjectMeta> {
    return this.request<LibTvProjectMeta>(LIBTV_API_PATHS.projectUpdate, { method: "POST", body: { uuid: projectUuid, ...body } });
  }

  deleteProject(projectUuid: string, body: { teamId?: number } = {}): Promise<unknown> {
    return this.request(LIBTV_API_PATHS.projectDelete, { method: "POST", body: { uuid: projectUuid, ...body } });
  }

  batchNodes(body: Record<string, unknown>): Promise<unknown> {
    return this.request(LIBTV_API_PATHS.nodesBatch, { method: "POST", body });
  }

  uploadThirdAssetCheck(body: Record<string, unknown>): Promise<unknown> {
    return this.request(LIBTV_API_PATHS.thirdAssetCheck, { method: "POST", body });
  }

  uploadThirdAssetCreate(body: Record<string, unknown>): Promise<LibTvUploadResult> {
    return this.request<LibTvUploadResult>(LIBTV_API_PATHS.thirdAssetCreate, { method: "POST", body });
  }

  createGeneration(body: Record<string, unknown>): Promise<LibTvGenerationResult> {
    return this.request<LibTvGenerationResult>(LIBTV_API_PATHS.generationCreate, { method: "POST", body });
  }

  getGenerationProgress(body: { taskIds: string[] }): Promise<LibTvGenerationProgress[]> {
    return this.request<LibTvGenerationProgress[]>(LIBTV_API_PATHS.generationProgress, { method: "POST", body });
  }

  async listToolSpecs(query: { nodeType?: string; name?: string } = {}): Promise<LibTvModelListResult> {
    const data = await this.request<{
      tools?: Array<{
        type?: string;
        toolKey?: string;
        metadata?: string;
        displayName?: string;
      }>;
    }>(LIBTV_API_PATHS.toolSpecList, { method: "GET", query: { nodeType: query.nodeType ?? "", name: query.name ?? "" } });
    const matches = (data.tools ?? []).map((tool) => {
      let meta: Record<string, unknown> = {};
      if (tool.metadata) {
        try {
          const parsed = JSON.parse(tool.metadata);
          if (typeof parsed === "object" && parsed !== null) meta = parsed as Record<string, unknown>;
        } catch {
          // ignore malformed metadata
        }
      }
      return {
        modelKey: typeof meta.modelKey === "string" ? meta.modelKey : (tool.toolKey ?? ""),
        modelName: typeof meta.modelName === "string" ? meta.modelName : (tool.displayName ?? tool.toolKey ?? ""),
        ...meta
      };
    });
    return { nodeType: query.nodeType, query: query.name ?? "", matches };
  }
}
