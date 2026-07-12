import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { createProject } from "../src/lib/init.js";
import { exportObsidianVault } from "../src/lib/obsidian/export.js";
import { syncProject } from "../src/lib/sync.js";
import type { Ide } from "../src/lib/types.js";
import { verifyProject } from "../src/lib/verify.js";

const tempRoots: string[] = [];
const repoRoot = path.resolve(__dirname, "../../..");

async function createSyncedProject(root: string, ide: Ide): Promise<string> {
  await createProject({
    targetRoot: root,
    projectName: `${ide}-verify-project`,
    pack: "official-ai-video",
    ide,
    imagePlatform: "openai",
    videoPlatform: "veo"
  });
  const projectRoot = path.join(root, `${ide}-verify-project`);
  await syncProject({
    repoRoot,
    projectRoot,
    ide,
    pack: "official-ai-video"
  });
  return projectRoot;
}

const requiredRuntimeFileByIde: Record<Ide, string> = {
  codex: ".codex/agent-rules.md",
  cursor: ".cursor/rules/ai-video-workflow.mdc",
  "claude-code": ".claude/commands/ai-video-workflow.md",
  trae: ".trae/rules/ai-video-workflow.md"
};

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

describe("verifyProject", () => {
  test.each<Ide>(["codex", "cursor", "claude-code", "trae"])("passes IDE runtime verification for synced %s projects", async (ide) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-verify-runtime-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, ide);

    const result = await verifyProject({
      projectRoot,
      ide,
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(true);
  });

  test.each<Ide>(["codex", "cursor", "claude-code", "trae"])("reports missing IDE runtime files for %s", async (ide) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-missing-runtime-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, ide);
    const missingPath = requiredRuntimeFileByIde[ide];
    await fs.remove(path.join(projectRoot, missingPath));

    const result = await verifyProject({
      projectRoot,
      ide,
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing-ide-runtime",
          path: missingPath
        })
      ])
    );
  });

  test("reports a missing shared agent entry", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-missing-shared-entry-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");
    await fs.remove(path.join(projectRoot, "AGENTS.md"));

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing-shared-agent-entry",
          path: "AGENTS.md"
        })
      ])
    );
  });

  test("reports custom AGENTS as a merge task when Cherry host surfaces exist", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-agents-merge-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");

    await fs.writeFile(path.join(projectRoot, "AGENTS.md"), "# Custom Agents\n\nRead SOUL.md first.\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "SOUL.md"), "# Soul\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "USER.md"), "# User\n", "utf8");
    await fs.ensureDir(path.join(projectRoot, "memory"));

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "shared-agent-entry-needs-merge",
          path: "AGENTS.md"
        })
      ])
    );
  });

  test("accepts custom AGENTS after the ai-video-workflow merge block is added", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-agents-merged-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");

    await fs.writeFile(
      path.join(projectRoot, "AGENTS.md"),
      [
        "# Custom Agents",
        "",
        "Read `SOUL.md` and `USER.md` for Cherry Studio host context.",
        "",
        "## ai-video-workflow",
        "",
        "Marker: ai-video-workflow shared agent entry.",
        "",
        "- Read `docs/ai-workspace/README.md` before changing files.",
        "- Treat `project-step-files` as the source of truth."
      ].join("\n"),
      "utf8"
    );

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(true);
  });

  test("reports a missing shared agent doc", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-missing-shared-doc-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "cursor");
    await fs.remove(path.join(projectRoot, "docs", "ai-workspace", "BOUNDARIES.md"));

    const result = await verifyProject({
      projectRoot,
      ide: "cursor",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing-shared-agent-doc",
          path: "docs/ai-workspace/BOUNDARIES.md"
        })
      ])
    );
  });

  test("reports a missing entrypoint reconciliation shared agent doc", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-missing-entrypoint-doc-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "cursor");
    const docPath = "docs/ai-workspace/ENTRYPOINT_RECONCILIATION.md";
    await fs.remove(path.join(projectRoot, docPath));

    const result = await verifyProject({
      projectRoot,
      ide: "cursor",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing-shared-agent-doc",
          path: docPath
        })
      ])
    );
  });

  test("reports an invalid entrypoint reconciliation shared agent doc", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-invalid-entrypoint-doc-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "cursor");
    const docPath = "docs/ai-workspace/ENTRYPOINT_RECONCILIATION.md";
    await fs.writeFile(path.join(projectRoot, docPath), "# Entrypoint Reconciliation\n", "utf8");

    const result = await verifyProject({
      projectRoot,
      ide: "cursor",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid-shared-agent-doc",
          path: docPath
        })
      ])
    );
  });

  test("reports runtime entries that do not point to the shared workspace", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-runtime-conflict-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "trae");
    await fs.writeFile(
      path.join(projectRoot, ".trae", "rules", "ai-video-workflow.md"),
      "# Trae Runtime\n\nThe .trae runtime mirror is the source of truth for this project.\n",
      "utf8"
    );

    const result = await verifyProject({
      projectRoot,
      ide: "trae",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "agent-runtime-conflict",
          path: ".trae/rules/ai-video-workflow.md"
        })
      ])
    );
  });

  test("finds missing Step 6 files, invalid Step 4 contracts, and absolute path links", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-verify-"));
    tempRoots.push(root);

    const projectRoot = path.join(root, "bad-project");
    await fs.ensureDir(path.join(projectRoot, "04_image_prompts"));
    await fs.ensureDir(path.join(projectRoot, "06_execution_plan"));
    await fs.writeFile(
      path.join(projectRoot, "project.config.yaml"),
      [
        "pack: official-ai-video",
        "ide: codex",
        "platforms:",
        "  image:",
        "    default: openai",
        "workflow:",
        "  enhanced_flow:",
        "    enabled: true"
      ].join("\n"),
      "utf8"
    );
    await fs.writeFile(
      path.join(projectRoot, "04_image_prompts", "shot-01.md"),
      [
        "# Shot 01",
        "",
        "快速导读",
        "",
        "主体在夜色中前行。",
        "",
        "中文完整版本",
        "",
        "参考前文继续写，模型应自行理解剧情。",
        "",
        "[bad](G:\\absolute\\path.md)"
      ].join("\n"),
      "utf8"
    );

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "missing-step6-file",
        "missing-step4-section",
        "absolute-path-link",
        "step4-forbidden-text",
        "missing-video-default-platform"
      ])
    );
  });

  test("finds absolute links outside Step 4 markdown files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-links-"));
    tempRoots.push(root);

    const projectRoot = path.join(root, "bad-links");
    await fs.ensureDir(path.join(projectRoot, "01_concept"));
    await fs.ensureDir(path.join(projectRoot, "06_execution_plan"));
    await fs.writeFile(
      path.join(projectRoot, "project.config.yaml"),
      [
        "pack: official-ai-video",
        "ide: codex",
        "platforms:",
        "  image:",
        "    default: openai",
        "  video:",
        "    default: runway",
        "workflow:",
        "  enhanced_flow:",
        "    enabled: true"
      ].join("\n"),
      "utf8"
    );
    await fs.writeFile(path.join(projectRoot, "06_execution_plan", "00_execution_plan.md"), "# Plan\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "06_execution_plan", "01_image_execution_plan.md"), "# Images\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "06_execution_plan", "02_video_execution_plan.md"), "# Videos\n", "utf8");
    await fs.writeFile(
      path.join(projectRoot, "01_concept", "story.md"),
      "[bad](file:///C:/Users/example/story.md)\n",
      "utf8"
    );

    const result = await verifyProject({
      projectRoot,
      ide: "cursor",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "absolute-path-link",
          path: path.join("01_concept", "story.md")
        })
      ])
    );
  });

  test("ignores Cherry Studio host surfaces during project Markdown link checks", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-cherry-host-surfaces-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");

    await fs.writeFile(path.join(projectRoot, "SOUL.md"), "[local](G:\\private\\soul.md)\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "USER.md"), "[local](file:///C:/Users/example/user.md)\n", "utf8");
    await fs.ensureDir(path.join(projectRoot, "memory"));
    await fs.writeFile(path.join(projectRoot, "memory", "README.md"), "[local](G:\\private\\memory.md)\n", "utf8");

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(true);
    expect(result.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "absolute-path-link"
        })
      ])
    );
  });

  test("ignores generated Obsidian view layers during project Markdown link checks", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-views-link-checks-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");
    const outRoot = path.join(projectRoot, "_views", "obsidian");

    await exportObsidianVault({ projectRoot, outRoot, force: true, includePluginRecipes: true });
    await fs.writeFile(path.join(outRoot, "Notes", "manual.md"), "[local](G:\\private\\note.md)\n", "utf8");
    await fs.writeFile(path.join(outRoot, "Workflow", "manual-generated.md"), "[local](file:///C:/private/generated.md)\n", "utf8");

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(true);
    expect(result.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "absolute-path-link"
        })
      ])
    );
  });

  test("ignores root Obsidian UI state during project Markdown link checks", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-root-obsidian-link-checks-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root, "codex");

    await fs.ensureDir(path.join(projectRoot, ".obsidian", "plugins", "example"));
    await fs.writeFile(path.join(projectRoot, ".obsidian", "plugins", "example", "README.md"), "[local](C:\\private\\config.md)\n", "utf8");

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(true);
    expect(result.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "absolute-path-link"
        })
      ])
    );
  });

  test("requires storyboard files to link to existing Step 4 prompt files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-trace-"));
    tempRoots.push(root);

    const projectRoot = path.join(root, "bad-trace");
    await fs.ensureDir(path.join(projectRoot, "03_storyboard"));
    await fs.ensureDir(path.join(projectRoot, "04_image_prompts"));
    await fs.ensureDir(path.join(projectRoot, "06_execution_plan"));
    await fs.writeFile(
      path.join(projectRoot, "project.config.yaml"),
      [
        "pack: official-ai-video",
        "ide: codex",
        "platforms:",
        "  image:",
        "    default: openai",
        "  video:",
        "    default: runway",
        "workflow:",
        "  enhanced_flow:",
        "    enabled: true"
      ].join("\n"),
      "utf8"
    );
    await fs.writeFile(path.join(projectRoot, "06_execution_plan", "00_execution_plan.md"), "# Plan\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "06_execution_plan", "01_image_execution_plan.md"), "# Images\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "06_execution_plan", "02_video_execution_plan.md"), "# Videos\n", "utf8");
    await fs.writeFile(
      path.join(projectRoot, "03_storyboard", "shot-001.md"),
      "[missing](../04_image_prompts/missing.md)\n",
      "utf8"
    );

    const result = await verifyProject({
      projectRoot,
      ide: "cursor",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "broken-step3-step4-link",
          path: path.join("03_storyboard", "shot-001.md")
        })
      ])
    );
  });
});
