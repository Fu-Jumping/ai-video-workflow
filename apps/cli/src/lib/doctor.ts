import type { VerificationIssue } from "./types.js";
import { sharedAgentDocsDir, sharedAgentEntryMergeBlock } from "./agent-workspace.js";

const groups: Record<string, string> = {
  "missing-project-root": "Project Root",
  "project-root-not-directory": "Project Root",
  "invalid-sync-target": "Project Root",
  "nested-project": "Project Root",
  "missing-step0-file": "Step 0 Research",
  "invalid-research-source-id": "Step 0 Research",
  "research-sensitive-auth-material": "Step 0 Research",
  "missing-step6-file": "Structure",
  "missing-step7-file": "Structure",
  "missing-step7-source-highlights": "Step 7 Contract",
  "missing-step7-platform-section": "Step 7 Contract",
  "missing-step7-avoid-section": "Step 7 Contract",
  "invalid-step7-overview": "Step 7 Contract",
  "missing-config": "Structure",
  "invalid-project-config": "Configuration",
  "invalid-project-config-yaml": "Configuration",
  "invalid-export-project": "Obsidian Projection",
  "missing-image-default-platform": "Configuration",
  "missing-video-default-platform": "Configuration",
  "missing-step4-section": "Step 4 Contract",
  "step4-forbidden-text": "Step 4 Contract",
  "step4-avoid-double-prefix": "Step 4 Contract",
  "step4-quick-guide-meta-language": "Step 4 Contract",
  "missing-step4-platform-execution-setting": "Step 4 Midjourney",
  "invalid-step4-midjourney-parameter": "Step 4 Midjourney",
  "step4-midjourney-prompt-too-long": "Step 4 Midjourney",
  "invalid-step4-midjourney-style-parameter": "Step 4 Midjourney",
  "invalid-step4-midjourney-stylize-range": "Step 4 Midjourney",
  "invalid-step4-midjourney-chinese-length": "Step 4 Midjourney",
  "invalid-step4-midjourney-copyable-language": "Step 4 Midjourney",
  "step5-generic-negative-only": "Step 5 Contract",
  "step5-forbidden-image-platform-parameter": "Step 5 Contract",
  "missing-step5-platform-execution-setting": "Step 5 Contract",
  "invalid-step5-contract": "Step 5 Contract",
  "missing-shot-group": "Shot Graph",
  "duplicate-shot-id": "Shot Graph",
  "shot-group-mismatch": "Shot Graph",
  "invalid-storyboard-segment-count": "Shot Graph",
  "invalid-keyframe-mapping": "Shot Graph",
  "absolute-path-link": "Links",
  "broken-relative-link": "Links",
  "missing-ide-runtime": "IDE Runtime",
  "missing-shared-agent-entry": "Shared Agent Workspace",
  "invalid-shared-agent-entry": "Shared Agent Workspace",
  "shared-agent-entry-needs-merge": "Shared Agent Workspace",
  "missing-shared-agent-doc": "Shared Agent Workspace",
  "invalid-shared-agent-doc": "Shared Agent Workspace",
  "agent-runtime-conflict": "Shared Agent Workspace",
  "missing-step3-step4-link": "Traceability",
  "broken-step3-step4-link": "Traceability",
  "undeclared-reference-asset": "Traceability",
  "missing-obsidian-dashboard": "Obsidian Projection",
  "invalid-obsidian-dashboard": "Obsidian Projection",
  "missing-obsidian-base": "Obsidian Projection",
  "missing-obsidian-base-view": "Obsidian Projection",
  "invalid-obsidian-base-yaml": "Obsidian Projection",
  "invalid-obsidian-canvas-json": "Obsidian Projection",
  "invalid-obsidian-shot-review": "Obsidian Projection",
  "invalid-obsidian-agent-handoff": "Obsidian Projection",
  "invalid-obsidian-ui-config": "Obsidian Projection",
  "missing-obsidian-source-path": "Obsidian Projection",
  "broken-obsidian-source-path": "Obsidian Projection",
  "obsidian-absolute-link": "Obsidian Projection",
  "missing-obsidian-manifest": "Obsidian Projection",
  "invalid-obsidian-manifest": "Obsidian Projection",
  "missing-obsidian-manifest-file": "Obsidian Projection",
  "obsidian-manifest-hash-mismatch": "Obsidian Projection",
  "obsidian-manifest-source-mismatch": "Obsidian Projection",
  "obsidian-view-stale": "Obsidian Projection",
  "unsafe-obsidian-force-target": "Obsidian Projection"
};

