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

/** 取某个二级标题下的正文行（到下一个二级标题为止）。 */
function sectionBody(content: string, heading: string): string[] {
  const lines = content.split(/\r?\n/u);
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start < 0) return [];
  const body: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (/^##\s/u.test(line)) break;
    body.push(line);
  }
  return body;
}

/**
 * 旧格式 03 靠 `00_镜头组说明.md` 提供镜头组描述；内容树模式把这份信息放在
 * `内容/…/00_镜头组总览.md`，示例项目按内容树口径不再在 03 留原件。
 * 所以旧口径副本从总览派生出这份说明，让旧格式覆盖继续有效。
 */
async function writeLegacyShotGroupDescription(root: string): Promise<void> {
  const overviewAbs = path.join(root, "内容", "场-001", "镜头组-001", "00_镜头组总览.md");
  if (!(await fs.pathExists(overviewAbs))) return;
  const overview = await fs.readFile(overviewAbs, "utf8");

  const metaLines: string[] = [];
  for (const line of sectionBody(overview, "## 这一组讲什么")) {
    if (line.trimStart().startsWith("<!--")) break;
    const trimmed = line.trim();
    if (trimmed.length > 0) metaLines.push("- " + trimmed);
  }

  const shotOrder: string[] = [];
  for (const line of overview.split(/\r?\n/u)) {
    const row = /^\|\s*(\d+)\s*\|\s*(镜头-\d+)\s*\|\s*([^|]+?)\s*\|/u.exec(line);
    if (!row) continue;
    shotOrder.push(row[1] + ". `shot-" + row[2]!.replace(/^镜头-/u, "") + "`：" + row[3]!.trim());
  }

  const continuity = sectionBody(overview, "## 连续性")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const target = path.join(root, "03_分镜脚本", "镜头组-001", "00_镜头组说明.md");
  if (await fs.pathExists(target)) return;
  // 展示名是迁移前的原样：内容树里镜头组展示名没有独立字段，只影响投影标题、不参与校验。
  const lines = [
    "# 镜头组 001：从邀请到出发",
    "",
    "## 元信息",
    "",
    "- 镜头组编号：group-001",
    ...metaLines,
    ""
  ];
  if (shotOrder.length > 0) lines.push("## 镜头顺序", "", ...shotOrder, "");
  if (continuity.length > 0) lines.push("## 连续性", "", ...continuity, "");
  await fs.ensureDir(path.dirname(target));
  await fs.writeFile(target, lines.join("\n") + "\n", "utf8");
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
  // 必须在删「内容/」之前派生：镜头组描述只存在于内容树总览里。
  await writeLegacyShotGroupDescription(root);
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
