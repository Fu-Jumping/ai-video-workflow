import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { createProject } from "../src/lib/init.js";
import { syncProject } from "../src/lib/sync.js";

const tempRoots: string[] = [];
const absoluteLinkPattern = /([A-Za-z]:\\|[A-Za-z]:\/|file:\/\/|vscode:\/\/|\]\(\/(?!\/))/;
const inlineCodePattern = /`[^`\r\n]*`/g;

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

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

describe("syncProject", () => {
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

    await expect(fs.pathExists(path.join(projectRoot, ".codex", "agent-rules.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".codex", "repo-context.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".codex", "skills", "film-producer", "SKILL.md"))).resolves.toBe(true);

    const overview = await fs.readFile(path.join(projectRoot, ".codex", "ai-video-workflow", "WORKFLOW_OVERVIEW.md"), "utf8");
    expect(overview).toContain("`packs/official-ai-video/` 是母版源");
    expect(overview).toContain("`.codex/ai-video-workflow/` 是 Codex 运行镜像");
    expect(overview).toContain("`.codex/skills/<skill>/SKILL.md` 是 Codex 的运行时技能入口层");

    const agentRules = await fs.readFile(path.join(projectRoot, ".codex", "agent-rules.md"), "utf8");
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

    await expect(fs.pathExists(path.join(projectRoot, ".cursor", "skills", "film-workflow", "SKILL.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".cursor", "rules", "ai-video-workflow.mdc"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".cursor", "ai-video-workflow", "WORKFLOW_OVERVIEW.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".cursor", "ai-video-workflow", "skills", "film-workflow.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".cursor", "ai-video-workflow", "skill-bundles", "film-workflow", "SKILL.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".cursor", "ai-video-workflow", "templates"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".cursor", "ai-video-workflow", "indexes"))).resolves.toBe(true);

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
});
