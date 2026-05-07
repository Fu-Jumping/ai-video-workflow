import fs from "fs-extra";
import path from "node:path";

export async function writeFileIfMissing(filePath: string, content: string): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  if (!(await fs.pathExists(filePath))) {
    await fs.writeFile(filePath, content, "utf8");
  }
}

export async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.copy(src, dest, {
    overwrite: true,
    errorOnExist: false
  });
}
