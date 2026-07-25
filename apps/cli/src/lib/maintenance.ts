import fs from "fs-extra";
import path from "node:path";

import { CliUserError } from "./cli-errors.js";
import { exportObsidianVault } from "./obsidian/export.js";
import { projectionManifestPath, readProjectionManifest } from "./obsidian/manifest.js";
import type { ObsidianExportResult, ObsidianProjectionManifest } from "./obsidian/types.js";
import { readWorkflowProjectConfig } from "./project-root.js";
import { syncProject } from "./sync.js";
import type { Ide, VerificationIssue } from "./types.js";
import { verifyObsidianVault } from "./obsidian/verify.js";
import { resolveInProjectObsidianView } from "./view-layer.js";

export type CleanViewOperationStatus = "would-remove" | "removed" | "missing";

export interface CleanViewOperation {
  status: CleanViewOperationStatus;
  vaultPath: string;
}

export interface CleanViewResult {
  projectRoot: string;
  vaultRoot: string;
  dryRun: boolean;
  noOpReason?: string;
  operations: CleanViewOperation[];
  preservedUntrackedFiles: string[];
  removedEmptyDirs: string[];
}

export interface RebuildViewOptions {
  repoRoot: string;
  projectRoot: string;
  ide?: Ide;
  dryRun?: boolean;
  includeObsidianUi?: boolean;
  includePluginRecipes?: boolean;
  skipSync?: boolean;
}

export interface RebuildViewResult {
  projectRoot: string;
  vaultRoot: string;
  ide: Ide;
  dryRun: boolean;
  syncPlanned: boolean;
  syncRan: boolean;
  clean: CleanViewResult;
  exportResult: ObsidianExportResult;
  verificationIssues: VerificationIssue[];
}

const generatedViewPathExtensions = /\.(md|base|canvas|json)$/i;

function vaultFsPath(vaultRoot: string, vaultPath: string): string {
  return path.join(vaultRoot, ...vaultPath.split("/"));
}

async function listFiles(root: string, current = root): Promise<string[]> {
  if (!(await fs.pathExists(current))) {
    return [];
  }
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(root, fullPath)));
    } else if (entry.isFile()) {
      files.push(path.relative(root, fullPath).replace(/\\/g, "/"));
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

async function containsGitDirectory(root: string): Promise<boolean> {
  if (!(await fs.pathExists(root))) {
    return false;
  }
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.name === ".git") {
      return true;
    }
    if (await containsGitDirectory(path.join(root, entry.name))) {
      return true;
    }
  }
  return false;
}

function assertManifestShape(manifest: ObsidianProjectionManifest | null, vaultRoot: string): ObsidianProjectionManifest {
  if (!manifest) {
    throw new CliUserError(
      `Cannot clean Obsidian view without ${projectionManifestPath}: ${vaultRoot}`,
      "Run incremental export, or inspect the directory manually before using destructive cleanup."
    );
  }
  if (manifest.generator !== "ai-video-workflow" || !Array.isArray(manifest.files)) {
    throw new CliUserError(`Invalid Obsidian projection manifest: ${path.join(vaultRoot, projectionManifestPath)}`);
  }
  return manifest;
}

function cleanableManifestPaths(manifest: ObsidianProjectionManifest): string[] {
  const paths = new Set<string>();
  for (const entry of manifest.files) {
    if (entry.vaultPath && generatedViewPathExtensions.test(entry.vaultPath)) {
      paths.add(entry.vaultPath);
    }
  }
  paths.add(projectionManifestPath);
  return [...paths].sort((left, right) => left.localeCompare(right));
}

function parentDirsForVaultPaths(vaultRoot: string, vaultPaths: string[]): string[] {
  const dirs = new Set<string>();
  for (const vaultPath of vaultPaths) {
    let current = path.dirname(vaultFsPath(vaultRoot, vaultPath));
    while (current.startsWith(vaultRoot) && current !== path.dirname(vaultRoot)) {
      dirs.add(current);
      if (current === vaultRoot) {
        break;
      }
      current = path.dirname(current);
    }
  }
  return [...dirs].sort((left, right) => right.length - left.length);
}

async function removeEmptyDirs(vaultRoot: string, vaultPaths: string[]): Promise<string[]> {
  const removed: string[] = [];
  for (const dir of parentDirsForVaultPaths(vaultRoot, vaultPaths)) {
    if (!(await fs.pathExists(dir))) {
      continue;
    }
    try {
      await fs.rmdir(dir);
      removed.push(path.relative(vaultRoot, dir).replace(/\\/g, "/") || ".");
    } catch {
      // Directory still contains user-authored or preserved files.
    }
  }
  return removed;
}

