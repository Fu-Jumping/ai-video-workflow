export type ObsidianSourceKind =
  | "concept"
  | "setting"
  | "storyboard"
  | "image-prompt"
  | "video-prompt"
  | "execution-plan"
  | "index";

export interface ObsidianSourceFile {
  sourcePath: string;
  sourceKind: ObsidianSourceKind;
  step: number;
  title: string;
  shotId?: string;
}

export interface ObsidianGeneratedFile {
  vaultPath: string;
  content: string;
  sourcePath?: string;
  sourceContent?: string;
}

export type ObsidianExportOperationStatus =
  | "created"
  | "updated"
  | "unchanged"
  | "skipped-user-modified"
  | "skipped-user-config-existing"
  | "orphaned-generated";

export interface ObsidianExportOperation {
  status: ObsidianExportOperationStatus;
  vaultPath: string;
  sourcePath?: string;
  reason?: string;
}

export interface ObsidianProjectionManifestEntry {
  vaultPath: string;
  contentHash: string;
  sourcePath?: string;
  sourceContentHash?: string;
}

export interface ObsidianProjectionManifest {
  schemaVersion: 1 | 2;
  generator: "ai-video-workflow";
  generatedAt: string;
  projectName: string;
  projectRoot: string;
  projectRootRelativePath?: string;
  viewMode?: "external-vault" | "in-project-view";
  files: ObsidianProjectionManifestEntry[];
}

export interface ObsidianExportOptions {
  projectRoot: string;
  outRoot: string;
  force: boolean;
  includePluginRecipes: boolean;
  includeObsidianUi?: boolean;
  dryRun?: boolean;
}

export interface ObsidianExportResult {
  vaultRoot: string;
  manifestPath: string;
  files: ObsidianGeneratedFile[];
  operations: ObsidianExportOperation[];
}
