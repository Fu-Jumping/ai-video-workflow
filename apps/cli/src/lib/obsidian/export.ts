import fs from "fs-extra";
import path from "node:path";

import { renderBaseFiles } from "./bases.js";
import { renderShotPipelineCanvas, renderWorkflowCanvas } from "./canvas.js";
import { renderDashboardFiles } from "./dashboard.js";
import { renderGeneratedWorkflowNote, workflowVaultPath } from "./markdown.js";
import { sourcePathToFsPath } from "./paths.js";
import { scanProjectForObsidian } from "./scan.js";
import type { ObsidianExportOptions, ObsidianExportResult, ObsidianGeneratedFile } from "./types.js";

async function assertSafeOutput(projectRoot: string, outRoot: string, force: boolean): Promise<void> {
  const resolvedProject = path.resolve(projectRoot);
  const resolvedOut = path.resolve(outRoot);
  if (resolvedOut === resolvedProject) {
    throw new Error("Obsidian export output cannot be the project root");
  }
  if (path.parse(resolvedOut).root === resolvedOut || resolvedProject.startsWith(`${resolvedOut}${path.sep}`)) {
    throw new Error("Obsidian export output must be a dedicated directory, not a filesystem root or project parent");
  }
  if (!(await fs.pathExists(resolvedOut))) {
    return;
  }
  const entries = await fs.readdir(resolvedOut);
  if (entries.length === 0) {
    return;
  }
  if (!force) {
    throw new Error("Obsidian export output directory is not empty. Pass --force to overwrite it.");
  }
  await fs.remove(resolvedOut);
}

async function writeGeneratedFiles(outRoot: string, files: ObsidianGeneratedFile[]): Promise<void> {
  for (const file of files) {
    const fullPath = path.join(outRoot, ...file.vaultPath.split("/"));
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, file.content, "utf8");
  }
}

export async function exportObsidianVault(options: ObsidianExportOptions): Promise<ObsidianExportResult> {
  const projectRoot = path.resolve(options.projectRoot);
  const outRoot = path.resolve(options.outRoot);
  await assertSafeOutput(projectRoot, outRoot, options.force);
  await fs.ensureDir(outRoot);

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
    renderShotPipelineCanvas(sourceFiles)
  ];
  await writeGeneratedFiles(outRoot, files);
  return { vaultRoot: outRoot, files };
}
