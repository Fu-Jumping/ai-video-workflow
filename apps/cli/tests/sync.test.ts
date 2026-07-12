import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { STEP_DIRS } from "../src/lib/constants.js";
import { createProject } from "../src/lib/init.js";
import { syncProject } from "../src/lib/sync.js";

const tempRoots: string[] = [];
const absoluteLinkPattern = /([A-Za-z]:\\|[A-Za-z]:\/|file:\/\/|vscode:\/\/|\]\(\/(?!\/))/;
const inlineCodePattern = /`[^`\r\n]*`/g;
const gitignoreBlockMarker = "ai-video-workflow generated and local surfaces";

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

async function seedWorkflowProject(projectRoot: string, ide = "codex"): Promise<void> {
  await fs.ensureDir(projectRoot);
  await fs.writeFile(
    path.join(projectRoot, "project.config.yaml"),
    [
      "pack: official-ai-video",
      `ide: ${ide}`,
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
  for (const stepDir of STEP_DIRS) {
    await fs.ensureDir(path.join(projectRoot, stepDir));
  }
}

async function listTextRuntimeFiles(root: string, current = root): Promise<string[]> {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listTextRuntimeFiles(root, fullPath)));
    } else if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".mdc"))) {
      files.push(path.relative(root, fullPath));
    }
  }
  return files;
}

async function expectSharedAgentWorkspace(projectRoot: string): Promise<void> {
  await expect(fs.pathExists(path.join(projectRoot, "AGENTS.md"))).resolves.toBe(true);
  await expect(fs.pathExists(path.join(projectRoot, "docs", "ai-workspace", "README.md"))).resolves.toBe(true);
  await expect(fs.pathExists(path.join(projectRoot, "docs", "ai-workspace", "BOUNDARIES.md"))).resolves.toBe(true);
  await expect(fs.pathExists(path.join(projectRoot, "docs", "ai-workspace", "HANDOFFS.md"))).resolves.toBe(true);
  await expect(fs.pathExists(path.join(projectRoot, "docs", "ai-workspace", "SECURITY.md"))).resolves.toBe(true);
  await expect(fs.pathExists(path.join(projectRoot, "docs", "ai-workspace", "PLATFORM_MATRIX.md"))).resolves.toBe(true);

  const agents = await fs.readFile(path.join(projectRoot, "AGENTS.md"), "utf8");
  expect(agents).toContain("ai-video-workflow shared agent entry");
  expect(agents).toContain("docs/ai-workspace");
  expect(agents).toContain("project-step-files");

  const sharedReadme = await fs.readFile(path.join(projectRoot, "docs", "ai-workspace", "README.md"), "utf8");
  expect(sharedReadme).toContain("ai-video-workflow shared agent workspace");
  expect(sharedReadme).toContain("Platform memory is not project truth");
  expect(sharedReadme).toContain("_views/obsidian");
  expect(sharedReadme).toContain("project-step-files");
}

function countOccurrences(content: string, value: string): number {
  return content.split(value).length - 1;
}

describe("syncProject", () => {
  test("creates a project gitignore with generated and local surface protections", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-sync-gitignore-"));
    tempRoots.push(projectRoot);
    await seedWorkflowProject(projectRoot);

    await syncProject({
      repoRoot: path.resolve(__dirname, "../../.."),
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    const gitignore = await fs.readFile(path.join(projectRoot, ".gitignore"), "utf8");
    expect(gitignore).toContain(gitignoreBlockMarker);
    expect(gitignore).toContain("_views/");
    expect(gitignore).toContain(".obsidian/");
    expect(gitignore).toContain("SOUL.md");
    expect(gitignore).toContain("USER.md");
    expect(gitignore).toContain("memory/");
  });

  test("preserves existing project gitignore content and appends the generated surface block once", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-sync-existing-gitignore-"));
    tempRoots.push(projectRoot);
    await seedWorkflowProject(projectRoot);
    await fs.writeFile(path.join(projectRoot, ".gitignore"), "custom-build/\n", "utf8");

    await syncProject({
      repoRoot: path.resolve(__dirname, "../../.."),
      projectRoot,
      ide: "cursor",
      pack: "official-ai-video"
    });

    const gitignore = await fs.readFile(path.join(projectRoot, ".gitignore"), "utf8");
    expect(gitignore).toMatch(/^custom-build\/\n\n# ai-video-workflow generated and local surfaces/m);
    expect(countOccurrences(gitignore, gitignoreBlockMarker)).toBe(1);

    await syncProject({
      repoRoot: path.resolve(__dirname, "../../.."),
      projectRoot,
      ide: "cursor",
      pack: "official-ai-video"
    });

    const gitignoreAfterSecondSync = await fs.readFile(path.join(projectRoot, ".gitignore"), "utf8");
    expect(countOccurrences(gitignoreAfterSecondSync, gitignoreBlockMarker)).toBe(1);
    expect(gitignoreAfterSecondSync).toBe(gitignore);
  });

  test("writes Codex summary files and runtime skills from the official pack", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-sync-"));
    tempRoots.push(root);

    await createProject({
      targetRoot: root,
      projectName: "sync-project",
      pack: "official-ai-video",
      ide: "codex",
      imagePlatform: "openai",
      videoPlatform: "veo"
    });

    const projectRoot = path.join(root, "sync-project");
    await fs.remove(path.join(projectRoot, ".codex"));

    await syncProject({
      repoRoot: path.resolve(__dirname, "../../.."),
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    await expectSharedAgentWorkspace(projectRoot);
    await expect(fs.pathExists(path.join(projectRoot, ".codex", "agent-rules.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".codex", "repo-context.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".codex", "skills", "film-producer", "SKILL.md"))).resolves.toBe(true);

    const overview = await fs.readFile(path.join(projectRoot, ".codex", "ai-video-workflow", "WORKFLOW_OVERVIEW.md"), "utf8");
    expect(overview).toContain("`packs/official-ai-video/` 是母版源");
    expect(overview).toContain("`.codex/ai-video-workflow/` 是 Codex 运行镜像");
    expect(overview).toContain("`.codex/skills/<skill>/SKILL.md` 是 Codex 的运行时技能入口层");

    const agentRules = await fs.readFile(path.join(projectRoot, ".codex", "agent-rules.md"), "utf8");
    expect(agentRules).toContain("AGENTS.md");
    expect(agentRules).toContain("docs/ai-workspace");
    expect(agentRules).toContain("project-step-files");
    expect(agentRules).toContain("Keep Step 3 and Step 4 frame-aligned.");
    expect(agentRules).toContain("Keep `.codex/ai-video-workflow/` as the full runtime mirror");

    const runtimeFiles = await listTextRuntimeFiles(path.join(projectRoot, ".codex"));
    for (const file of runtimeFiles) {
      const content = await fs.readFile(path.join(projectRoot, ".codex", file), "utf8");
      const searchableContent = content.replace(inlineCodePattern, "");
      expect(searchableContent, `${file} should not contain absolute local links`).not.toMatch(absoluteLinkPattern);
    }
  });

  test("writes Cursor rules, skills, and runtime mirror from the official pack", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-cursor-sync-"));
    tempRoots.push(root);

    await createProject({
      targetRoot: root,
      projectName: "cursor-sync-project",
      pack: "official-ai-video",
      ide: "cursor",
      imagePlatform: "openai",
      videoPlatform: "veo"
    });

    const projectRoot = path.join(root, "cursor-sync-project");
    await fs.remove(path.join(projectRoot, ".cursor"));

    await syncProject({
      repoRoot: path.resolve(__dirname, "../../.."),
      projectRoot,
      ide: "cursor",
      pack: "official-ai-video"
    });

    await expectSharedAgentWorkspace(projectRoot);
    await expect(fs.pathExists(path.join(projectRoot, ".cursor", "skills", "film-workflow", "SKILL.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".cursor", "rules", "ai-video-workflow.mdc"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".cursor", "ai-video-workflow", "WORKFLOW_OVERVIEW.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".cursor", "ai-video-workflow", "skills", "film-workflow.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".cursor", "ai-video-workflow", "skill-bundles", "film-workflow", "SKILL.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".cursor", "ai-video-workflow", "templates"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".cursor", "ai-video-workflow", "indexes"))).resolves.toBe(true);

    const rules = await fs.readFile(path.join(projectRoot, ".cursor", "rules", "ai-video-workflow.mdc"), "utf8");
    expect(rules).toContain("AGENTS.md");
    expect(rules).toContain("docs/ai-workspace");
    expect(rules).toContain("project-step-files");

    const runtimeFiles = await listTextRuntimeFiles(path.join(projectRoot, ".cursor"));
    for (const file of runtimeFiles) {
      const content = await fs.readFile(path.join(projectRoot, ".cursor", file), "utf8");
      const searchableContent = content.replace(inlineCodePattern, "");
      expect(searchableContent, `${file} should not contain absolute local links`).not.toMatch(absoluteLinkPattern);
    }
  });

  test("writes Claude Code skills, command entry, and runtime mirror from the official pack", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-claude-sync-"));
    tempRoots.push(root);

    await createProject({
      targetRoot: root,
      projectName: "claude-sync-project",
      pack: "official-ai-video",
      ide: "claude-code",
      imagePlatform: "openai",
      videoPlatform: "veo"
    });

    const projectRoot = path.join(root, "claude-sync-project");
    await fs.remove(path.join(projectRoot, ".claude"));
    await fs.remove(path.join(projectRoot, "CLAUDE.md"));

    await syncProject({
      repoRoot: path.resolve(__dirname, "../../.."),
      projectRoot,
      ide: "claude-code",
      pack: "official-ai-video"
    });

    await expectSharedAgentWorkspace(projectRoot);
    await expect(fs.pathExists(path.join(projectRoot, "CLAUDE.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".claude", "skills", "film-workflow", "SKILL.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".claude", "commands", "ai-video-workflow.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".claude", "ai-video-workflow", "WORKFLOW_OVERVIEW.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".claude", "ai-video-workflow", "workflow"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".claude", "ai-video-workflow", "skills", "film-workflow.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".claude", "ai-video-workflow", "skill-bundles", "film-workflow", "SKILL.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".claude", "ai-video-workflow", "templates"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".claude", "ai-video-workflow", "indexes"))).resolves.toBe(true);

    const claudeEntry = await fs.readFile(path.join(projectRoot, "CLAUDE.md"), "utf8");
    expect(claudeEntry).toContain("AGENTS.md");
    expect(claudeEntry).toContain("docs/ai-workspace");
    expect(claudeEntry).toContain("project-step-files");
    expect(claudeEntry).toContain("Step 1 to Step 6 files");
    expect(claudeEntry).toContain(".claude/ai-video-workflow/");

    const claudeRuntimeRoot = path.join(projectRoot, ".claude");
    const runtimeFiles = await listTextRuntimeFiles(claudeRuntimeRoot);
    for (const file of runtimeFiles) {
      const content = await fs.readFile(path.join(claudeRuntimeRoot, file), "utf8");
      const searchableContent = content.replace(inlineCodePattern, "");
      expect(searchableContent, `${file} should not contain absolute local links`).not.toMatch(absoluteLinkPattern);
    }

    const searchableClaudeEntry = claudeEntry.replace(inlineCodePattern, "");
    expect(searchableClaudeEntry, "CLAUDE.md should not contain absolute local links").not.toMatch(absoluteLinkPattern);
  });

  test("writes Trae skills, rules, specs, and documents from the official pack", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-trae-sync-"));
    tempRoots.push(root);

    await createProject({
      targetRoot: root,
      projectName: "trae-sync-project",
      pack: "official-ai-video",
      ide: "trae",
      imagePlatform: "openai",
      videoPlatform: "veo"
    });

    const projectRoot = path.join(root, "trae-sync-project");
    await fs.remove(path.join(projectRoot, ".trae"));
    await fs.remove(path.join(projectRoot, "AGENTS.md"));
    await fs.remove(path.join(projectRoot, "CLAUDE.md"));

    await syncProject({
      repoRoot: path.resolve(__dirname, "../../.."),
      projectRoot,
      ide: "trae",
      pack: "official-ai-video"
    });

    await expectSharedAgentWorkspace(projectRoot);
    await expect(fs.pathExists(path.join(projectRoot, "AGENTS.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, "CLAUDE.md"))).resolves.toBe(false);
    await expect(fs.pathExists(path.join(projectRoot, ".trae", "skills", "film-workflow", "SKILL.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".trae", "rules", "ai-video-workflow.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".trae", "specs", "ai-video-workflow", "indexes", "capability-index.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".trae", "documents", "ai-video-workflow", "WORKFLOW_OVERVIEW.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".trae", "documents", "ai-video-workflow", "skills", "film-workflow.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".trae", "documents", "ai-video-workflow", "skill-bundles", "film-workflow", "SKILL.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".trae", "documents", "ai-video-workflow", "templates"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".trae", "documents", "ai-video-workflow", "indexes"))).resolves.toBe(true);

    const rules = await fs.readFile(path.join(projectRoot, ".trae", "rules", "ai-video-workflow.md"), "utf8");
    expect(rules).toContain("AGENTS.md");
    expect(rules).toContain("docs/ai-workspace");
    expect(rules).toContain("project-step-files");
    expect(rules).toContain("Step 1 to Step 6 files");
    expect(rules).toContain(".trae/documents/ai-video-workflow/");

    const traeRuntimeRoot = path.join(projectRoot, ".trae");
    const runtimeFiles = await listTextRuntimeFiles(traeRuntimeRoot);
    for (const file of runtimeFiles) {
      const content = await fs.readFile(path.join(traeRuntimeRoot, file), "utf8");
      const searchableContent = content.replace(inlineCodePattern, "");
      expect(searchableContent, `${file} should not contain absolute local links`).not.toMatch(absoluteLinkPattern);
    }

    const agents = await fs.readFile(path.join(projectRoot, "AGENTS.md"), "utf8");
    const searchableAgents = agents.replace(inlineCodePattern, "");
    expect(searchableAgents, "AGENTS.md should not contain absolute local links").not.toMatch(absoluteLinkPattern);
  });

  test("does not overwrite existing shared agent workspace files or Claude entry", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-shared-preserve-"));
    tempRoots.push(root);
    const projectRoot = path.join(root, "preserve-project");
    await seedWorkflowProject(projectRoot, "claude-code");
    await fs.ensureDir(path.join(projectRoot, "docs", "ai-workspace"));
    await fs.ensureDir(path.join(projectRoot, ".claude", "commands"));
    await fs.writeFile(path.join(projectRoot, "AGENTS.md"), "# Custom Agents\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "docs", "ai-workspace", "README.md"), "# Custom AI Docs\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "CLAUDE.md"), "# Custom Claude\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "SOUL.md"), "# Custom Soul\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "USER.md"), "# Custom User\n", "utf8");
    await fs.ensureDir(path.join(projectRoot, "memory"));
    await fs.writeFile(path.join(projectRoot, "memory", "README.md"), "# Custom Memory\n", "utf8");
    await fs.writeFile(path.join(projectRoot, ".claude", "commands", "ai-video-workflow.md"), "# Old Generated Command\n", "utf8");

    await syncProject({
      repoRoot: path.resolve(__dirname, "../../.."),
      projectRoot,
      ide: "claude-code",
      pack: "official-ai-video"
    });

    await expect(fs.readFile(path.join(projectRoot, "AGENTS.md"), "utf8")).resolves.toBe("# Custom Agents\n");
    await expect(fs.readFile(path.join(projectRoot, "docs", "ai-workspace", "README.md"), "utf8")).resolves.toBe("# Custom AI Docs\n");
    await expect(fs.readFile(path.join(projectRoot, "CLAUDE.md"), "utf8")).resolves.toBe("# Custom Claude\n");
    await expect(fs.readFile(path.join(projectRoot, "SOUL.md"), "utf8")).resolves.toBe("# Custom Soul\n");
    await expect(fs.readFile(path.join(projectRoot, "USER.md"), "utf8")).resolves.toBe("# Custom User\n");
    await expect(fs.readFile(path.join(projectRoot, "memory", "README.md"), "utf8")).resolves.toBe("# Custom Memory\n");
    await expect(fs.pathExists(path.join(projectRoot, "docs", "ai-workspace", "BOUNDARIES.md"))).resolves.toBe(true);

    const generatedCommand = await fs.readFile(path.join(projectRoot, ".claude", "commands", "ai-video-workflow.md"), "utf8");
    expect(generatedCommand).toContain("AGENTS.md");
    expect(generatedCommand).toContain("docs/ai-workspace");
    expect(generatedCommand).toContain("project-step-files");
    expect(generatedCommand).not.toContain("Old Generated Command");
  });

  test("preserves custom AGENTS while writing entrypoint reconciliation guidance", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-custom-agents-"));
    tempRoots.push(root);
    const projectRoot = path.join(root, "custom-agents-project");
    await seedWorkflowProject(projectRoot);
    await fs.writeFile(path.join(projectRoot, "AGENTS.md"), "# Custom Agents\n\nRead SOUL.md first.\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "SOUL.md"), "# Cherry Soul\n", "utf8");
    await fs.writeFile(path.join(projectRoot, "USER.md"), "# Cherry User\n", "utf8");
    await fs.ensureDir(path.join(projectRoot, "memory"));

    await syncProject({
      repoRoot: path.resolve(__dirname, "../../.."),
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    await expect(fs.readFile(path.join(projectRoot, "AGENTS.md"), "utf8")).resolves.toBe("# Custom Agents\n\nRead SOUL.md first.\n");
    const reconciliation = await fs.readFile(path.join(projectRoot, "docs", "ai-workspace", "ENTRYPOINT_RECONCILIATION.md"), "utf8");
    expect(reconciliation).toContain("Marker: ai-video-workflow shared agent workspace.");
    expect(reconciliation).toContain("## ai-video-workflow");
    expect(reconciliation).toContain("SOUL.md");
    expect(reconciliation).toContain("USER.md");
    expect(reconciliation).toContain("memory/");
  });

  test("refuses to sync a missing project root", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-sync-missing-"));
    tempRoots.push(root);
    const projectRoot = path.join(root, "missing-project");

    await expect(
      syncProject({
        repoRoot: path.resolve(__dirname, "../../.."),
        projectRoot,
        ide: "codex",
        pack: "official-ai-video"
      })
    ).rejects.toThrow("does not exist");

    await expect(fs.pathExists(projectRoot)).resolves.toBe(false);
  });

  test("refuses to sync a file path", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-sync-file-"));
    tempRoots.push(root);
    const projectRoot = path.join(root, "not-a-directory.md");
    await fs.writeFile(projectRoot, "# Not a project\n", "utf8");

    await expect(
      syncProject({
        repoRoot: path.resolve(__dirname, "../../.."),
        projectRoot,
        ide: "codex",
        pack: "official-ai-video"
      })
    ).rejects.toThrow("must be a directory");
  });

  test("refuses to sync the tool repository root or source subtrees", async () => {
    const repoRoot = path.resolve(__dirname, "../../..");

    await expect(
      syncProject({
        repoRoot,
        projectRoot: repoRoot,
        ide: "codex",
        pack: "official-ai-video"
      })
    ).rejects.toThrow("tool repository");

    await expect(
      syncProject({
        repoRoot,
        projectRoot: path.join(repoRoot, "apps", "cli"),
        ide: "codex",
        pack: "official-ai-video"
      })
    ).rejects.toThrow("source tree");
  });

  test("keeps shared workspace stable when syncing all IDE runtimes into one project", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-multi-sync-"));
    tempRoots.push(root);

    await createProject({
      targetRoot: root,
      projectName: "multi-sync-project",
      pack: "official-ai-video",
      ide: "codex",
      imagePlatform: "openai",
      videoPlatform: "veo"
    });

    const projectRoot = path.join(root, "multi-sync-project");
    for (const ide of ["codex", "claude-code", "trae", "cursor"] as const) {
      await syncProject({
        repoRoot: path.resolve(__dirname, "../../.."),
        projectRoot,
        ide,
        pack: "official-ai-video"
      });
    }

    await expectSharedAgentWorkspace(projectRoot);
    await expect(fs.pathExists(path.join(projectRoot, ".codex", "agent-rules.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".cursor", "rules", "ai-video-workflow.mdc"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".claude", "commands", "ai-video-workflow.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".trae", "rules", "ai-video-workflow.md"))).resolves.toBe(true);
  });
});
