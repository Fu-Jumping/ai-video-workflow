export type Ide = "codex" | "cursor" | "claude-code" | "trae";

export type AdapterId = Ide | "obsidian" | "mcp" | "cherry-studio";

export type Platform = "openai" | "gpt-image-2" | "veo" | "runway" | "luma" | "minimax" | "seedance" | "midjourney";

export type StartFromMode = "research" | "script";

export type ResearchPlatform =
  | "auto"
  | "bilibili"
  | "douyin"
  | "xiaohongshu"
  | "weibo"
  | "kuaishou"
  | "tieba"
  | "zhihu"
  | "web";

export type ResearchRuntime = "auto" | "toolbox" | "ide-inbox";

export type IssueCode =
  | "missing-project-root"
  | "project-root-not-directory"
  | "invalid-project-config"
  | "invalid-project-config-yaml"
  | "invalid-export-project"
  | "nested-project"
  | "invalid-sync-target"
  | "missing-config"
  | "missing-step0-file"
  | "missing-image-default-platform"
  | "missing-video-default-platform"
  | "missing-step6-file"
  | "missing-step7-file"
  | "missing-step7-source-highlights"
  | "missing-step7-platform-section"
  | "missing-step7-avoid-section"
  | "invalid-step7-overview"
  | "missing-step4-section"
  | "missing-character-triview"
  | "missing-scene-reference-image"
  | "missing-storyboard-reference-assets"
  | "undeclared-reference-asset"
  | "missing-step4-reference-asset"
  | "missing-step4-platform-execution-setting"
  | "missing-step5-reference-asset"
  | "missing-step5-platform-execution-setting"
  | "missing-shot-group"
  | "duplicate-shot-id"
  | "shot-group-mismatch"
  | "invalid-storyboard-segment-count"
  | "invalid-keyframe-mapping"
  | "invalid-step4-midjourney-parameter"
  | "missing-step4-gpt-image-2-platform-setting"
  | "invalid-step4-gpt-image-2-parameter"
  | "invalid-step4-gpt-image-2-copyable-language"
  | "invalid-step5-contract"
  | "invalid-research-source-id"
  | "research-sensitive-auth-material"
  | "invalid-reference-asset-token"
  | "absolute-path-link"
  | "step4-forbidden-text"
  | "step4-avoid-double-prefix"
  | "step4-midjourney-prompt-too-long"
  | "invalid-step4-midjourney-style-parameter"
  | "invalid-step4-midjourney-stylize-range"
  | "invalid-step4-midjourney-chinese-length"
  | "invalid-step4-midjourney-copyable-language"
  | "step4-quick-guide-meta-language"
  | "step5-generic-negative-only"
  | "step5-forbidden-image-platform-parameter"
  | "missing-ide-runtime"
  | "missing-shared-agent-entry"
  | "shared-agent-entry-needs-merge"
  | "invalid-shared-agent-entry"
  | "missing-shared-agent-doc"
  | "invalid-shared-agent-doc"
  | "agent-runtime-conflict"
  | "missing-step3-step4-link"
  | "broken-step3-step4-link"
  | "broken-relative-link"
  | "missing-obsidian-dashboard"
  | "invalid-obsidian-dashboard"
  | "missing-obsidian-base"
  | "missing-obsidian-base-view"
  | "invalid-obsidian-base-yaml"
  | "invalid-obsidian-canvas-json"
  | "invalid-obsidian-shot-review"
  | "invalid-obsidian-agent-handoff"
  | "invalid-obsidian-ui-config"
  | "missing-obsidian-source-path"
  | "broken-obsidian-source-path"
  | "obsidian-absolute-link"
  | "broken-obsidian-markdown-link"
  | "broken-obsidian-markdown-anchor"
  | "missing-obsidian-manifest"
  | "invalid-obsidian-manifest"
  | "missing-obsidian-manifest-file"
  | "obsidian-manifest-hash-mismatch"
  | "obsidian-manifest-source-mismatch"
  | "obsidian-view-stale"
  | "obsidian-vault-not-directory"
  | "unsafe-obsidian-force-target"
  | "invalid-deviations-yaml"
  | "invalid-deviation-entry";

export interface LibTvProjectConfig {
  image_model?: string;
  video_model?: string;
  image_settings?: Record<string, unknown>;
  video_settings?: Record<string, unknown>;
}

export interface ProjectConfig {
  pack: string;
  ide: Ide;
  platforms: {
    image: { default: Platform };
    video: { default: Platform };
  };
  workflow: {
    research_step?: {
      enabled: boolean;
    };
    enhanced_flow: {
      enabled: boolean;
    };
  };
  libtv?: LibTvProjectConfig;
}

export interface CreateProjectOptions {
  targetRoot: string;
  projectName: string;
  pack: string;
  ide: Ide;
  imagePlatform: Platform;
  videoPlatform: Platform;
  startFrom?: StartFromMode;
  force?: boolean;
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

export type WorkflowMode = "standard" | "scene-basis" | "minimal-video" | "hybrid";

export interface WorkflowDeviation {
  rule: string;
  scope?: string;
  reason?: string;
  confirmed_by?: string;
  confirmed_at?: string;
}

export interface WorkflowShotMode {
  id: string;
  mode: WorkflowMode;
  reason?: string;
}

export interface VerificationResult {
  ok: boolean;
  issues: VerificationIssue[];
  acceptedDeviations?: VerificationIssue[];
}
