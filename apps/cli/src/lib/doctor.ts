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
  "broken-step3-step4-link": "Traceability"
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
    }
    lines.push("");
  }
  return lines.join("\n");
}
