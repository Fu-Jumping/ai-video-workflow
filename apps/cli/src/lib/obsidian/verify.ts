import fs from "fs-extra";
import path from "node:path";

import type { VerificationIssue, VerificationResult } from "../types.js";
import { parseYaml } from "../yaml.js";

const requiredDashboardFiles = ["00_Project_Home.md"];
const requiredBaseFiles = ["Bases/Workflow Files.base", "Bases/Shots.base", "Bases/Production Status.base"];
const requiredCanvasFiles = ["Canvas/Workflow Map.canvas", "Canvas/Shot Pipeline.canvas"];
const absoluteLinkPattern = /([A-Za-z]:\\|[A-Za-z]:\/|file:\/\/|vscode:\/\/|\]\(\/(?!\/))/;

interface VerifyObsidianOptions {
  projectRoot: string;
  vaultRoot: string;
}

interface CanvasNode {
  type?: string;
  file?: string;
}

function pushIssue(issues: VerificationIssue[], issue: VerificationIssue): void {
  issues.push(issue);
}

function vaultFsPath(vaultRoot: string, vaultPath: string): string {
  return path.join(vaultRoot, ...vaultPath.split("/"));
}

function isRelativeVaultPath(value: string): boolean {
  return !path.isAbsolute(value) && !value.includes(":\\") && !value.includes(":/") && !value.startsWith("file://") && !value.startsWith("vscode://");
}

async function listVaultFiles(root: string, current = root): Promise<string[]> {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") {
      continue;
    }
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listVaultFiles(root, fullPath)));
    } else if (entry.isFile() && /\.(md|base|canvas)$/.test(entry.name)) {
      files.push(path.relative(root, fullPath).replace(/\\/g, "/"));
    }
  }
  return files;
}

function readFrontmatter(content: string): Record<string, string> | null {
  if (!content.startsWith("---\n")) {
    return null;
  }
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) {
    return null;
  }
  const frontmatter = content.slice(4, end);
  const values: Record<string, string> = {};
  for (const line of frontmatter.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) {
      values[match[1]] = match[2].replace(/^"|"$/g, "");
    }
  }
  return values;
}

async function verifyRequiredFiles(vaultRoot: string, issues: VerificationIssue[]): Promise<void> {
  for (const file of requiredDashboardFiles) {
    if (!(await fs.pathExists(vaultFsPath(vaultRoot, file)))) {
      pushIssue(issues, { code: "missing-obsidian-dashboard", message: `Missing Obsidian dashboard: ${file}`, path: file });
    }
  }
  for (const file of requiredBaseFiles) {
    const fullPath = vaultFsPath(vaultRoot, file);
    if (!(await fs.pathExists(fullPath))) {
      pushIssue(issues, { code: "missing-obsidian-base", message: `Missing Obsidian base: ${file}`, path: file });
      continue;
    }
    try {
      parseYaml(await fs.readFile(fullPath, "utf8"));
    } catch {
      pushIssue(issues, { code: "invalid-obsidian-base-yaml", message: `Obsidian base YAML is invalid: ${file}`, path: file });
    }
  }
}

async function verifyCanvasFiles(vaultRoot: string, issues: VerificationIssue[]): Promise<void> {
  for (const file of requiredCanvasFiles) {
    const fullPath = vaultFsPath(vaultRoot, file);
    if (!(await fs.pathExists(fullPath))) {
      pushIssue(issues, { code: "invalid-obsidian-canvas-json", message: `Missing Obsidian canvas: ${file}`, path: file });
      continue;
    }
    try {
      const canvas = (await fs.readJson(fullPath)) as { nodes?: CanvasNode[] };
      if (!Array.isArray(canvas.nodes)) {
        pushIssue(issues, { code: "invalid-obsidian-canvas-json", message: "Canvas JSON must contain a nodes array", path: file });
        continue;
      }
      for (const node of canvas.nodes) {
        if (node.type === "file" && (!node.file || !isRelativeVaultPath(node.file))) {
          pushIssue(issues, { code: "invalid-obsidian-canvas-json", message: "Canvas file node must use a relative vault path", path: file });
        }
        if (node.type === "file" && node.file && isRelativeVaultPath(node.file) && !(await fs.pathExists(vaultFsPath(vaultRoot, node.file)))) {
          pushIssue(issues, { code: "invalid-obsidian-canvas-json", message: `Canvas file node target is missing: ${node.file}`, path: file });
        }
      }
    } catch {
      pushIssue(issues, { code: "invalid-obsidian-canvas-json", message: "Canvas JSON is invalid", path: file });
    }
  }
}

async function verifyGeneratedMarkdown(projectRoot: string, vaultRoot: string, files: string[], issues: VerificationIssue[]): Promise<void> {
  for (const file of files.filter((filePath) => filePath.endsWith(".md"))) {
    const content = await fs.readFile(vaultFsPath(vaultRoot, file), "utf8");
    const frontmatter = readFrontmatter(content);
    if (frontmatter?.projection_generated !== "true") {
      continue;
    }
    const sourcePath = frontmatter.source_path;
    if (!sourcePath) {
      pushIssue(issues, { code: "missing-obsidian-source-path", message: "Generated Obsidian note is missing source_path", path: file });
      continue;
    }
    if (!isRelativeVaultPath(sourcePath) || !(await fs.pathExists(path.join(projectRoot, ...sourcePath.split("/"))))) {
      pushIssue(issues, { code: "broken-obsidian-source-path", message: `Generated Obsidian source_path does not resolve: ${sourcePath}`, path: file });
    }
  }
}

async function verifyNoAbsoluteLinks(vaultRoot: string, files: string[], issues: VerificationIssue[]): Promise<void> {
  for (const file of files) {
    const content = await fs.readFile(vaultFsPath(vaultRoot, file), "utf8");
    if (absoluteLinkPattern.test(content)) {
      pushIssue(issues, { code: "obsidian-absolute-link", message: "Found absolute link in Obsidian projection", path: file });
    }
  }
}

export async function verifyObsidianVault({ projectRoot, vaultRoot }: VerifyObsidianOptions): Promise<VerificationResult> {
  const issues: VerificationIssue[] = [];
  const resolvedProjectRoot = path.resolve(projectRoot);
  const resolvedVaultRoot = path.resolve(vaultRoot);
  if (!(await fs.pathExists(resolvedVaultRoot))) {
    return {
      ok: false,
      issues: [{ code: "missing-obsidian-dashboard", message: "Obsidian vault projection directory does not exist", path: resolvedVaultRoot }]
    };
  }

  await verifyRequiredFiles(resolvedVaultRoot, issues);
  await verifyCanvasFiles(resolvedVaultRoot, issues);
  const files = await listVaultFiles(resolvedVaultRoot);
  await verifyGeneratedMarkdown(resolvedProjectRoot, resolvedVaultRoot, files, issues);
  await verifyNoAbsoluteLinks(resolvedVaultRoot, files, issues);
  return { ok: issues.length === 0, issues };
}
