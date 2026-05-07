import path from "node:path";

export function resolveRepoRoot(fromDir: string): string {
  return path.resolve(fromDir, "../../../../");
}

export function resolvePackRoot(repoRoot: string, pack = "official-ai-video"): string {
  return path.join(repoRoot, "packs", pack);
}
