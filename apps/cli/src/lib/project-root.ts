import fs from "fs-extra";
import path from "node:path";

import { STEP_DIRS } from "./constants.js";
import { CliUserError } from "./cli-errors.js";
import { readProjectConfig } from "./project-config.js";
import type { ProjectConfig, VerificationIssue } from "./types.js";

function samePath(left: string, right: string): boolean {
  const resolvedLeft = path.resolve(left);
  const resolvedRight = path.resolve(right);
  return process.platform === "win32" ? resolvedLeft.toLowerCase() === resolvedRight.toLowerCase() : resolvedLeft === resolvedRight;
}

function isInsidePath(child: string, parent: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export async function assertExistingDirectory(targetPath: string, label: string): Promise<void> {
  if (!(await fs.pathExists(targetPath))) {
    throw new CliUserError(`${label} does not exist: ${targetPath}`);
  }
  const stat = await fs.stat(targetPath);
  if (!stat.isDirectory()) {
    throw new CliUserError(`${label} must be a directory: ${targetPath}`);
  }
}

export async function findContainingProjectRoot(startPath: string): Promise<string | null> {
  let current = path.resolve(startPath);
  if ((await fs.pathExists(current)) && (await fs.stat(current)).isFile()) {
    current = path.dirname(current);
  }
  while (true) {
    if (await fs.pathExists(path.join(current, "project.config.yaml"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export async function isToolRepositoryRoot(targetPath: string): Promise<boolean> {
  const packageJsonPath = path.join(targetPath, "package.json");
  if (!(await fs.pathExists(packageJsonPath))) {
    return false;
  }
  try {
    const packageJson = await fs.readJson(packageJsonPath) as { name?: string };
    return (
      packageJson.name === "ai-video-workflow" &&
      (await fs.pathExists(path.join(targetPath, "apps", "cli"))) &&
      (await fs.pathExists(path.join(targetPath, "packs", "official-ai-video")))
    );
  } catch {
    return false;
  }
}

export function isSourceSubtree(targetPath: string, repoRoot: string): boolean {
  const sourceRoots = ["apps", "packs", "scaffolds", "schemas", "docs"].map((dir) => path.join(repoRoot, dir));
  return sourceRoots.some((sourceRoot) => samePath(targetPath, sourceRoot) || isInsidePath(targetPath, sourceRoot));
}

export async function readWorkflowProjectConfig(projectRoot: string): Promise<ProjectConfig> {
  await assertExistingDirectory(projectRoot, "Project root");
  const { config, issues } = await readProjectConfig(projectRoot);
  if (!config) {
    const issue = issues[0];
    throw new CliUserError(issue?.message ?? `Project root is missing valid project.config.yaml: ${projectRoot}`);
  }
  for (const stepDir of STEP_DIRS) {
    const fullPath = path.join(projectRoot, stepDir);
    if (!(await fs.pathExists(fullPath)) || !(await fs.stat(fullPath)).isDirectory()) {
      throw new CliUserError(`Project root is missing Step directory: ${stepDir}`);
    }
  }
  return config;
}

export async function assertCanSyncProject(projectRoot: string, repoRoot: string): Promise<void> {
  if (await isToolRepositoryRoot(projectRoot)) {
    throw new CliUserError("Sync target is the ai-video-workflow tool repository, not a creative project.");
  }
  if (isSourceSubtree(projectRoot, repoRoot)) {
    throw new CliUserError("Sync target is inside the ai-video-workflow source tree. Choose a generated creative project root.");
  }
  await readWorkflowProjectConfig(projectRoot);
}

export async function assertCanInitializeProject(targetRoot: string, projectName: string): Promise<string> {
  const containingProject = await findContainingProjectRoot(targetRoot);
  if (containingProject) {
    throw new CliUserError(`Refusing to create a nested project inside existing ai-video-workflow project: ${containingProject}`);
  }

  const projectRoot = path.join(targetRoot, projectName);
  if (!(await fs.pathExists(projectRoot))) {
    return projectRoot;
  }

  const stat = await fs.stat(projectRoot);
  if (!stat.isDirectory()) {
    throw new CliUserError(`Project target already exists but is not a directory: ${projectRoot}`);
  }
  if (await fs.pathExists(path.join(projectRoot, ".git"))) {
    throw new CliUserError(`Project target contains .git and will not be initialized in place: ${projectRoot}`);
  }
  if (await fs.pathExists(path.join(projectRoot, "project.config.yaml"))) {
    throw new CliUserError(`Project target is already an ai-video-workflow project. Use verify, doctor, or sync instead: ${projectRoot}`);
  }
  const entries = await fs.readdir(projectRoot);
  if (entries.length > 0) {
    throw new CliUserError(`Project target is not empty. Choose an empty directory or a new project name: ${projectRoot}`);
  }
  return projectRoot;
}

export async function projectRootIssues(projectRoot: string): Promise<VerificationIssue[]> {
  if (!(await fs.pathExists(projectRoot))) {
    return [{ code: "missing-project-root", message: "Project root does not exist", path: projectRoot }];
  }
  const stat = await fs.stat(projectRoot);
  if (!stat.isDirectory()) {
    return [{ code: "project-root-not-directory", message: "Project root must be a directory", path: projectRoot }];
  }
  return [];
}
