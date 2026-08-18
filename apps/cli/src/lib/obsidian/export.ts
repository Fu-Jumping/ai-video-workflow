import fs from "fs-extra";
import path from "node:path";

import { renderBaseFiles } from "./bases.js";
import { renderReviewMapCanvas, renderShotPipelineCanvas, renderShotReviewCanvases, renderWorkflowCanvas } from "./canvas.js";
import { renderDashboardFiles } from "./dashboard.js";
import {
  hashContent,
  manifestEntryForFile,
  projectionManifestPath,
  readProjectionManifest,
  renderProjectionManifest
} from "./manifest.js";
import { renderGeneratedWorkflowNote, workflowVaultPath } from "./markdown.js";
import { hasGeneratedFrontmatterMarker } from "./properties.js";
import { sourcePathToFsPath } from "./paths.js";
import { scanProjectForObsidian } from "./scan.js";
import type {
  ObsidianExportOperation,
  ObsidianExportOptions,
  ObsidianExportResult,
  ObsidianGeneratedFile,
  ObsidianProjectionManifest,
  ObsidianProjectionManifestEntry
} from "./types.js";
import { isDirectObsidianUiConfigPath, renderObsidianUiConfigFiles } from "./ui-config.js";
import { resolveInProjectObsidianView } from "../view-layer.js";
import { CliUserError } from "../cli-errors.js";
import { readProjectConfig } from "../project-config.js";
import { assertExistingDirectory } from "../project-root.js";
import { verifyProject } from "../verify.js";

const legacyUserNotesDirectory = "笔记";
const userNotesDirectory = "04_个人笔记";

