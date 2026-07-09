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
}

export interface ObsidianExportOptions {
  projectRoot: string;
  outRoot: string;
  force: boolean;
  includePluginRecipes: boolean;
}

export interface ObsidianExportResult {
  vaultRoot: string;
  files: ObsidianGeneratedFile[];
}
