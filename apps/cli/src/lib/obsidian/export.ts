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
  if (path.parse(resolvedOut).root === resolvedOut || resolvedProject.startsWith(`${resolvedOut}${path.sep}`)) {
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
    throw new CliUserError("Refusing to force-remove a non-empty Obsidian output directory without Projection Manifest.json");
  }
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
  return content.startsWith("---\n") && content.includes("\nprojection_generated: true\n");
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
  const orphanedPaths = new Set(operations.filter((operation) => operation.status === "orphaned-generated").map((operation) => operation.vaultPath));
  const previousEntries = manifestByVaultPath(previousManifest);
  const nextEntries = files
    .filter((file) => !skippedPaths.has(file.vaultPath) && !isDirectObsidianUiConfigPath(file.vaultPath))
    .map((file) => manifestEntryForFile(file));
  for (const vaultPath of [...skippedPaths, ...orphanedPaths]) {
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
  if (options.force) {
    await assertSafeForceOutput(outRoot);
  }
  if (options.force && !options.dryRun) {
    await fs.remove(outRoot);
  }
  if (!options.dryRun) {
    await fs.ensureDir(outRoot);
  }

  const projectName = path.basename(projectRoot);
  const sourceFiles = await scanProjectForObsidian(projectRoot);
  if (sourceFiles.length === 0) {
    throw new CliUserError("Project has no Step markdown source files to export to Obsidian.");
  }
  const workflowFiles: ObsidianGeneratedFile[] = [];
  for (const sourceFile of sourceFiles) {
    const originalContent = await fs.readFile(sourcePathToFsPath(projectRoot, sourceFile.sourcePath), "utf8");
    workflowFiles.push({
      vaultPath: workflowVaultPath(sourceFile),
      content: renderGeneratedWorkflowNote(sourceFile, originalContent, projectName),
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
  const previousManifest = options.force ? null : await readProjectionManifest(outRoot);
  const operations = await planGeneratedFiles(outRoot, files, previousManifest, Boolean(options.force));
  const manifest = createManifest(projectRoot, outRoot, projectName, files, operations, previousManifest);
  if (!options.dryRun) {
    await writeGeneratedFiles(outRoot, files, operations);
    await fs.writeFile(vaultFsPath(outRoot, projectionManifestPath), renderProjectionManifest(manifest), "utf8");
  }
  return { vaultRoot: outRoot, manifestPath: projectionManifestPath, files, operations };
}
