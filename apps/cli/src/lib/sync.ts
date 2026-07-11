import fs from "fs-extra";
import path from "node:path";

import { copyDirectory, writeFileIfMissing } from "./fs-utils.js";
import type { Ide, SyncProjectOptions } from "./types.js";

async function syncCodex(repoRoot: string, projectRoot: string, packRoot: string): Promise<void> {
  const codexRoot = path.join(projectRoot, ".codex");
  await fs.ensureDir(codexRoot);
  await copyDirectory(path.join(packRoot, "skills"), path.join(codexRoot, "skills"));
  await copyDirectory(path.join(packRoot, "skills-longform"), path.join(codexRoot, "ai-video-workflow", "skills"));
  await copyDirectory(path.join(packRoot, "skills"), path.join(codexRoot, "ai-video-workflow", "skill-bundles"));
  await copyDirectory(path.join(packRoot, "templates"), path.join(codexRoot, "ai-video-workflow", "templates"));
  await copyDirectory(path.join(packRoot, "workflow", "indexes"), path.join(codexRoot, "ai-video-workflow", "indexes"));
  await writeFileIfMissing(
    path.join(codexRoot, "ai-video-workflow", "WORKFLOW_OVERVIEW.md"),
    await fs.readFile(path.join(repoRoot, "WORKFLOW_OVERVIEW.md"), "utf8")
  );
  await writeFileIfMissing(
    path.join(codexRoot, "README.md"),
    "# Codex Runtime\n\nUse `.codex/agent-rules.md`, `.codex/repo-context.md`, and `.codex/skills/` as the primary Codex runtime entrypoints.\n"
  );
  await writeFileIfMissing(
    path.join(codexRoot, "agent-rules.md"),
    [
      "# Codex Agent Rules",
      "",
      "Summary runtime rules:",
      "- Keep Step 3 and Step 4 frame-aligned.",
      "- Enforce the Step 4 fixed file contract.",
      "- Use relative paths only.",
      "- Keep `.codex/ai-video-workflow/` as the full runtime mirror and `.codex/skills/` as runtime skill entries."
    ].join("\n")
  );
  await writeFileIfMissing(
    path.join(codexRoot, "repo-context.md"),
    [
      "# Repo Context",
      "",
      "- Product repo: `ai-video-workflow`",
      "- Default pack: `official-ai-video`",
      "- Runtime mirror: `.codex/ai-video-workflow/`",
      "- Runtime skills: `.codex/skills/`"
    ].join("\n")
  );
}

async function syncCursor(projectRoot: string, packRoot: string): Promise<void> {
  await copyDirectory(path.join(packRoot, "skills"), path.join(projectRoot, ".cursor", "skills"));
  await copyDirectory(path.join(packRoot, "skills-longform"), path.join(projectRoot, ".cursor", "ai-video-workflow", "skills"));
  await copyDirectory(path.join(packRoot, "skills"), path.join(projectRoot, ".cursor", "ai-video-workflow", "skill-bundles"));
  await copyDirectory(path.join(packRoot, "templates"), path.join(projectRoot, ".cursor", "ai-video-workflow", "templates"));
  await copyDirectory(path.join(packRoot, "workflow", "indexes"), path.join(projectRoot, ".cursor", "ai-video-workflow", "indexes"));
  await writeFileIfMissing(
    path.join(projectRoot, ".cursor", "ai-video-workflow", "WORKFLOW_OVERVIEW.md"),
    await fs.readFile(path.resolve(packRoot, "..", "..", "WORKFLOW_OVERVIEW.md"), "utf8")
  );
  await writeFileIfMissing(
    path.join(projectRoot, ".cursor", "rules", "ai-video-workflow.mdc"),
    [
      "---",
      "description: AI video workflow runtime entry",
      "alwaysApply: true",
      "---",
      "",
      "# AI Video Workflow",
      "",
      "- Use project Step 1 to Step 6 files as the source of truth.",
      "- Use `.cursor/ai-video-workflow/` as the runtime mirror.",
      "- Use `.cursor/skills/` as adapter-ready skill bundles.",
      "- Keep Step 3 and Step 4 frame-aligned.",
      "- Keep Step 4 file contracts intact.",
      "- Use relative links only."
    ].join("\n")
  );
  await writeFileIfMissing(path.join(projectRoot, "AGENTS.md"), "# Cursor Compatibility Entry\n");
}

async function syncClaudeCode(projectRoot: string, packRoot: string): Promise<void> {
  await copyDirectory(path.join(packRoot, "skills"), path.join(projectRoot, ".claude", "skills"));
  await writeFileIfMissing(path.join(projectRoot, "CLAUDE.md"), "# Claude Code Compatibility Entry\n");
}

async function syncTrae(projectRoot: string, packRoot: string): Promise<void> {
  await copyDirectory(path.join(packRoot, "skills"), path.join(projectRoot, ".trae", "skills"));
  await fs.ensureDir(path.join(projectRoot, ".trae", "rules"));
  await writeFileIfMissing(path.join(projectRoot, "AGENTS.md"), "# Trae Compatibility Entry\n");
  await writeFileIfMissing(path.join(projectRoot, "CLAUDE.md"), "# Trae Compatibility Entry\n");
}

async function syncIde(repoRoot: string, projectRoot: string, packRoot: string, ide: Ide): Promise<void> {
  switch (ide) {
    case "codex":
      await syncCodex(repoRoot, projectRoot, packRoot);
      break;
    case "cursor":
      await syncCursor(projectRoot, packRoot);
      break;
    case "claude-code":
      await syncClaudeCode(projectRoot, packRoot);
      break;
    case "trae":
      await syncTrae(projectRoot, packRoot);
      break;
  }
}

export async function syncProject(options: SyncProjectOptions): Promise<void> {
  const packRoot = path.join(options.repoRoot, "packs", options.pack);
  await syncIde(options.repoRoot, options.projectRoot, packRoot, options.ide);
}
