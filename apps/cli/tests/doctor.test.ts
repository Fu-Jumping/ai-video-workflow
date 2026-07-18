import { describe, expect, test } from "vitest";

import { diagnoseProject } from "../src/lib/doctor.js";

describe("diagnoseProject", () => {
  test("suggests safe next steps for project root and config issues", async () => {
    const output = await diagnoseProject({
      issues: [
        {
          code: "missing-project-root",
          message: "Project root does not exist",
          path: "missing-project"
        },
        {
          code: "project-root-not-directory",
          message: "Project root must be a directory",
          path: "project.md"
        },
        {
          code: "invalid-project-config",
          message: "Invalid project.config.yaml: ide is invalid",
          path: "project.config.yaml"
        },
        {
          code: "invalid-project-config-yaml",
          message: "project.config.yaml is not valid YAML",
          path: "project.config.yaml"
        },
        {
          code: "nested-project",
          message: "Found nested ai-video-workflow project",
          path: "01_概念策划/child/project.config.yaml"
        }
      ]
    });

    expect(output).toContain("Project Root");
    expect(output).toContain("existing creative project directory");
    expect(output).toContain("not a file path");
    expect(output).toContain("supported IDE");
    expect(output).toContain("Move the nested project out");
  });

  test("formats verification issues into grouped remediation guidance", async () => {
    const output = await diagnoseProject({
      issues: [
        {
          code: "missing-step6-file",
          message: "Missing 00_执行计划.md",
          path: "06_执行计划"
        },
        {
          code: "absolute-path-link",
          message: "Found absolute path link",
          path: "04_图片提示词/shot-01.md"
        }
      ]
    });

    expect(output).toContain("Structure");
    expect(output).toContain("Links");
    expect(output).toContain("00_执行计划.md");
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
          path: "03_分镜脚本/镜头-001.md"
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
          path: "文档/智能体工作区/入口说明.md"
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
    expect(output).toContain("文档/智能体工作区");
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
    expect(output).toContain("标记：ai-video-workflow 共享智能体入口。");
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
          path: "画布/流程图.canvas"
        }
      ]
    });

    expect(output).toContain("Obsidian Projection");
    expect(output).toContain("export-obsidian");
    expect(output).toContain("--in-project-view");
  });

  test("suggests Obsidian review dashboard and UI config fixes", async () => {
    const output = await diagnoseProject({
      issues: [
        {
          code: "missing-obsidian-base-view",
          message: "Obsidian base is missing view: 审阅队列",
          path: "数据表/流程文件.base"
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
          path: "流程/步骤三 - 分镜脚本/镜头 001 - 分镜脚本.md"
        }
      ]
    });

    expect(output).toContain("Obsidian Projection");
    expect(output).toContain("笔记/");
    expect(output).toContain("--force");
    expect(output).toContain("--in-project-view");
  });

  test("suggests in-project Obsidian refresh for stale views", async () => {
    const output = await diagnoseProject({
      issues: [
        {
          code: "obsidian-view-stale",
          message: "Obsidian projection is stale for source file: 03_分镜脚本/镜头-001.md",
          path: "流程/步骤三 - 分镜脚本/镜头 001 - 分镜脚本.md"
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
          message: "Shot review canvas is missing or not linked: 画布/镜头审阅/shot-001.canvas",
          path: "镜头/shot-001.md"
        }
      ]
    });

    expect(output).toContain("Obsidian Projection");
    expect(output).toContain("single-shot review format");
    expect(output).toContain("画布/镜头审阅/");
  });

  test("suggests Obsidian agent handoff fixes", async () => {
    const output = await diagnoseProject({
      issues: [
        {
          code: "invalid-obsidian-agent-handoff",
          message: "Missing Obsidian agent handoff page: 04_智能体交接.md",
          path: "04_智能体交接.md"
        }
      ]
    });

    expect(output).toContain("Obsidian Projection");
    expect(output).toContain("04_智能体交接.md");
    expect(output).toContain("copy-ready agent context");
    expect(output).toContain("--in-project-view");
    expect(output).toContain("source Step files");
  });

  test("suggests safe recovery when force target contains nested Git metadata", async () => {
    const output = await diagnoseProject({
      issues: [
        {
          code: "unsafe-obsidian-force-target",
          message: "Refusing to force-remove an Obsidian output directory containing .git",
          path: "_views/obsidian"
        }
      ]
    });

    expect(output).toContain("Obsidian Projection");
    expect(output).toContain("Do not use `--force`");
    expect(output).toContain(".git");
    expect(output).toContain("incremental export");
  });
});
