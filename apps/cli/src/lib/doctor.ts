import type { VerificationIssue } from "./types.js";

const groups: Record<string, string> = {
  "missing-step6-file": "Structure",
  "missing-config": "Structure",
  "missing-image-default-platform": "Configuration",
  "missing-video-default-platform": "Configuration",
  "missing-step4-section": "Step 4 Contract",
  "step4-forbidden-text": "Step 4 Contract",
  "absolute-path-link": "Links",
  "missing-ide-runtime": "IDE Runtime",
  "missing-step3-step4-link": "Traceability",
  "broken-step3-step4-link": "Traceability",
  "missing-obsidian-dashboard": "Obsidian Projection",
  "invalid-obsidian-dashboard": "Obsidian Projection",
  "missing-obsidian-base": "Obsidian Projection",
  "missing-obsidian-base-view": "Obsidian Projection",
  "invalid-obsidian-base-yaml": "Obsidian Projection",
  "invalid-obsidian-canvas-json": "Obsidian Projection",
  "invalid-obsidian-shot-review": "Obsidian Projection",
  "invalid-obsidian-ui-config": "Obsidian Projection",
  "missing-obsidian-source-path": "Obsidian Projection",
  "broken-obsidian-source-path": "Obsidian Projection",
  "obsidian-absolute-link": "Obsidian Projection",
  "missing-obsidian-manifest": "Obsidian Projection",
  "invalid-obsidian-manifest": "Obsidian Projection",
  "missing-obsidian-manifest-file": "Obsidian Projection",
  "obsidian-manifest-hash-mismatch": "Obsidian Projection",
  "obsidian-manifest-source-mismatch": "Obsidian Projection"
};

export async function diagnoseProject({
  issues
}: {
  issues: VerificationIssue[];
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
      if (issue.code === "missing-config") {
        lines.push("  Create `project.config.yaml` or rerun `ai-video-workflow init`.");
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
      if (issue.code === "missing-step6-file") {
        lines.push("  Restore the missing Step 6 execution plan file.");
      }
      if (issue.code === "missing-step4-section") {
        lines.push("  Restore the Step 4 sections: `快速导读`, `中文完整版本`, and `English Version (Copy Ready)`, plus `避免:` and `Avoid:`.");
      }
      if (issue.code === "step4-forbidden-text") {
        lines.push("  Replace inherited or context-dependent wording with a self-contained visual prompt.");
      }
      if (issue.code === "missing-ide-runtime") {
        lines.push("  Run `ai-video-workflow sync --project <path> --ide codex` to restore the IDE runtime files.");
      }
      if (issue.code === "missing-step3-step4-link") {
        lines.push("  Add a relative link from the storyboard card to the matching Step 4 image prompt.");
      }
      if (issue.code === "broken-step3-step4-link") {
        lines.push("  Fix the Step 4 link target or create the referenced image prompt file.");
      }
      if (issue.code === "missing-obsidian-dashboard" || issue.code === "missing-obsidian-base") {
        lines.push("  Rerun `ai-video-workflow export-obsidian --project <path> --out <vault> --force`.");
      }
      if (issue.code === "invalid-obsidian-dashboard" || issue.code === "missing-obsidian-base-view") {
        lines.push("  Regenerate the Obsidian projection so the review dashboards and Bases views match the current exporter.");
      }
      if (issue.code === "invalid-obsidian-canvas-json") {
        lines.push("  Regenerate the Obsidian projection with `export-obsidian`; do not hand-edit generated Canvas JSON.");
      }
      if (issue.code === "invalid-obsidian-shot-review") {
        lines.push("  Regenerate the Obsidian projection so each `Shots/` page and `Canvas/Shot Reviews/` canvas matches the current single-shot review format.");
      }
      if (issue.code === "invalid-obsidian-ui-config") {
        lines.push("  Delete or regenerate `.obsidian/ai-video-workflow-suggested/`; these files are optional UI suggestions, not project truth.");
      }
      if (issue.code === "invalid-obsidian-base-yaml") {
        lines.push("  Regenerate the Obsidian projection with `export-obsidian`; do not hand-edit generated `.base` YAML.");
      }
      if (issue.code === "missing-obsidian-source-path" || issue.code === "broken-obsidian-source-path") {
        lines.push("  Regenerate the projection so each generated note records a valid relative `source_path`.");
      }
      if (issue.code === "obsidian-absolute-link") {
        lines.push("  Replace the Obsidian projection link with a vault-relative path or regenerate the projection.");
      }
      if (issue.code === "missing-obsidian-manifest" || issue.code === "invalid-obsidian-manifest" || issue.code === "missing-obsidian-manifest-file") {
        lines.push("  Rerun `ai-video-workflow export-obsidian --project <path> --out <vault>` to refresh the projection manifest.");
      }
      if (issue.code === "obsidian-manifest-hash-mismatch") {
        lines.push("  Review the modified generated file, move user notes into `Notes/`, then rerun `export-obsidian` or use `--force` for a clean rebuild.");
      }
      if (issue.code === "obsidian-manifest-source-mismatch") {
        lines.push("  Regenerate the projection and confirm each manifest `sourcePath` points to a project-relative Step file.");
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}
