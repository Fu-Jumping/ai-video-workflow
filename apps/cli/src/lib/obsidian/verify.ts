import fs from "fs-extra";
import path from "node:path";

import type { VerificationIssue, VerificationResult } from "../types.js";
import { parseYaml } from "../yaml.js";
import { hashContent, projectionManifestPath, readProjectionManifest } from "./manifest.js";
import type { ObsidianProjectionManifest, ObsidianProjectionManifestEntry } from "./types.js";

const requiredDashboardMarkers: Record<string, string[]> = {
  "00_Project_Home.md": ["Review Command Center", "Project Health", "Shot Progress", "Execution Readiness", "Graph and Canvas Navigation"],
  "01_Review_Dashboard.md": ["Needs Attention", "Ready for Execution", "Generated File Conflicts", "Review Map"],
  "03_Production_Board.md": ["Execution Readiness", "Production Status", "Handoff Links"]
};
const requiredBaseFiles = ["Bases/Workflow Files.base", "Bases/Shots.base", "Bases/Production Status.base"];
const requiredBaseViews: Record<string, string[]> = {
  "Bases/Workflow Files.base": ["Workflow Files", "Review Queue", "Modified Generated Files"],
  "Bases/Shots.base": ["Shot Table", "Shot Cards", "Shot Progress", "Immersive Review"],
  "Bases/Production Status.base": ["Production Status", "Execution Readiness"]
};
const requiredCanvasFiles = ["Canvas/Workflow Map.canvas", "Canvas/Shot Pipeline.canvas", "Canvas/Review Map.canvas"];
const requiredShotReviewMarkers = [
  "Immersive Review",
  "Review Route",
  "Source Sequence",
  "Frame Continuity",
  "Prompt Handoff",
  "Execution Readiness",
  "User Notes",
  "Review Canvas"
];
const absoluteLinkPattern = /([A-Za-z]:\\|[A-Za-z]:\/|file:\/\/|vscode:\/\/|\]\(\/(?!\/))/;

interface VerifyObsidianOptions {
  projectRoot: string;
  vaultRoot: string;
}

interface CanvasNode {
  type?: string;
  file?: string;
}

interface BaseView {
  name?: string;
}