function ideForRuntimeIssue(issue: VerificationIssue): string {
  const marker = `${issue.path ?? ""} ${issue.message}`;
  if (marker.includes(".cursor/")) {
    return "cursor";
  }
  if (marker.includes(".claude/") || marker.includes("CLAUDE.md") || marker.includes("Claude Code")) {
    return "claude-code";
  }
  if (marker.includes(".trae/") || marker.includes("Trae")) {
    return "trae";
  }
  return "codex";
}

export async function diagnoseProject({
  issues,
  defaultVideoPlatform = "seedance"
}: {
  issues: VerificationIssue[];
  defaultVideoPlatform?: string;
}): Promise<string> {
  const byGroup = new Map<string, VerificationIssue[]>();
  for (const issue of issues) {
    const group = groups[issue.code] ?? "Other";
    const bucket = byGroup.get(group) ?? [];
    bucket.push(issue);
    byGroup.set(group, bucket);
  }
  const lines: string[] = ["# Doctor Report", ""];
  for (const [group, bucket] of byGroup.entries()) {
    lines.push(`## ${group}`, "");
    for (const issue of bucket) {
      lines.push(`- ${issue.message}${issue.path ? ` (${issue.path})` : ""}`);
      if (issue.code === "missing-project-root") {
        lines.push("  Choose an existing creative project directory, or create one first with `ai-video-workflow init` from a clean parent directory.");
      }
      if (issue.code === "project-root-not-directory") {
        lines.push("  Pass the project directory path, not a file path.");
      }
      if (issue.code === "invalid-sync-target") {
        lines.push("  Run `sync` only on an existing ai-video-workflow creative project, not the tool repository or source tree.");
      }
      if (issue.code === "nested-project") {
        lines.push("  Move the nested project out to its own parent directory. Do not keep one ai-video-workflow project inside another.");
      }
      if (issue.code === "missing-config") {
        lines.push("  If this is a new project, create it in a clean parent directory with `ai-video-workflow init`. If files already exist here, inspect them before initializing.");
      }
      if (issue.code === "invalid-project-config" || issue.code === "invalid-project-config-yaml") {
        lines.push("  Fix `project.config.yaml` so it uses the official pack, a supported IDE, supported default platforms, and `workflow.enhanced_flow.enabled: true` or `false`.");
      }
      if (issue.code === "invalid-export-project") {
        lines.push("  Restore the missing project Step directories, then run `verify` before exporting or verifying the Obsidian projection.");
      }
      if (issue.code === "missing-image-default-platform") {
        lines.push("  Add `platforms.image.default` to `project.config.yaml`.");
      }
      if (issue.code === "missing-video-default-platform") {
        lines.push("  Add `platforms.video.default` to `project.config.yaml`.");
      }
      if (issue.code === "absolute-path-link") {
        lines.push("  Replace the link with a relative path.");
      }
      if (issue.code === "broken-relative-link") {
        lines.push("  Fix the Markdown link so its target exists relative to the referencing file, or use a backtick path text instead of a Markdown link.");
      }
      if (issue.code === "undeclared-reference-asset") {
        lines.push("  Align the Step 3/4/5 reference asset name with the Step 2 declaration (角色设定/场景设定): rename the @xx三视图/@xx场景图 token or update Step 2 to declare the same name.");
      }
      if (issue.code === "missing-step6-file") {
        lines.push("  Restore the missing Step 6 execution plan file.");
      }
      if (issue.code === "missing-step7-file") {
        lines.push("  Restore the missing Step 7 publish material file, or remove the 07_发布物料 directory if this project does not do multi-platform publishing.");
      }
      if (issue.code === "missing-step7-source-highlights") {
        lines.push("  在 Step 7 物料文件补 `## 来源亮点`，用相对路径引用 Step 1 故事内核与 Step 3 分镜高光。");
      }
      if (issue.code === "missing-step7-platform-section") {
        lines.push("  在 Step 7 物料文件补至少一个 `## 平台名` 区块（抖音/快手、B站、小红书、视频号、YouTube）。");
      }
      if (issue.code === "missing-step7-avoid-section") {
        lines.push("  在 Step 7 物料文件末尾补 `## 避免:` / `## 避免：`，列出不得出现的内部代号与编造卖点。");
      }
      if (issue.code === "invalid-step7-overview") {
        lines.push("  在 `00_发布总表.md` 补齐 `## 一、平台清单与规格` 与 `## 四、发布前核对清单`。");
      }
      if (issue.code === "missing-step0-file") {
        lines.push("  Restore the missing Step 0 research template file, or set `workflow.research_step.enabled: false` only if this project starts from a complete script.");
      }
      if (issue.code === "invalid-research-source-id") {
        lines.push("  Rename the research source directory to the stable `SRC-0001` format.");
      }
      if (issue.code === "research-sensitive-auth-material") {
        lines.push("  Remove cookies, tokens, account data, private messages, or browser login state from project text files. Keep them only in ignored local runtime/profile storage.");
      }
      if (issue.code === "missing-step4-section") {
        lines.push("  恢复步骤四必需段落：`快速导读`、`中文完整版本`、`可复制提示词`，并补齐 `避免：`。");
      }
      if (issue.code === "step4-forbidden-text") {
        lines.push("  Replace inherited or context-dependent wording with a self-contained visual prompt.");
      }
      if (issue.code === "missing-step4-platform-execution-setting") {
        lines.push("  在 Step 4 文件补齐 `## 平台执行参数`，并显式写入 `midjourney`、`--v 8.2`、`--ar` 及 `--style raw`。");
      }
      if (issue.code === "invalid-step4-midjourney-parameter") {
        lines.push("  从 Step 4 可复制提示词和平台执行参数中移除 V8 不支持的参数：`--cref`、`--cw`、`--q`、`::`。");
      }
      if (issue.code === "step4-midjourney-prompt-too-long") {
        lines.push("  将 Step 4 可复制提示词正文（去掉 `避免` 段后）压缩到 1024 字符以内。");
      }
      if (issue.code === "invalid-step4-midjourney-style-parameter") {
        lines.push("  在 Step 4 `平台执行参数` 的 `风格参数` 使用 `--style raw`（工作区统一写法），不要写 `--style rawx` 等变体。");
      }
      if (issue.code === "invalid-step4-midjourney-stylize-range") {
        lines.push("  将 Step 4 `平台执行参数` 的 stylize 数值调整到 0-1000 范围内。");
      }
      if (issue.code === "invalid-step4-midjourney-chinese-length") {
        lines.push("  将 Step 4 `中文完整版本` 正文扩充到至少 180 个非空白字符。");
      }
      if (issue.code === "invalid-step4-midjourney-copyable-language") {
        lines.push("  将 Step 4 `可复制提示词` 改为英文正文；中文完整版本保留中文，二者语义保持一致。");
      }
      if (issue.code === "step5-forbidden-image-platform-parameter") {
        lines.push("  从 Step 5 文件中移除图片平台参数（如 `--v 8.2`、`--ar`、`--style raw`、`--stylize`）；Step 5 只写视频平台执行设置。");
      }
      if (issue.code === "missing-step5-platform-execution-setting") {
        if (defaultVideoPlatform === "seedance") {
          lines.push("  在对应 Step 5 文件的 `平台执行设置` 补齐 Seedance 2.0 全能参考模式、目标时长、画幅、参考素材、素材上传顺序和负面约束，并与 `project.config.yaml` 的默认视频平台 `platforms.video.default` 保持一致；不要写密钥、账号、绝对路径或平台缓存。");
        } else {
          lines.push(`  在对应 Step 5 文件的 \`平台执行设置\` 补齐默认视频平台名（${defaultVideoPlatform}，与 \`project.config.yaml\` 的 \`platforms.video.default\` 一致）、目标时长、画幅、参考素材、素材上传顺序和负面约束；非 seedance 平台不需要写 \`Seedance 2.0\` 或 \`全能参考模式\`。不要写密钥、账号、绝对路径或平台缓存。`);
        }
      }
      if (issue.code === "invalid-step5-contract") {
        lines.push("  按 `元信息 / 平台执行设置 / 参考素材映射 / 可复制提示词 / 负面约束` 重建文件；镜头段从 `镜头1：` 连续编号，并在全局收束中显式写 `无配乐、无字幕`。");
      }
      if (issue.code === "missing-shot-group") {
        lines.push("  把 Step 3/4/5 镜头文件移动到匹配的 `镜头组-001/`，并在 Step 3 组目录补 `00_镜头组说明.md`。");
      }
      if (issue.code === "duplicate-shot-id" || issue.code === "shot-group-mismatch") {
        lines.push("  保证镜头编号在项目内全局唯一，并让同一镜头的 Step 3/4/5 文件位于同一个镜头组。");
      }
      if (issue.code === "invalid-storyboard-segment-count") {
        lines.push("  在 Step 3 使用 1-4 个从 `分镜 1` 开始连续编号的分镜；默认 1-2 个，复杂内容最多 4 个。");
      }
      if (issue.code === "invalid-keyframe-mapping") {
        lines.push("  使用 `镜头-001-关键帧-01.md`，在 Step 4 元信息写清镜头组、镜头编号、对应分镜和关键时刻，并让 Step 3 链接全部已选关键帧。");
      }
      if (issue.code === "missing-ide-runtime") {
        const ide = ideForRuntimeIssue(issue);
        lines.push(`  Run \`ai-video-workflow sync --project <path> --ide ${ide}\` to restore the IDE runtime files.`);
      }
      if (issue.code === "missing-shared-agent-entry" || issue.code === "missing-shared-agent-doc") {
        lines.push("  Run `ai-video-workflow sync --project <path> --ide <id>` to create the shared agent workspace files.");
      }
      if (issue.code === "invalid-shared-agent-entry" || issue.code === "invalid-shared-agent-doc") {
        lines.push("  Merge the shared ai-video-workflow markers into the existing user-owned file; do not overwrite local instructions blindly.");
      }
      if (issue.code === "shared-agent-entry-needs-merge") {
        lines.push("  Keep the existing `AGENTS.md`; merge this ai-video-workflow block into it:");
        lines.push("");
        lines.push("  ```md");
        for (const line of sharedAgentEntryMergeBlock().split("\n")) {
          lines.push(`  ${line}`);
        }
        lines.push("  ```");
        lines.push("  Do not copy Cherry Studio private memory, tokens, local paths, or platform caches into project truth.");
      }
      if (issue.code === "agent-runtime-conflict") {
        lines.push(`  Regenerate the platform runtime mirror with \`ai-video-workflow sync --project <path> --ide <id>\`, then keep platform-specific rules aligned with \`AGENTS.md\` and \`${sharedAgentDocsDir}/\`.`);
      }
      if (issue.code === "missing-step3-step4-link") {
        lines.push("  Add a relative link from the storyboard card to the matching Step 4 image prompt.");
      }
      if (issue.code === "broken-step3-step4-link") {
        lines.push("  Fix the Step 4 link target or create the referenced image prompt file.");
      }
      if (issue.code === "missing-obsidian-dashboard" || issue.code === "missing-obsidian-base") {
        lines.push("  Rerun `ai-video-workflow export-obsidian --project <path> --in-project-view --force`, or export again to the external vault with `--out <vault>`.");
      }
      if (issue.code === "invalid-obsidian-dashboard" || issue.code === "missing-obsidian-base-view") {
        lines.push("  Regenerate the Obsidian projection with `ai-video-workflow export-obsidian --project <path> --in-project-view` so the review dashboards and Bases views match the current exporter.");
      }
      if (issue.code === "invalid-obsidian-canvas-json") {
        lines.push("  Regenerate the Obsidian projection with `ai-video-workflow export-obsidian --project <path> --in-project-view`; do not hand-edit generated Canvas JSON.");
      }
      if (issue.code === "invalid-obsidian-shot-review") {
        lines.push("  Regenerate the Obsidian projection with `ai-video-workflow export-obsidian --project <path> --in-project-view` so each `02_按镜头联查/单镜头/` page and `02_按镜头联查/逐镜头审阅画布/` canvas matches the current single-shot review format.");
      }
      if (issue.code === "invalid-obsidian-agent-handoff") {
        lines.push("  Regenerate the Obsidian projection with `ai-video-workflow export-obsidian --project <path> --in-project-view` so `03_审阅工具/01_智能体交接.md` and each `02_按镜头联查/单镜头/` page expose copy-ready agent context. Edit source Step files, not generated projection files.");
      }
      if (issue.code === "invalid-obsidian-ui-config") {
        lines.push("  Delete or regenerate `.obsidian/ai-video-workflow-suggested/`; these files are optional UI suggestions, not project truth.");
      }
      if (issue.code === "invalid-obsidian-base-yaml") {
        lines.push("  Regenerate the Obsidian projection with `ai-video-workflow export-obsidian --project <path> --in-project-view`; do not hand-edit generated `.base` YAML.");
      }
      if (issue.code === "missing-obsidian-source-path" || issue.code === "broken-obsidian-source-path") {
        lines.push("  Regenerate the projection with `ai-video-workflow export-obsidian --project <path> --in-project-view` so each generated note records a valid relative `源文件路径`.");
      }
      if (issue.code === "obsidian-absolute-link") {
        lines.push("  Replace the Obsidian projection link with a vault-relative path or regenerate the projection with `ai-video-workflow export-obsidian --project <path> --in-project-view`.");
      }
      if (issue.code === "missing-obsidian-manifest" || issue.code === "invalid-obsidian-manifest" || issue.code === "missing-obsidian-manifest-file") {
        lines.push("  Rerun `ai-video-workflow export-obsidian --project <path> --in-project-view` to refresh the projection manifest, or use `--out <vault>` for an external vault.");
      }
      if (issue.code === "obsidian-manifest-hash-mismatch") {
        lines.push("  Review the modified generated file, move user notes into `04_个人笔记/`, then rerun `ai-video-workflow export-obsidian --project <path> --in-project-view` or use `--force` for a clean rebuild.");
      }
      if (issue.code === "obsidian-manifest-source-mismatch") {
        lines.push("  Regenerate the projection with `ai-video-workflow export-obsidian --project <path> --in-project-view` and confirm each manifest `sourcePath` points to a project-relative Step file.");
      }
      if (issue.code === "obsidian-view-stale") {
        lines.push("  Rerun `ai-video-workflow export-obsidian --project <path> --in-project-view` or export again to the external vault path.");
      }
      if (issue.code === "unsafe-obsidian-force-target") {
        lines.push("  Do not use `--force` on an Obsidian output directory that contains `.git`. Use incremental export, or remove the nested repository manually only if that repository is intentional and backed up.");
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}
