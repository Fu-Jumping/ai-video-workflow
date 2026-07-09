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

async function assertSafeOutput(projectRoot: string, outRoot: string): Promise<void> {
  const resolvedProject = path.resolve(projectRoot);
  const resolvedOut = path.resolve(outRoot);
  if (resolvedOut === resolvedProject) {
    throw new Error("Obsidian export output cannot be the project root");
  }
  if (path.parse(resolvedOut).root === resolvedOut || resolvedProject.startsWith(`${resolvedOut}${path.sep}`)) {
    throw new Error("Obsidian export output must be a dedicated directory, not a filesystem root or project parent");
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
  return {
    schemaVersion: 1,
    generator: "ai-video-workflow",
    generatedAt: new Date().toISOString(),
    projectName,
    projectRoot,
    files: nextEntries.sort((left, right) => left.vaultPath.localeCompare(right.vaultPath))
  };
}

export async function exportObsidianVault(options: ObsidianExportOptions): Promise<ObsidianExportResult> {
  const projectRoot = path.resolve(options.projectRoot);
  const outRoot = path.resolve(options.outRoot);
  await assertSafeOutput(projectRoot, outRoot);
  if (options.force && !options.dryRun) {
    await fs.remove(outRoot);
  }
  if (!options.dryRun) {
    await fs.ensureDir(outRoot);
  }

  const projectName = path.basename(projectRoot);
  const sourceFiles = await scanProjectForObsidian(projectRoot);
  const workflowFiles: ObsidianGeneratedFile[] = [];
  for (const sourceFile of sourceFiles) {
    const originalContent = await fs.readFile(sourcePathToFsPath(projectRoot, sourceFile.sourcePath), "utf8");
    workflowFiles.push({
      vaultPath: workflowVaultPath(sourceFile),
      content: renderGeneratedWorkflowNote(sourceFile, originalContent, projectName),
      sourcePath: sourceFile.sourcePath
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
  const manifest = createManifest(projectRoot, projectName, files, operations, previousManifest);
  if (!options.dryRun) {
    await writeGeneratedFiles(outRoot, files, operations);
    await fs.writeFile(vaultFsPath(outRoot, projectionManifestPath), renderProjectionManifest(manifest), "utf8");
  }
  return { vaultRoot: outRoot, manifestPath: projectionManifestPath, files, operations };
}