function isInsidePath(child: string, parent: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function assertExportableProject(projectRoot: string): Promise<void> {
  await assertExistingDirectory(projectRoot, "Project root");
  const { config, issues } = await readProjectConfig(projectRoot);
  if (!config) {
    throw new CliUserError(issues[0]?.message ?? "Project root is missing valid project.config.yaml");
  }
  const verification = await verifyProject({
    projectRoot,
    ide: config.ide,
    pack: config.pack
  });
  if (!verification.ok) {
    const firstIssue = verification.issues[0];
    throw new CliUserError(`Project must pass verify before exporting Obsidian projection: ${firstIssue.code}: ${firstIssue.message}`);
  }
}

async function assertSafeOutput(projectRoot: string, outRoot: string, inProjectView: boolean): Promise<void> {
  const resolvedProject = path.resolve(projectRoot);
  const resolvedOut = path.resolve(outRoot);
  if (resolvedOut === resolvedProject) {
    throw new CliUserError("Obsidian export output cannot be the project root");
  }
  if (path.parse(resolvedOut).root === resolvedOut || isInsidePath(resolvedProject, resolvedOut)) {
    throw new CliUserError("Obsidian export output must be a dedicated directory, not a filesystem root or project parent");
  }
  const expectedInProjectView = resolveInProjectObsidianView(resolvedProject);
  if (isInsidePath(resolvedOut, resolvedProject)) {
    if (!inProjectView || !sameFsPath(resolvedOut, expectedInProjectView)) {
      throw new CliUserError("Obsidian export output inside a project must use --in-project-view for _views/obsidian.");
    }
  }
  if (await fs.pathExists(resolvedOut)) {
    const stat = await fs.stat(resolvedOut);
    if (!stat.isDirectory()) {
      throw new CliUserError(`Obsidian export output must be a directory: ${resolvedOut}`);
    }
  }
}

async function assertSafeForceOutput(outRoot: string): Promise<void> {
  if (!(await fs.pathExists(outRoot))) {
    return;
  }
  if (await fs.pathExists(path.join(outRoot, ".git"))) {
    throw new CliUserError("Refusing to force-remove an Obsidian output directory containing .git");
  }
  const entries = await fs.readdir(outRoot);
  const hasManifest = await fs.pathExists(vaultFsPath(outRoot, projectionManifestPath));
  if (entries.length > 0 && !hasManifest) {
    throw new CliUserError(`Refusing to force-remove a non-empty Obsidian output directory without ${projectionManifestPath}`);
  }
}

const currentVaultTopDirectories = ["00_开始审阅", "01_阶段审核", "02_按镜头联查", "03_审阅工具", "04_个人笔记"] as const;

function isCurrentVaultLayout(manifest: ObsidianProjectionManifest | null): boolean {
  return (manifest?.files ?? []).some((entry) =>
    currentVaultTopDirectories.some(
      (dir) => entry.vaultPath === dir || entry.vaultPath.startsWith(`${dir}/`)
    )
  );
}

async function assertVaultOwnership(projectRoot: string, outRoot: string, inProjectView: boolean): Promise<void> {
  // The in-project view is owned by the project itself by construction.
  if (inProjectView) {
    return;
  }
  const manifest = await readProjectionManifest(outRoot);
  // Only block cross-project reuse of a CURRENT-layout vault. Legacy-layout vaults (旧目录
  // like 流程/ or 笔记/) are an explicit migration path and may carry a stale projectName.
  if (
    manifest?.projectName &&
    manifest.projectName !== path.basename(projectRoot) &&
    isCurrentVaultLayout(manifest)
  ) {
    throw new CliUserError(
      `Refusing to export into an Obsidian vault owned by another project (${manifest.projectName}). ` +
        "Choose a dedicated output directory for each project."
    );
  }
}

function exportLockPath(outRoot: string): string {
  return path.join(path.dirname(path.resolve(outRoot)), `${path.basename(outRoot)}.ai-video-workflow-export.lock`);
}

async function acquireExportLock(outRoot: string, projectName: string): Promise<() => Promise<void>> {
  const lockPath = exportLockPath(outRoot);
  await fs.ensureDir(path.dirname(lockPath));
  try {
    const handle = await fs.promises.open(lockPath, "wx");
    try {
      await handle.writeFile(JSON.stringify({ projectName, pid: process.pid, startedAt: new Date().toISOString() }), "utf8");
    } finally {
      await handle.close();
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EEXIST") {
      let owner = "";
      try {
        owner = (JSON.parse(await fs.readFile(lockPath, "utf8")) as { projectName?: string }).projectName ?? "";
      } catch {
        // lock file unreadable or not JSON; still treat as an active lock
      }
      throw new CliUserError(
        `Another Obsidian export is already running for this output directory${owner ? ` (project ${owner})` : ""}. ` +
          `If no export is running, remove the stale lock file: ${lockPath}`
      );
    }
    throw error;
  }
  return async () => {
    try {
      await fs.remove(lockPath);
    } catch {
      // ignore cleanup failures
    }
  };
}

function vaultFsPath(outRoot: string, vaultPath: string): string {
  return path.join(outRoot, ...vaultPath.split("/"));
}

async function currentFileHash(fullPath: string): Promise<string | null> {
  if (!(await fs.pathExists(fullPath))) {
    return null;
  }
  return hashContent(await fs.readFile(fullPath, "utf8"));
}

async function isKnownGeneratedFileWithoutManifest(fullPath: string): Promise<boolean> {
  if (/\.(base|canvas)$/.test(fullPath)) {
    return true;
  }
  if (!fullPath.endsWith(".md")) {
    return false;
  }
  const content = await fs.readFile(fullPath, "utf8");
  return hasGeneratedFrontmatterMarker(content);
}

function manifestByVaultPath(manifest: ObsidianProjectionManifest | null): Map<string, ObsidianProjectionManifestEntry> {
  const entries = new Map<string, ObsidianProjectionManifestEntry>();
  for (const entry of manifest?.files ?? []) {
    entries.set(entry.vaultPath, entry);
  }
  return entries;
}

function sameFsPath(left: string, right: string): boolean {
  const resolvedLeft = path.resolve(left);
  const resolvedRight = path.resolve(right);
  if (process.platform === "win32") {
    return resolvedLeft.toLowerCase() === resolvedRight.toLowerCase();
  }
  return resolvedLeft === resolvedRight;
}

interface UserNoteBackup {
  sourcePath: string;
  destinationPath: string;
  content: string;
}

async function listMarkdownFiles(root: string, current = root): Promise<string[]> {
  if (!(await fs.pathExists(current))) {
    return [];
  }
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") {
      continue;
    }
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listMarkdownFiles(root, fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(path.relative(root, fullPath).replace(/\\/g, "/"));
    }
  }
  return files;
}

