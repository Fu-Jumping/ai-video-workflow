import fs from "fs-extra";
import path from "node:path";
import { CliUserError } from "../cli-errors.js";
import type { LibTvProjectBinding, LibTvState } from "./types.js";

const BINDING_FILE = ".libtv/project.json";
const STATE_FILE = ".libtv/state.json";

export function libTvDir(projectRoot: string): string {
  return path.join(projectRoot, ".libtv");
}

export function bindingPath(projectRoot: string): string {
  return path.join(libTvDir(projectRoot), "project.json");
}

export function statePath(projectRoot: string): string {
  return path.join(libTvDir(projectRoot), "state.json");
}

export async function readBinding(projectRoot: string): Promise<LibTvProjectBinding | null> {
  const file = bindingPath(projectRoot);
  if (!(await fs.pathExists(file))) {
    return null;
  }
  try {
    const data = (await fs.readJson(file)) as Partial<LibTvProjectBinding>;
    if (!data.projectUuid) {
      return null;
    }
    return { projectUuid: data.projectUuid, groupNodeKey: data.groupNodeKey };
  } catch {
    return null;
  }
}

export async function requireBinding(projectRoot: string): Promise<LibTvProjectBinding> {
  const binding = await readBinding(projectRoot);
  if (!binding) {
    throw new CliUserError(
      `缺少项目：请在 ${projectRoot} 执行 ai-video-workflow libtv project use <项目UUID> 写入 .libtv/project.json`
    );
  }
  return binding;
}

export async function writeBinding(projectRoot: string, binding: LibTvProjectBinding): Promise<void> {
  await fs.ensureDir(libTvDir(projectRoot));
  await fs.writeJson(bindingPath(projectRoot), binding, { spaces: 2 });
}

export async function clearBinding(projectRoot: string): Promise<void> {
  await fs.remove(bindingPath(projectRoot));
}

export async function writeGroupBinding(projectRoot: string, groupNodeKey: string): Promise<void> {
  const binding = (await readBinding(projectRoot)) ?? { projectUuid: "" };
  if (!binding.projectUuid) {
    throw new CliUserError(`缺少项目：请先执行 ai-video-workflow libtv project use <项目UUID> 写入 .libtv/project.json`);
  }
  await writeBinding(projectRoot, { ...binding, groupNodeKey });
}

export async function clearGroupBinding(projectRoot: string): Promise<void> {
  const binding = await readBinding(projectRoot);
  if (!binding) return;
  await writeBinding(projectRoot, { projectUuid: binding.projectUuid });
}

export async function readState(projectRoot: string): Promise<LibTvState | null> {
  const file = statePath(projectRoot);
  if (!(await fs.pathExists(file))) {
    return null;
  }
  try {
    return (await fs.readJson(file)) as LibTvState;
  } catch {
    return null;
  }
}

export async function writeState(projectRoot: string, state: LibTvState): Promise<void> {
  await fs.ensureDir(libTvDir(projectRoot));
  await fs.writeJson(statePath(projectRoot), state, { spaces: 2 });
}

export async function resolveProjectRoot(projectOption: string | undefined, cwd: string): Promise<string> {
  if (projectOption) {
    const resolved = path.resolve(cwd, projectOption);
    if (!(await fs.pathExists(resolved))) {
      throw new CliUserError(`项目目录不存在: ${resolved}`);
    }
    return resolved;
  }
  const hasBinding = await readBinding(cwd);
  const hasConfig = await fs.pathExists(path.join(cwd, "project.config.yaml"));
  if (hasBinding || hasConfig) {
    return cwd;
  }
  throw new CliUserError(
    `缺少项目：请使用 --project <path> 传入本地项目目录，或在当前目录执行 ai-video-workflow libtv project use <项目UUID>`
  );
}
