import fs from "node:fs";
import path from "node:path";

export function resolveRepoRoot(fromDir: string): string {
  let current = path.resolve(fromDir);

  while (true) {
    if (fs.existsSync(path.join(current, "packs", "official-ai-video", "pack.yaml"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`Unable to resolve ai-video-workflow repository root from ${fromDir}`);
    }
    current = parent;
  }
}

export function resolvePackRoot(repoRoot: string, pack = "official-ai-video"): string {
  return path.join(repoRoot, "packs", pack);
}
