import fs from "fs-extra";
import path from "node:path";

import { CliUserError } from "./cli-errors.js";
import { validateSafeDirectoryName } from "./name-validation.js";

const step6Files = [
  "00_execution_plan.md",
  "01_image_execution_plan.md",
  "02_video_execution_plan.md"
];

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
  await fs.ensureDir(path.join(packRoot, "templates", "06_execution_plan"));
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
    await fs.writeFile(path.join(packRoot, "templates", "06_execution_plan", file), `# ${file}\n`, "utf8");
  }
}
