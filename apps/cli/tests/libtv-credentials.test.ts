import fs from "fs-extra";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { build } from "tsup";
import { afterEach, describe, expect, test } from "vitest";

import { CliUserError } from "../src/lib/cli-errors.js";
import { LibTvApiClient } from "../src/lib/libtv/api.js";
import {
  describeLibTvCredentialsSource,
  maskLibTvAccountIdentifier,
  readLibTvCredentials
} from "../src/lib/libtv/credentials.js";

const execFileAsync = promisify(execFile);
const tempRoots: string[] = [];
const runningServers: http.Server[] = [];
const envBackup: Record<string, string | undefined> = {};

function setEnv(key: string, value: string | undefined): void {
  if (!(key in envBackup)) {
    envBackup[key] = process.env[key];
  }
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

afterEach(async () => {
  for (const [key, value] of Object.entries(envBackup)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
    delete envBackup[key];
  }
  await Promise.all(
    runningServers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve())))
  );
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

// Local-only JSON server: every request gets the same canned status/body, so the
// network layer never reaches a real API.
async function startJsonServer(status: number, body: string): Promise<string> {
  const server = http.createServer((_request, response) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  runningServers.push(server);
  return `http://127.0.0.1:${port}`;
}

async function stubCredentialsDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-libtv-credentials-"));
  tempRoots.push(dir);
  return dir;
}

describe("LibTV credential source visibility", () => {
  test("masks account identifiers without exposing the full value", () => {
    expect(maskLibTvAccountIdentifier(undefined)).toBeUndefined();
    expect(maskLibTvAccountIdentifier("")).toBeUndefined();
    expect(maskLibTvAccountIdentifier("short")).toBe("****rt");
    expect(maskLibTvAccountIdentifier("user-uuid-12345678")).toBe("user****5678");
  });

  test("describes the file credential source with a masked account identity", async () => {
    const dir = await stubCredentialsDir();
    setEnv("LIBTV_CONFIG_DIR", dir);
    delete process.env.LIBTV_TOKEN;
    await fs.writeJson(path.join(dir, "credentials.json"), {
      usertoken: "stub-token",
      useruuid: "user-uuid-12345678"
    });
    const creds = await readLibTvCredentials();
    expect(creds).not.toBeNull();
    const description = describeLibTvCredentialsSource(creds!);
    expect(description).toContain("凭据文件");
    expect(description).toContain(path.join(dir, "credentials.json"));
    expect(description).toContain("user****5678");
    expect(description).not.toContain("user-uuid-12345678");
    expect(description).not.toContain("stub-token");
  });

  test("describes the environment variable source when LIBTV_TOKEN overrides the file token", async () => {
    const dir = await stubCredentialsDir();
    setEnv("LIBTV_CONFIG_DIR", dir);
    setEnv("LIBTV_TOKEN", "stub-env-token");
    await fs.writeJson(path.join(dir, "credentials.json"), {
      usertoken: "stub-file-token",
      useruuid: "user-uuid-12345678"
    });
    const creds = await readLibTvCredentials();
    expect(creds?.usertoken).toBe("stub-env-token");
    const description = describeLibTvCredentialsSource(creds!);
    expect(description).toContain("环境变量 LIBTV_TOKEN");
    expect(description).toContain("user****5678");
    expect(description).not.toContain("stub-env-token");
    expect(description).not.toContain("stub-file-token");
  });

  test("falls back to the path-only wording when no account identity exists", async () => {
    const dir = await stubCredentialsDir();
    setEnv("LIBTV_CONFIG_DIR", dir);
    delete process.env.LIBTV_TOKEN;
    await fs.writeJson(path.join(dir, "credentials.json"), { usertoken: "stub-token", useruuid: "" });
    const creds = await readLibTvCredentials();
    expect(creds).not.toBeNull();
    const description = describeLibTvCredentialsSource(creds!);
    expect(description).toContain(`凭据文件 ${path.join(dir, "credentials.json")}`);
    expect(description).not.toContain("账户");
  });
});

async function buildCliToTemp(cliRoot: string): Promise<string> {
  const outDir = path.join(cliRoot, "dist-libtv-credentials-test");
  await fs.remove(outDir);
  tempRoots.push(outDir);
  await build({
    cwd: cliRoot,
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: false,
    clean: true,
    outDir,
    silent: true,
    target: "es2022",
    tsconfig: "tsconfig.json"
  } as any);
  return path.join(outDir, "index.js");
}

interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

async function runCli(entry: string, args: string[], env: Record<string, string | undefined>): Promise<CliResult> {
  const childEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) childEnv[key] = value;
  }
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete childEnv[key];
    else childEnv[key] = value;
  }
  try {
    const result = await execFileAsync(process.execPath, [entry, ...args], { env: childEnv });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failed = error as { code?: number | null; stdout?: string; stderr?: string };
    return { code: failed.code ?? 1, stdout: failed.stdout ?? "", stderr: failed.stderr ?? "" };
  }
}

