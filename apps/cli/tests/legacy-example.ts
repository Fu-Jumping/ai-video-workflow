import fs from "fs-extra";
import os from "node:os";
import path from "node:path";

import { parseYaml, stringifyYaml } from "../src/lib/yaml.js";

const sharedRoots: string[] = [];
let legacyExampleCache: string | null = null;

/** 官方示例的真实路径（现在是内容树项目）。 */
export function officialExampleRoot(): string {
  return path.resolve(__dirname, "..", "..", "..", "examples", "官方示例-云上早市");
}

async function listFilesRecursive(root: string, prefix = ""): Promise<string[]> {
  const entries = await fs.readdir(path.join(root, prefix), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const rel = prefix ? path.posix.join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(root, rel)));
    } else {
      files.push(rel);
    }
  }
  return files;
}

/**
 * 官方示例已经是内容树项目。需要旧格式（03／04／05 同名目录）口径的用例用这份临时副本：
 * 删掉内容树与索引、去掉 content.format_version，再把「已迁移」快照放回原路径。
 * 同一个测试文件内共享一份副本，afterAll 里调用 disposeLegacyExampleRoots 清理。
 */
export async function legacyExampleRoot(): Promise<string> {
  if (legacyExampleCache) {
    return legacyExampleCache;
  }
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-legacy-example-"));
  sharedRoots.push(root);
  await fs.copy(officialExampleRoot(), root);
  await fs.remove(path.join(root, "内容"));
  await fs.remove(path.join(root, "03_分镜脚本", "00_内容树索引.md"));
  const configPath = path.join(root, "project.config.yaml");
  const config = parseYaml(await fs.readFile(configPath, "utf8")) as Record<string, unknown>;
  delete config.content;
  await fs.writeFile(configPath, stringifyYaml(config), "utf8");
  const snapshotRoot = path.join(root, "已迁移");
  for (const rel of await listFilesRecursive(snapshotRoot)) {
    const raw = await fs.readFile(path.join(snapshotRoot, rel), "utf8");
    const lines = raw.split(/\r?\n/u);
    while (lines.length > 0 && (lines[0].startsWith("> 已迁移") || lines[0].trim() === "")) {
      lines.shift();
    }
    await fs.ensureDir(path.dirname(path.join(root, rel)));
    await fs.writeFile(path.join(root, rel), lines.join("\n"), "utf8");
  }
  await fs.remove(snapshotRoot);
  legacyExampleCache = root;
  return root;
}

export async function disposeLegacyExampleRoots(): Promise<void> {
  legacyExampleCache = null;
  await Promise.all(sharedRoots.splice(0).map((dir) => fs.remove(dir)));
}