async function collectUserNoteBackups(outRoot: string, previousManifest: ObsidianProjectionManifest | null): Promise<UserNoteBackup[]> {
  const tracked = new Set((previousManifest?.files ?? []).map((entry) => entry.vaultPath));
  const backups: UserNoteBackup[] = [];
  for (const directory of [userNotesDirectory, legacyUserNotesDirectory]) {
    for (const relativePath of await listMarkdownFiles(vaultFsPath(outRoot, directory))) {
      const sourcePath = `${directory}/${relativePath}`;
      if (tracked.has(sourcePath)) {
        continue;
      }
      const fullPath = vaultFsPath(outRoot, sourcePath);
      const content = await fs.readFile(fullPath, "utf8");
      if (relativePath === "说明.md" && content.includes("这个文件夹用于存放审阅意见")) {
        continue;
      }
      const destinationPath = directory === legacyUserNotesDirectory
        ? `${userNotesDirectory}/${relativePath}`
        : sourcePath;
      backups.push({ sourcePath, destinationPath, content });
    }
  }
  return backups;
}

async function restoreUserNoteBackups(
  outRoot: string,
  backups: UserNoteBackup[],
  dryRun: boolean,
  operations: ObsidianExportOperation[]
): Promise<void> {
  const restoredDestinations = new Set<string>();
  for (const backup of backups) {
    const sourceFullPath = vaultFsPath(outRoot, backup.sourcePath);
    const destinationFullPath = vaultFsPath(outRoot, backup.destinationPath);
    const destinationWasRestored = restoredDestinations.has(backup.destinationPath);
    if (backup.sourcePath !== backup.destinationPath && (destinationWasRestored || await fs.pathExists(destinationFullPath))) {
      operations.push({
        status: "skipped-user-modified",
        vaultPath: backup.sourcePath,
        reason: `user note migration target already exists: ${backup.destinationPath}`
      });
      if (!dryRun) {
        await fs.ensureDir(path.dirname(sourceFullPath));
        await fs.writeFile(sourceFullPath, backup.content, "utf8");
      }
      continue;
    }
    if (dryRun) {
      continue;
    }
    await fs.ensureDir(path.dirname(destinationFullPath));
    await fs.writeFile(destinationFullPath, backup.content, "utf8");
    restoredDestinations.add(backup.destinationPath);
    if (backup.sourcePath !== backup.destinationPath && await fs.pathExists(sourceFullPath)) {
      await fs.remove(sourceFullPath);
    }
  }
}

async function removeSafeOrphanedGeneratedFiles(outRoot: string, operations: ObsidianExportOperation[], dryRun: boolean): Promise<void> {
  if (dryRun) {
    return;
  }
  for (const operation of operations.filter((candidate) => candidate.status === "orphaned-generated")) {
    const fullPath = vaultFsPath(outRoot, operation.vaultPath);
    if (await fs.pathExists(fullPath)) {
      await fs.remove(fullPath);
    }
  }
}

