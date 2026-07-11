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

async function listMarkdownFiles(root: string, current = root): Promise<string[]> {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(root, fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
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

    const runtimeFiles = await listMarkdownFiles(path.join(projectRoot, ".codex"));
    for (const file of runtimeFiles) {
      const content = await fs.readFile(path.join(projectRoot, ".codex", file), "utf8");
      const searchableContent = content.replace(inlineCodePattern, "");
      expect(searchableContent, `${file} should not contain absolute local links`).not.toMatch(absoluteLinkPattern);
    }
  });
});