async function readCleanManifest(vaultRoot: string): Promise<ObsidianProjectionManifest> {
  try {
    return assertManifestShape(await readProjectionManifest(vaultRoot), vaultRoot);
  } catch (error) {
    if (error instanceof CliUserError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new CliUserError(`Cannot read Obsidian projection manifest: ${message}`);
  }
}

export async function cleanInProjectObsidianView({
  projectRoot,
  dryRun = false
}: {
  projectRoot: string;
  dryRun?: boolean;
}): Promise<CleanViewResult> {
  const resolvedProjectRoot = path.resolve(projectRoot);
  await readWorkflowProjectConfig(resolvedProjectRoot);
  const vaultRoot = resolveInProjectObsidianView(resolvedProjectRoot);
  if (!(await fs.pathExists(vaultRoot))) {
    return {
      projectRoot: resolvedProjectRoot,
      vaultRoot,
      dryRun,
      noOpReason: "Obsidian view does not exist",
      operations: [],
      preservedUntrackedFiles: [],
      removedEmptyDirs: []
    };
  }
  const stat = await fs.stat(vaultRoot);
  if (!stat.isDirectory()) {
    throw new CliUserError(`Obsidian view path must be a directory: ${vaultRoot}`);
  }
  if (await containsGitDirectory(vaultRoot)) {
    throw new CliUserError("Refusing to clean an Obsidian view containing .git");
  }

  const manifest = await readCleanManifest(vaultRoot);
  const cleanablePaths = cleanableManifestPaths(manifest);
  const cleanablePathSet = new Set(cleanablePaths);
  const existingFiles = await listFiles(vaultRoot);
  const preservedUntrackedFiles = existingFiles.filter((file) => !cleanablePathSet.has(file));
  const operations: CleanViewOperation[] = [];

  for (const vaultPath of cleanablePaths) {
    const fullPath = vaultFsPath(vaultRoot, vaultPath);
    if (!(await fs.pathExists(fullPath))) {
      operations.push({ status: "missing", vaultPath });
      continue;
    }
    operations.push({ status: dryRun ? "would-remove" : "removed", vaultPath });
    if (!dryRun) {
      await fs.remove(fullPath);
    }
  }

  const removedEmptyDirs = dryRun ? [] : await removeEmptyDirs(vaultRoot, cleanablePaths);
  return {
    projectRoot: resolvedProjectRoot,
    vaultRoot,
    dryRun,
    operations,
    preservedUntrackedFiles,
    removedEmptyDirs
  };
}

function formatCount(label: string, count: number): string {
  return `- ${label}: ${count}`;
}

export function renderCleanViewSummary(result: CleanViewResult): string {
  const lines = [
    result.dryRun ? "Obsidian view clean dry-run:" : "Obsidian view clean:",
    `- vault: ${result.vaultRoot}`
  ];
  if (result.noOpReason) {
    lines.push(`- no-op: ${result.noOpReason}`);
    return lines.join("\n");
  }
  const wouldRemove = result.operations.filter((operation) => operation.status === "would-remove").length;
  const removed = result.operations.filter((operation) => operation.status === "removed").length;
  const missing = result.operations.filter((operation) => operation.status === "missing").length;
  lines.push(formatCount(result.dryRun ? "would remove generated files" : "removed generated files", result.dryRun ? wouldRemove : removed));
  lines.push(formatCount("missing manifest entries", missing));
  lines.push(formatCount("preserved untracked files", result.preservedUntrackedFiles.length));
  if (result.preservedUntrackedFiles.length > 0) {
    for (const file of result.preservedUntrackedFiles.slice(0, 5)) {
      lines.push(`  - ${file}`);
    }
    if (result.preservedUntrackedFiles.length > 5) {
      lines.push(`  - ... ${result.preservedUntrackedFiles.length - 5} more`);
    }
  }
  if (result.removedEmptyDirs.length > 0) {
    lines.push(formatCount("removed empty directories", result.removedEmptyDirs.length));
  }
  return lines.join("\n");
}

export function renderRebuildViewSummary(result: RebuildViewResult): string {
  const lines = [
    result.dryRun ? "Obsidian view rebuild dry-run:" : "Obsidian view rebuild:",
    `- project: ${result.projectRoot}`,
    `- vault: ${result.vaultRoot}`,
    `- ide: ${result.ide}`,
    `- sync: ${result.syncRan ? "ran" : result.syncPlanned ? "planned" : "skipped"}`,
    renderCleanViewSummary(result.clean),
    result.dryRun ? "Obsidian export dry-run operations against the current view:" : "Obsidian export operations:"
  ];
  const statuses = ["created", "updated", "unchanged", "skipped-user-modified", "skipped-user-config-existing", "orphaned-generated"] as const;
  for (const status of statuses) {
    lines.push(formatCount(status, result.exportResult.operations.filter((operation) => operation.status === status).length));
  }
  if (result.verificationIssues.length === 0) {
    lines.push(result.dryRun ? "- verification: skipped in dry-run" : "- verification: passed");
  } else {
    lines.push(`- verification issues: ${result.verificationIssues.length}`);
  }
  if (result.dryRun) {
    lines.push("- dry-run note: cleanup and export are previewed separately; no post-clean filesystem is simulated.");
  }
  return lines.join("\n");
}

export async function rebuildInProjectObsidianView(options: RebuildViewOptions): Promise<RebuildViewResult> {
  const projectRoot = path.resolve(options.projectRoot);
  const config = await readWorkflowProjectConfig(projectRoot);
  const ide = options.ide ?? config.ide;
  const vaultRoot = resolveInProjectObsidianView(projectRoot);
  const dryRun = options.dryRun === true;
  const syncPlanned = options.skipSync !== true;

  if (syncPlanned && !dryRun) {
    await syncProject({
      repoRoot: options.repoRoot,
      projectRoot,
      pack: config.pack,
      ide
    });
  }

  const clean = await cleanInProjectObsidianView({ projectRoot, dryRun });
  const exportResult = await exportObsidianVault({
    projectRoot,
    outRoot: vaultRoot,
    force: false,
    includePluginRecipes: options.includePluginRecipes !== false,
    includeObsidianUi: options.includeObsidianUi === true,
    dryRun,
    inProjectView: true
  });
  const verification = dryRun
    ? { ok: true, issues: [] }
    : await verifyObsidianVault({
        projectRoot,
        vaultRoot
      });
  if (!verification.ok) {
    const firstIssue = verification.issues[0];
    throw new CliUserError(`Obsidian view rebuild failed verification: ${firstIssue.code}: ${firstIssue.message}`);
  }
  return {
    projectRoot,
    vaultRoot,
    ide,
    dryRun,
    syncPlanned,
    syncRan: syncPlanned && !dryRun,
    clean,
    exportResult,
    verificationIssues: verification.issues
  };
}