async function planGeneratedFiles(
  outRoot: string,
  files: ObsidianGeneratedFile[],
  previousManifest: ObsidianProjectionManifest | null,
  assumeCleanOutput: boolean
): Promise<ObsidianExportOperation[]> {
  const operations: ObsidianExportOperation[] = [];
  const previousEntries = manifestByVaultPath(previousManifest);
  const nextPaths = new Set(files.map((file) => file.vaultPath));

  for (const file of files) {
    const fullPath = vaultFsPath(outRoot, file.vaultPath);
    const nextHash = hashContent(file.content);
    const currentHash = assumeCleanOutput ? null : await currentFileHash(fullPath);
    const previousEntry = previousEntries.get(file.vaultPath);

    if (currentHash === null) {
      operations.push({ status: "created", vaultPath: file.vaultPath, sourcePath: file.sourcePath });
      continue;
    }
    if (isDirectObsidianUiConfigPath(file.vaultPath)) {
      operations.push({
        status: "skipped-user-config-existing",
        vaultPath: file.vaultPath,
        sourcePath: file.sourcePath,
        reason: "existing Obsidian UI config is local user state"
      });
      continue;
    }
    if (currentHash === nextHash) {
      operations.push({ status: "unchanged", vaultPath: file.vaultPath, sourcePath: file.sourcePath });
      continue;
    }
    if (!previousEntry) {
      if (await isKnownGeneratedFileWithoutManifest(fullPath)) {
        operations.push({ status: "updated", vaultPath: file.vaultPath, sourcePath: file.sourcePath, reason: "generated file without previous manifest" });
      } else {
        operations.push({
          status: "skipped-user-modified",
          vaultPath: file.vaultPath,
          sourcePath: file.sourcePath,
          reason: "existing file is not recorded in the projection manifest"
        });
      }
      continue;
    }
    if (currentHash !== previousEntry.contentHash) {
      operations.push({
        status: "skipped-user-modified",
        vaultPath: file.vaultPath,
        sourcePath: file.sourcePath,
        reason: "current file hash differs from previous manifest"
      });
      continue;
    }
    operations.push({ status: "updated", vaultPath: file.vaultPath, sourcePath: file.sourcePath });
  }

  for (const entry of previousEntries.values()) {
    if (!nextPaths.has(entry.vaultPath)) {
      const currentHash = assumeCleanOutput ? entry.contentHash : await currentFileHash(vaultFsPath(outRoot, entry.vaultPath));
      if (currentHash !== null && currentHash !== entry.contentHash) {
        operations.push({
          status: "skipped-user-modified",
          vaultPath: entry.vaultPath,
          sourcePath: entry.sourcePath,
          reason: "old generated file was modified and is retained for manual migration"
        });
        continue;
      }
      operations.push({
        status: "orphaned-generated",
        vaultPath: entry.vaultPath,
        sourcePath: entry.sourcePath,
        reason: "recorded in previous manifest but not generated this run"
      });
    }
  }
  return operations;
}

async function writeGeneratedFiles(outRoot: string, files: ObsidianGeneratedFile[], operations: ObsidianExportOperation[]): Promise<void> {
  const writablePaths = new Set(operations.filter((operation) => operation.status === "created" || operation.status === "updated").map((operation) => operation.vaultPath));
  for (const file of files.filter((generatedFile) => writablePaths.has(generatedFile.vaultPath))) {
    const fullPath = path.join(outRoot, ...file.vaultPath.split("/"));
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, file.content, "utf8");
  }
}

function createManifest(
  projectRoot: string,
  outRoot: string,
  projectName: string,
  files: ObsidianGeneratedFile[],
  operations: ObsidianExportOperation[],
  previousManifest: ObsidianProjectionManifest | null
): ObsidianProjectionManifest {
  const skippedPaths = new Set(operations.filter((operation) => operation.status === "skipped-user-modified").map((operation) => operation.vaultPath));
  const previousEntries = manifestByVaultPath(previousManifest);
  const nextEntries = files
    .filter((file) => !skippedPaths.has(file.vaultPath) && !isDirectObsidianUiConfigPath(file.vaultPath))
    .map((file) => manifestEntryForFile(file));
  for (const vaultPath of skippedPaths) {
    const previousEntry = previousEntries.get(vaultPath);
    if (previousEntry) {
      nextEntries.push(previousEntry);
    }
  }
  const viewMode = sameFsPath(outRoot, resolveInProjectObsidianView(projectRoot)) ? "in-project-view" : "external-vault";
  return {
    schemaVersion: 2,
    generator: "ai-video-workflow",
    generatedAt: new Date().toISOString(),
    projectName,
    projectRoot: ".",
    ...(viewMode === "in-project-view" ? { projectRootRelativePath: "../.." } : {}),
    viewMode,
    files: nextEntries.sort((left, right) => left.vaultPath.localeCompare(right.vaultPath))
  };
}

