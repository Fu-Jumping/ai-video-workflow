import path from "node:path";

export function toVaultPath(value: string): string {
  return value.replace(/\\/g, "/").split(path.sep).join("/");
}

export function sanitizeVaultFileName(value: string): string {
  return value.replace(/[<>:"/\\|?*]+/g, "-").replace(/\s+/g, " ").trim();
}

export function sourcePathToFsPath(projectRoot: string, sourcePath: string): string {
  return path.join(projectRoot, ...sourcePath.split("/"));
}