describe("LibTV credential source notice on real backend calls", () => {
  // All three API base URLs are pinned to an unreachable local port so the
  // network layer always fails locally; no real API can ever be reached.
  const offlineEnv = {
    LIBTV_API_BASE_URL: "http://127.0.0.1:1",
    LIBTV_CANVAS_API_BASE_URL: "http://127.0.0.1:1",
    LIBTV_PASSPORT_API_BASE_URL: "http://127.0.0.1:1"
  };

  test("prints the credential source before the network call and never touches a real API", { timeout: 30000 }, async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const entry = await buildCliToTemp(cliRoot);
    const dir = await stubCredentialsDir();
    await fs.writeJson(path.join(dir, "credentials.json"), {
      usertoken: "stub-token",
      useruuid: "user-uuid-12345678"
    });
    const result = await runCli(entry, ["libtv", "project", "list"], {
      ...offlineEnv,
      LIBTV_CONFIG_DIR: dir,
      LIBTV_TOKEN: undefined
    });
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("使用 LibTV 凭据：凭据文件");
    expect(result.stderr).toContain(path.join(dir, "credentials.json"));
    expect(result.stderr).not.toContain("stub-token");
    const noticeIndex = result.stderr.indexOf("使用 LibTV 凭据");
    const errorIndex = result.stderr.indexOf("Error:");
    expect(noticeIndex).toBeGreaterThanOrEqual(0);
    expect(errorIndex).toBeGreaterThanOrEqual(0);
    expect(noticeIndex).toBeLessThan(errorIndex);
  });

  test("prints the environment variable source when LIBTV_TOKEN is set", { timeout: 30000 }, async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const entry = await buildCliToTemp(cliRoot);
    const dir = await stubCredentialsDir();
    await fs.writeJson(path.join(dir, "credentials.json"), {
      usertoken: "stub-file-token",
      useruuid: "user-uuid-12345678"
    });
    const result = await runCli(entry, ["libtv", "project", "list"], {
      ...offlineEnv,
      LIBTV_CONFIG_DIR: dir,
      LIBTV_TOKEN: "stub-env-token"
    });
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("环境变量 LIBTV_TOKEN");
  });

  test("prints no credential notice under --mock", { timeout: 30000 }, async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const entry = await buildCliToTemp(cliRoot);
    const dir = await stubCredentialsDir();
    await fs.writeJson(path.join(dir, "credentials.json"), {
      usertoken: "stub-token",
      useruuid: "user-uuid-12345678"
    });
    const result = await runCli(entry, ["libtv", "--mock", "project", "list"], {
      LIBTV_CONFIG_DIR: dir,
      LIBTV_TOKEN: undefined
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("mock-project");
    expect(result.stderr).not.toContain("使用 LibTV 凭据");
  });
});

describe("LibTV project list response shape guard", () => {
  test("accepts a legitimate empty project list without a false positive", async () => {
    const baseUrl = await startJsonServer(200, JSON.stringify({ projectMetaList: [] }));
    const client = new LibTvApiClient({ canvasBaseUrl: baseUrl });
    const result = await client.listProjects();
    expect(result.projectMetaList).toEqual([]);
  });

  test("unwraps a code/data envelope response", async () => {
    const baseUrl = await startJsonServer(
      200,
      JSON.stringify({ code: 0, msg: null, data: { projectMetaList: [{ projectUuid: "p-1", projectName: "P" }] } })
    );
    const client = new LibTvApiClient({ canvasBaseUrl: baseUrl });
    const result = await client.listProjects();
    expect(result.projectMetaList).toHaveLength(1);
  });

  test("rejects a 200 response without the expected list field with a readable credential hint", async () => {
    const baseUrl = await startJsonServer(200, "{}");
    const client = new LibTvApiClient({ canvasBaseUrl: baseUrl });
    const error = await client.listProjects().then(
      () => null,
      (caught: unknown) => caught
    );
    expect(error).toBeInstanceOf(CliUserError);
    expect((error as Error).message).toContain("projectMetaList");
    expect((error as Error).message).toContain("凭据失效");
    expect((error as Error).message).toContain("libtv login");
  });

  test("rejects a non-array projectMetaList field", async () => {
    const baseUrl = await startJsonServer(200, JSON.stringify({ projectMetaList: "unexpected" }));
    const client = new LibTvApiClient({ canvasBaseUrl: baseUrl });
    await expect(client.listProjects()).rejects.toBeInstanceOf(CliUserError);
  });

  test("keeps surfacing envelope errors from the backend", async () => {
    const baseUrl = await startJsonServer(200, JSON.stringify({ code: 40001, msg: "用户未授权", data: null }));
    const client = new LibTvApiClient({ canvasBaseUrl: baseUrl });
    await expect(client.listProjects()).rejects.toThrow("用户未授权");
  });
});

describe("LibTV project list fails loudly on unexpected response shapes", () => {
  test("reports a readable error instead of an empty success when the body lacks projectMetaList", { timeout: 30000 }, async () => {
    const cliRoot = path.resolve(__dirname, "..");
    const entry = await buildCliToTemp(cliRoot);
    const dir = await stubCredentialsDir();
    await fs.writeJson(path.join(dir, "credentials.json"), {
      usertoken: "stub-token",
      useruuid: "user-uuid-12345678"
    });
    const baseUrl = await startJsonServer(200, "{}");
    const result = await runCli(entry, ["libtv", "project", "list"], {
      LIBTV_API_BASE_URL: baseUrl,
      LIBTV_CANVAS_API_BASE_URL: baseUrl,
      LIBTV_PASSPORT_API_BASE_URL: baseUrl,
      LIBTV_CONFIG_DIR: dir,
      LIBTV_TOKEN: undefined
    });
    expect(result.code).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("使用 LibTV 凭据");
    expect(result.stderr).toContain("projectMetaList");
    expect(result.stderr).toContain("libtv login");
    expect(result.stderr).not.toContain("stub-token");
  });
});
