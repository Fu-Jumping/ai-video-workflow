import { describe, expect, test } from "vitest";

import { diagnoseProject } from "../src/lib/doctor.js";

describe("diagnoseProject", () => {
  test("formats verification issues into grouped remediation guidance", async () => {
    const output = await diagnoseProject({
      issues: [
        {
          code: "missing-step6-file",
          message: "Missing 00_execution_plan.md",
          path: "06_execution_plan"
        },
        {
          code: "absolute-path-link",
          message: "Found absolute path link",
          path: "04_image_prompts/shot-01.md"
        }
      ]
    });

    expect(output).toContain("Structure");
    expect(output).toContain("Links");
    expect(output).toContain("00_execution_plan.md");
    expect(output).toContain("relative path");
  });

  test("suggests sync when codex runtime layers are missing", async () => {
    const output = await diagnoseProject({
      issues: [
        {
          code: "missing-ide-runtime",
          message: "Missing Codex runtime mirror",
          path: ".codex/ai-video-workflow"
        },
        {
          code: "missing-ide-runtime",
          message: "Missing Codex runtime skills",
          path: ".codex/skills"
        }
      ]
    });

    expect(output).toContain("IDE Runtime");
    expect(output).toContain("ai-video-workflow sync --project <path> --ide codex");
    expect(output).toContain(".codex/ai-video-workflow");
    expect(output).toContain(".codex/skills");
  });

  test("suggests the matching sync command for non-Codex adapter runtime issues", async () => {
    const output = await diagnoseProject({
      issues: [
        {
          code: "missing-ide-runtime",
          message: "Missing Cursor rule entry: .cursor/rules/ai-video-workflow.mdc",
          path: ".cursor/rules/ai-video-workflow.mdc"
        },
        {
          code: "missing-ide-runtime",
          message: "Missing Claude Code command entry: .claude/commands/ai-video-workflow.md",
          path: ".claude/commands/ai-video-workflow.md"
        },
        {
          code: "missing-ide-runtime",
          message: "Missing Trae rule entry: .trae/rules/ai-video-workflow.md",
          path: ".trae/rules/ai-video-workflow.md"
        }
      ]
    });

    expect(output).toContain("ai-video-workflow sync --project <path> --ide cursor");
    expect(output).toContain("ai-video-workflow sync --project <path> --ide claude-code");
    expect(output).toContain("ai-video-workflow sync --project <path> --ide trae");
  });

  test("suggests Step 3 to Step 4 traceability fixes", async () => {
    const output = await diagnoseProject({
      issues: [
        {
          code: "broken-step3-step4-link",
          message: "Storyboard file links to missing Step 4 target: missing.md",
          path: "03_storyboard/shot-001.md"
        }
      ]
    });

    expect(output).toContain("Traceability");
    expect(output).toContain("Step 4 link target");
  });

  test("suggests shared agent workspace fixes", async () => {
    const output = await diagnoseProject({
      issues: [
        {
          code: "missing-shared-agent-entry",
          message: "Missing shared agent entry: AGENTS.md",
          path: "AGENTS.md"
        },
        {
          code: "invalid-shared-agent-doc",
          message: "Shared agent doc is missing required ai-video-workflow markers",
          path: "docs/ai-workspace/README.md"
        },
        {
          code: "agent-runtime-conflict",
          message: "Runtime entry does not point to the shared agent workspace",
          path: ".trae/rules/ai-video-workflow.md"
        }
      ]
    });

    expect(output).toContain("Shared Agent Workspace");
    expect(output).toContain("ai-video-workflow sync --project <path> --ide <id>");
    expect(output).toContain("Merge the shared ai-video-workflow markers");
    expect(output).toContain("Regenerate the platform runtime mirror");
  });

  test("suggests a merge block for existing custom AGENTS entries", async () => {
    const output = await diagnoseProject({
      issues: [
        {
          code: "shared-agent-entry-needs-merge",
          message: "Existing AGENTS.md must merge the ai-video-workflow shared entry block",
          path: "AGENTS.md"
        }
      ]
    });

    expect(output).toContain("Keep the existing `AGENTS.md`");
    expect(output).toContain("Marker: ai-video-workflow shared agent entry.");
    expect(output).toContain("project-step-files");
    expect(output).toContain("Cherry Studio");
  });

  test("suggests configuration fixes for missing default platforms", async () => {
    const output = await diagnoseProject({
      issues: [
        {
          code: "missing-video-default-platform",
          message: "Missing video default platform",
          path: "project.config.yaml"
        }
      ]
    });

    expect(output).toContain("Configuration");
    expect(output).toContain("project.config.yaml");
    expect(output).toContain("platforms.video.default");
  });

  test("suggests Obsidian projection fixes", async () => {
    const output = await diagnoseProject({
      issues: [
        {
          code: "invalid-obsidian-canvas-json",
          message: "Canvas JSON is invalid",
          path: "Canvas/Workflow Map.canvas"
        }
      ]
    });

    expect(output).toContain("Obsidian Projection");
    expect(output).toContain("export-obsidian");
  });

  test("suggests Obsidian review dashboard and UI config fixes", async () => {
    const output = await diagnoseProject({
      issues: [
        {
          code: "missing-obsidian-base-view",
          message: "Obsidian base is missing view: Review Queue",
          path: "Bases/Workflow Files.base"
        },
        {
          code: "invalid-obsidian-ui-config",
          message: "Optional Obsidian UI config JSON is invalid",
          path: ".obsidian/ai-video-workflow-suggested/bookmarks.json"
        }
      ]
    });

    expect(output).toContain("review dashboards and Bases views");
    expect(output).toContain("optional UI suggestions");
  });

  test("suggests Obsidian manifest conflict fixes", async () => {
    const output = await diagnoseProject({
      issues: [
        {
          code: "obsidian-manifest-hash-mismatch",
          message: "Manifest hash does not match generated file",
          path: "Workflow/Step 3 - Storyboard/Shot 001 - Storyboard.md"
        }
      ]
    });

    expect(output).toContain("Obsidian Projection");
    expect(output).toContain("Notes/");
    expect(output).toContain("--force");
  });

  test("suggests in-project Obsidian refresh for stale views", async () => {
    const output = await diagnoseProject({
      issues: [
        {
          code: "obsidian-view-stale",
          message: "Obsidian projection is stale for source file: 03_storyboard/shot-001.md",
          path: "Workflow/Step 3 - Storyboard/Shot 001 - Storyboard.md"
        }
      ]
    });

    expect(output).toContain("Obsidian Projection");
    expect(output).toContain("--in-project-view");
    expect(output).toContain("external vault");
  });

  test("suggests Obsidian single-shot review fixes", async () => {
    const output = await diagnoseProject({
      issues: [
        {
          code: "invalid-obsidian-shot-review",
          message: "Shot review canvas is missing or not linked: Canvas/Shot Reviews/shot-001.canvas",
          path: "Shots/shot-001.md"
        }
      ]
    });

    expect(output).toContain("Obsidian Projection");
    expect(output).toContain("single-shot review format");
    expect(output).toContain("Canvas/Shot Reviews/");
  });

  test("suggests Obsidian agent handoff fixes", async () => {
    const output = await diagnoseProject({
      issues: [
        {
          code: "invalid-obsidian-agent-handoff",
          message: "Missing Obsidian agent handoff page: 04_Agent_Handoff.md",
          path: "04_Agent_Handoff.md"
        }
      ]
    });

    expect(output).toContain("Obsidian Projection");
    expect(output).toContain("04_Agent_Handoff.md");
    expect(output).toContain("copy-ready agent context");
    expect(output).toContain("source Step files");
  });
});
