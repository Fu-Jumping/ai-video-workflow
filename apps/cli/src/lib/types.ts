export type Ide = "codex" | "cursor" | "claude-code" | "trae";

export type Platform = "openai" | "veo" | "runway" | "luma" | "minimax";

export type IssueCode =
  | "missing-config"
  | "missing-image-default-platform"
  | "missing-video-default-platform"
  | "missing-step6-file"
  | "missing-step4-section"
  | "absolute-path-link"
  | "step4-forbidden-text"
  | "missing-ide-runtime"
  | "missing-step3-step4-link"
  | "broken-step3-step4-link"
  | "missing-obsidian-dashboard"
  | "missing-obsidian-base"
  | "invalid-obsidian-base-yaml"
  | "invalid-obsidian-canvas-json"
  | "missing-obsidian-source-path"
  | "broken-obsidian-source-path"
  | "obsidian-absolute-link";

export interface ProjectConfig {
  pack: string;
  ide: Ide;
  platforms: {
    image: { default: Platform };
    video: { default: Platform };
  };
  workflow: {
    enhanced_flow: {
      enabled: boolean;
    };
  };
}

export interface CreateProjectOptions {
  targetRoot: string;
  projectName: string;
  pack: string;
  ide: Ide;
  imagePlatform: Platform;
  videoPlatform: Platform;
}

export interface SyncProjectOptions {
  repoRoot: string;
  projectRoot: string;
  pack: string;
  ide: Ide;
}

export interface VerificationIssue {
  code: IssueCode;
  message: string;
  path?: string;
}

export interface VerificationResult {
  ok: boolean;
  issues: VerificationIssue[];
}