export async function exportObsidianVault(options: ObsidianExportOptions): Promise<ObsidianExportResult> {
  const projectRoot = path.resolve(options.projectRoot);
  const outRoot = path.resolve(options.outRoot);
  await assertExportableProject(projectRoot);
  await assertSafeOutput(projectRoot, outRoot, options.inProjectView === true);
  await assertVaultOwnership(projectRoot, outRoot, options.inProjectView === true);
  const projectName = path.basename(projectRoot);
  const releaseLock = options.dryRun ? async () => {} : await acquireExportLock(outRoot, projectName);
  try {
    const previousManifest = await readProjectionManifest(outRoot);
    const userNoteBackups = await collectUserNoteBackups(outRoot, previousManifest);
    if (options.force) {
      await assertSafeForceOutput(outRoot);
    }
    if (options.force && !options.dryRun) {
      await fs.remove(outRoot);
    }
    if (!options.dryRun) {
      await fs.ensureDir(outRoot);
    }

    const sourceFiles = await scanProjectForObsidian(projectRoot);
    if (sourceFiles.length === 0) {
      throw new CliUserError("Project has no Step markdown source files to export to Obsidian.");
    }
    const workflowFiles: ObsidianGeneratedFile[] = [];
    const vaultPathOwners = new Map<string, string>();
    for (const sourceFile of sourceFiles) {
      const originalContent = await fs.readFile(sourcePathToFsPath(projectRoot, sourceFile.sourcePath), "utf8");
      const vaultPath = workflowVaultPath(sourceFile);
      const previousOwner = vaultPathOwners.get(vaultPath);
      if (previousOwner !== undefined) {
        throw new CliUserError(
          `Obsidian projection collision: ${vaultPath} is generated from both ${previousOwner} and ${sourceFile.sourcePath}. ` +
            "Rename one of the source files so each source file projects to a unique vault path."
        );
      }
      vaultPathOwners.set(vaultPath, sourceFile.sourcePath);
      workflowFiles.push({
        vaultPath,
        content: renderGeneratedWorkflowNote(sourceFile, originalContent, projectName, sourceFiles),
        sourcePath: sourceFile.sourcePath,
        sourceContent: originalContent
      });
    }

    const files = [
      ...workflowFiles,
      ...renderDashboardFiles(projectName, sourceFiles, options.includePluginRecipes),
      ...renderBaseFiles(),
      renderWorkflowCanvas(sourceFiles),
      renderShotPipelineCanvas(sourceFiles),
      ...renderShotReviewCanvases(sourceFiles),
      renderReviewMapCanvas(),
      ...(options.includeObsidianUi ? renderObsidianUiConfigFiles() : [])
    ];
    const planningManifest = options.force ? null : previousManifest;
    const operations = await planGeneratedFiles(outRoot, files, planningManifest, Boolean(options.force));
    const manifest = createManifest(projectRoot, outRoot, projectName, files, operations, previousManifest);
    if (!options.dryRun) {
      await writeGeneratedFiles(outRoot, files, operations);
      await removeSafeOrphanedGeneratedFiles(outRoot, operations, false);
      await restoreUserNoteBackups(outRoot, userNoteBackups, false, operations);
      await fs.writeFile(vaultFsPath(outRoot, projectionManifestPath), renderProjectionManifest(manifest), "utf8");
    } else {
      await restoreUserNoteBackups(outRoot, userNoteBackups, true, operations);
    }
    return { vaultRoot: outRoot, manifestPath: projectionManifestPath, files, operations };
  } finally {
    await releaseLock();
  }
}
