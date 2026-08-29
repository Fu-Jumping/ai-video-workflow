import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { CliUserError } from "../cli-errors.js";
import type { LibTvCredentials } from "./types.js";

const CREDENTIALS_FILE = "credentials.json";

export function libTvConfigDir(): string {
  return process.env.LIBTV_CONFIG_DIR ?? path.join(os.homedir(), ".libtv");
}

export function libTvCredentialsPath(): string {
  return path.join(libTvConfigDir(), CREDENTIALS_FILE);
}

export function libTvTokenFromEnv(): string | undefined {
  return process.env.LIBTV_TOKEN?.trim() || undefined;
}

// Masks an account identifier for display: keeps the first/last 4 chars (or the
// last 2 for short values) so logs never carry a full account identity.
export function maskLibTvAccountIdentifier(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.length <= 8) {
    return `****${value.slice(-2)}`;
  }
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

// Single-line visibility notice describing which credential source a real
// backend call will use. File credentials are machine-global in scope, so the
// source (and a masked account identity when available) is printed to stderr
// before any real network call.
export function describeLibTvCredentialsSource(creds: LibTvCredentials): string {
  const identity =
    maskLibTvAccountIdentifier(creds.useruuid) ??
    (creds.activeAccountId !== undefined ? maskLibTvAccountIdentifier(String(creds.activeAccountId)) : undefined);
  const identityLabel = identity ? `（账户 ${identity}）` : "";
  if (libTvTokenFromEnv()) {
    return `使用 LibTV 凭据：环境变量 LIBTV_TOKEN（覆盖凭据文件 ${libTvCredentialsPath()} 的 token）${identityLabel}`;
  }
  return `使用 LibTV 凭据：凭据文件 ${libTvCredentialsPath()}${identityLabel}`;
}

export function printLibTvCredentialsSource(creds: LibTvCredentials): void {
  console.error(describeLibTvCredentialsSource(creds));
}

export async function readLibTvCredentials(): Promise<LibTvCredentials | null> {
  const envToken = libTvTokenFromEnv();
  const credsPath = libTvCredentialsPath();
  if (envToken && (await fs.pathExists(credsPath))) {
    const existing = await fs.readJson(credsPath).catch(() => null);
    if (existing) {
      return {
        ...(existing as Partial<LibTvCredentials>),
        usertoken: envToken
      } as LibTvCredentials;
    }
  }
  if (!(await fs.pathExists(credsPath))) {
    return null;
  }
  try {
    const data = (await fs.readJson(credsPath)) as Partial<LibTvCredentials>;
    if (!data.usertoken) {
      return null;
    }
    return data as LibTvCredentials;
  } catch {
    return null;
  }
}

export async function writeLibTvCredentials(token: string, extra: Partial<LibTvCredentials> = {}): Promise<string> {
  const existing = await readLibTvCredentials();
  const creds: LibTvCredentials = {
    ...(existing ?? { usertoken: "", useruuid: "", webid: "" }),
    ...extra,
    usertoken: token,
    savedAt: new Date().toISOString()
  };
  await fs.ensureDir(path.dirname(libTvCredentialsPath()));
  await fs.writeJson(libTvCredentialsPath(), creds, { spaces: 2 });
  return libTvCredentialsPath();
}

export async function requireLibTvCredentials(): Promise<LibTvCredentials> {
  const creds = await readLibTvCredentials();
  if (!creds) {
    throw new CliUserError(
      "未找到 LibTV 登录凭据。请先执行 `ai-video-workflow libtv login web` 或 `libtv login phone`。"
    );
  }
  return creds;
}

export function libTvAuthHeaders(creds: LibTvCredentials): Record<string, string> {
  return {
    token: creds.usertoken,
    "X-from-client": "cli",
    ...(creds.activeAccountId ? { "x-account-id": String(creds.activeAccountId) } : {})
  };
}
