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
});
