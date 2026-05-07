import fs from "fs-extra";
import path from "node:path";

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
  const packRoot = path.join(targetRoot, packName);
  await fs.ensureDir(path.join(packRoot, "checks"));
  await fs.ensureDir(path.join(packRoot, "templates", "06_execution_plan"));
  await fs.writeFile(
    path.join(packRoot, "pack.yaml"),
    ["name: " + packName, "version: 0.1.0", "displayName: " + packName].join("\n"),
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