interface BaseFile {
  views?: BaseView[];
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

function sourceFsPath(projectRoot: string, sourcePath: string): string {
  return path.join(projectRoot, ...sourcePath.split("/"));
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

async function listJsonFiles(root: string, current = root): Promise<string[]> {
  if (!(await fs.pathExists(current))) {
    return [];
  }
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listJsonFiles(root, fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
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
  for (const [file, markers] of Object.entries(requiredDashboardMarkers)) {
    const fullPath = vaultFsPath(vaultRoot, file);
    if (!(await fs.pathExists(fullPath))) {
      pushIssue(issues, { code: "missing-obsidian-dashboard", message: `Missing Obsidian dashboard: ${file}`, path: file });
      continue;
    }
    const content = await fs.readFile(fullPath, "utf8");
    for (const marker of markers) {
      if (!content.includes(marker)) {
        pushIssue(issues, { code: "invalid-obsidian-dashboard", message: `Obsidian dashboard is missing marker: ${marker}`, path: file });
      }
    }
  }
  for (const file of requiredBaseFiles) {
    const fullPath = vaultFsPath(vaultRoot, file);
    if (!(await fs.pathExists(fullPath))) {
      pushIssue(issues, { code: "missing-obsidian-base", message: `Missing Obsidian base: ${file}`, path: file });
      continue;
    }
    let base: BaseFile;
    try {
      base = parseYaml<BaseFile>(await fs.readFile(fullPath, "utf8"));
    } catch {
      pushIssue(issues, { code: "invalid-obsidian-base-yaml", message: `Obsidian base YAML is invalid: ${file}`, path: file });
      continue;
    }
    const viewNames = new Set((base.views ?? []).map((view) => view.name).filter(Boolean));
    for (const viewName of requiredBaseViews[file] ?? []) {
      if (!viewNames.has(viewName)) {
        pushIssue(issues, { code: "missing-obsidian-base-view", message: `Obsidian base is missing view: ${viewName}`, path: file });
      }
    }
  }
}

async function verifyCanvasFiles(vaultRoot: string, issues: VerificationIssue[]): Promise<void> {
  const canvasFiles = [...requiredCanvasFiles, ...(await listVaultFiles(vaultRoot)).filter((file) => file.startsWith("Canvas/Shot Reviews/") && file.endsWith(".canvas"))];
  for (const file of canvasFiles) {
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

async function verifyShotReviewPages(vaultRoot: string, files: string[], issues: VerificationIssue[]): Promise<void> {
  for (const file of files.filter((filePath) => filePath.startsWith("Shots/") && filePath.endsWith(".md"))) {
    const content = await fs.readFile(vaultFsPath(vaultRoot, file), "utf8");
    const frontmatter = readFrontmatter(content);
    const shotId = frontmatter?.shot_id ?? path.basename(file, ".md");
    if (frontmatter?.review_mode !== "immersive") {
      pushIssue(issues, { code: "invalid-obsidian-shot-review", message: `Shot review page is missing immersive review mode: ${file}`, path: file });
    }
    for (const marker of requiredShotReviewMarkers) {
      if (!content.includes(marker)) {
        pushIssue(issues, { code: "invalid-obsidian-shot-review", message: `Shot review page is missing marker: ${marker}`, path: file });
      }
    }
    const reviewCanvasPath = `Canvas/Shot Reviews/${shotId}.canvas`;
    if (!content.includes(`[[${reviewCanvasPath}`) || !(await fs.pathExists(vaultFsPath(vaultRoot, reviewCanvasPath)))) {
      pushIssue(issues, { code: "invalid-obsidian-shot-review", message: `Shot review canvas is missing or not linked: ${reviewCanvasPath}`, path: file });
    }
  }
}

function manifestEntryByVaultPath(manifest: ObsidianProjectionManifest | null): Map<string, ObsidianProjectionManifestEntry> {
  const entries = new Map<string, ObsidianProjectionManifestEntry>();
  for (const entry of manifest?.files ?? []) {
    entries.set(entry.vaultPath, entry);
  }
  return entries;
}

function isValidManifest(manifest: ObsidianProjectionManifest): boolean {
  return manifest.schemaVersion === 1 && manifest.generator === "ai-video-workflow" && Array.isArray(manifest.files);
}

async function verifyManifest(projectRoot: string, vaultRoot: string, issues: VerificationIssue[]): Promise<ObsidianProjectionManifest | null> {
  const manifestFile = vaultFsPath(vaultRoot, projectionManifestPath);
  if (!(await fs.pathExists(manifestFile))) {
    pushIssue(issues, { code: "missing-obsidian-manifest", message: "Missing Obsidian projection manifest", path: projectionManifestPath });
    return null;
  }

  let manifest: ObsidianProjectionManifest;
  try {
    manifest = await readProjectionManifest(vaultRoot) as ObsidianProjectionManifest;
  } catch {
    pushIssue(issues, { code: "invalid-obsidian-manifest", message: "Obsidian projection manifest JSON is invalid", path: projectionManifestPath });
    return null;
  }
  if (!manifest || !isValidManifest(manifest)) {
    pushIssue(issues, { code: "invalid-obsidian-manifest", message: "Obsidian projection manifest schema is invalid", path: projectionManifestPath });
    return null;
  }

  for (const entry of manifest.files) {
    if (!entry.vaultPath || !isRelativeVaultPath(entry.vaultPath) || !entry.contentHash) {
      pushIssue(issues, { code: "invalid-obsidian-manifest", message: "Obsidian projection manifest entry is invalid", path: projectionManifestPath });
      continue;
    }
    const fullPath = vaultFsPath(vaultRoot, entry.vaultPath);
    if (!(await fs.pathExists(fullPath))) {
      pushIssue(issues, { code: "missing-obsidian-manifest-file", message: `Manifest file is missing: ${entry.vaultPath}`, path: entry.vaultPath });
      continue;
    }
    const content = await fs.readFile(fullPath, "utf8");
    if (hashContent(content) !== entry.contentHash) {
      pushIssue(issues, { code: "obsidian-manifest-hash-mismatch", message: `Manifest hash does not match generated file: ${entry.vaultPath}`, path: entry.vaultPath });
    }
    if (entry.sourcePath && (!isRelativeVaultPath(entry.sourcePath) || !(await fs.pathExists(sourceFsPath(projectRoot, entry.sourcePath))))) {
      pushIssue(issues, { code: "obsidian-manifest-source-mismatch", message: `Manifest source path does not resolve: ${entry.sourcePath}`, path: entry.vaultPath });
    }
  }
  return manifest;
}

async function verifyGeneratedMarkdown(
  projectRoot: string,
  vaultRoot: string,
  files: string[],
  manifest: ObsidianProjectionManifest | null,
  issues: VerificationIssue[]
): Promise<void> {
  const manifestEntries = manifestEntryByVaultPath(manifest);
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
    if (!isRelativeVaultPath(sourcePath) || !(await fs.pathExists(sourceFsPath(projectRoot, sourcePath)))) {
      pushIssue(issues, { code: "broken-obsidian-source-path", message: `Generated Obsidian source_path does not resolve: ${sourcePath}`, path: file });
    }
    const manifestEntry = manifestEntries.get(file);
    if (manifestEntry?.sourcePath && manifestEntry.sourcePath !== sourcePath) {
      pushIssue(issues, { code: "obsidian-manifest-source-mismatch", message: `Generated note source_path does not match manifest: ${file}`, path: file });
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

async function verifyOptionalUiConfig(vaultRoot: string, issues: VerificationIssue[]): Promise<void> {
  const suggestedDir = vaultFsPath(vaultRoot, ".obsidian/ai-video-workflow-suggested");
  const files = await listJsonFiles(suggestedDir);
  for (const file of files) {
    const vaultPath = `.obsidian/ai-video-workflow-suggested/${file}`;
    try {
      await fs.readJson(vaultFsPath(vaultRoot, vaultPath));
    } catch {
      pushIssue(issues, { code: "invalid-obsidian-ui-config", message: `Optional Obsidian UI config JSON is invalid: ${vaultPath}`, path: vaultPath });
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
  const manifest = await verifyManifest(resolvedProjectRoot, resolvedVaultRoot, issues);
  const files = await listVaultFiles(resolvedVaultRoot);
  await verifyShotReviewPages(resolvedVaultRoot, files, issues);
  await verifyGeneratedMarkdown(resolvedProjectRoot, resolvedVaultRoot, files, manifest, issues);
  await verifyNoAbsoluteLinks(resolvedVaultRoot, files, issues);
  await verifyOptionalUiConfig(resolvedVaultRoot, issues);
  return { ok: issues.length === 0, issues };
}
