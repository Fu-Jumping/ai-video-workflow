import fs from "fs-extra";
import path from "node:path";

import { CliUserError } from "./cli-errors.js";
import { validateSafeDirectoryName } from "./name-validation.js";
import { isSourceSubtree, isToolRepositoryRoot } from "./project-root.js";

const step6Files = [
  "00_执行计划.md",
  "01_图片执行计划.md",
  "02_视频执行计划.md"
];

const step6TemplateDir = "06_执行计划";

const step7Files = [
  "00_发布总表.md",
  "01_标题.md",
  "02_简介正文.md",
  "03_话题标签.md",
  "04_封面文案.md"
];

const step7TemplateDir = "07_发布物料";

// Guards matching init/sync: refuse the tool repository root outright, and refuse
// the source subtree unless official pack development is explicitly requested via
// --allow-in-tool-repo.
export async function assertCanCreatePackScaffold(
  targetRoot: string,
  repoRoot: string,
  options: { allowInToolRepo?: boolean } = {}
): Promise<void> {
  if (await isToolRepositoryRoot(targetRoot)) {
    throw new CliUserError(
      "Pack target is the ai-video-workflow tool repository, not a pack workspace. Run new-pack from a directory outside the tool repository."
    );
  }
  if (isSourceSubtree(targetRoot, repoRoot) && options.allowInToolRepo !== true) {
    throw new CliUserError(
      "Pack target is inside the ai-video-workflow source tree. Pass --allow-in-tool-repo to explicitly create an official pack scaffold here."
    );
  }
}

export async function createPackScaffold({
  targetRoot,
  packName
}: {
  targetRoot: string;
  packName: string;
}): Promise<void> {
  const safePackName = validateSafeDirectoryName(packName, "Pack name");
  const packRoot = path.join(targetRoot, safePackName);
  if (await fs.pathExists(packRoot)) {
    const stat = await fs.stat(packRoot);
    if (!stat.isDirectory()) {
      throw new CliUserError(`Pack target already exists but is not a directory: ${packRoot}`);
    }
    const entries = await fs.readdir(packRoot);
    if (entries.length > 0) {
      throw new CliUserError(`Pack target is not empty. Choose an empty directory or a new pack name: ${packRoot}`);
    }
  }
  await fs.ensureDir(path.join(packRoot, "checks"));
  await fs.ensureDir(path.join(packRoot, "templates", step6TemplateDir));
  await fs.ensureDir(path.join(packRoot, "templates", step7TemplateDir));
  await fs.writeFile(
    path.join(packRoot, "pack.yaml"),
    ["name: " + safePackName, "version: 0.1.0", "displayName: " + safePackName].join("\n"),
    "utf8"
  );
  await fs.writeFile(path.join(packRoot, "checks", "required-files.yaml"), "requiredFiles: []\n", "utf8");
  await fs.writeFile(path.join(packRoot, "checks", "link-rules.yaml"), "allowAbsolutePaths: false\n", "utf8");
  await fs.writeFile(path.join(packRoot, "checks", "sync-rules.yaml"), "syncTargets: []\n", "utf8");
  await fs.writeFile(path.join(packRoot, "checks", "project-structure.yaml"), "steps: []\n", "utf8");
  for (const file of step6Files) {
    await fs.writeFile(path.join(packRoot, "templates", step6TemplateDir, file), `# ${file}\n`, "utf8");
  }
  for (const file of step7Files) {
    await fs.writeFile(path.join(packRoot, "templates", step7TemplateDir, file), `# ${file}\n`, "utf8");
  }
}
