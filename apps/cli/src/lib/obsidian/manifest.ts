import crypto from "node:crypto";
import fs from "fs-extra";
import path from "node:path";

import type { ObsidianGeneratedFile, ObsidianProjectionManifest, ObsidianProjectionManifestEntry } from "./types.js";

export const projectionManifestPath = "Projection Manifest.json";

export function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

export function manifestEntryForFile(file: ObsidianGeneratedFile): ObsidianProjectionManifestEntry {
  return {
    vaultPath: file.vaultPath,
    contentHash: hashContent(file.content),
    sourcePath: file.sourcePath
  };
}

export async function readProjectionManifest(vaultRoot: string): Promise<ObsidianProjectionManifest | null> {
  const manifestFile = path.join(vaultRoot, projectionManifestPath);
  if (!(await fs.pathExists(manifestFile))) {
    return null;
  }
  return (await fs.readJson(manifestFile)) as ObsidianProjectionManifest;
}

export function renderProjectionManifest(manifest: ObsidianProjectionManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
