import fs from "fs-extra";
import path from "node:path";

import { generatedLocalSurfaceIgnoreBlock, sharedAgentEntryContent, sharedAiWorkspaceDocs } from "./agent-workspace.js";
import { copyDirectory, writeFileIfMissing } from "./fs-utils.js";
import { assertCanSyncProject } from "./project-root.js";
import type { Ide, SyncProjectOptions } from "./types.js";

async function ensureSharedAgentWorkspace(projectRoot: string): Promise<void> {
  await writeFileIfMissing(path.join(projectRoot, "AGENTS.md"), sharedAgentEntryContent());
  for (const [fileName, content] of Object.entries(sharedAiWorkspaceDocs)) {
    await writeFileIfMissing(path.join(projectRoot, "docs", "ai-workspace", fileName), content);
  }
}

export async function ensureProjectGitignore(projectRoot: string): Promise<void> {
  const gitignorePath = path.join(projectRoot, ".gitignore");
  const marker = "ai-video-workflow generated and local surfaces";
  if (!(await fs.pathExists(gitignorePath))) {
    await fs.writeFile(gitignorePath, `${generatedLocalSurfaceIgnoreBlock}\n`, "utf8");
    return;
  }

  const content = await fs.readFile(gitignorePath, "utf8");
  if (content.includes(marker)) {
    return;
  }

  const separator = content.length === 0 ? "" : content.endsWith("\n\n") ? "" : content.endsWith("\n") ? "\n" : "\n\n";
  await fs.writeFile(gitignorePath, `${content}${separator}${generatedLocalSurfaceIgnoreBlock}\n`, "utf8");
}

async function writeGeneratedRuntimeFile(filePath: string, content: string): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
}

async function syncCodex(repoRoot: string, projectRoot: string, packRoot: string): Promise<void> {
  const codexRoot = path.join(projectRoot, ".codex");
  await fs.ensureDir(codexRoot);
  await copyDirectory(path.join(packRoot, "skills"), path.join(codexRoot, "skills"));
  await copyDirectory(path.join(packRoot, "skills-longform"), path.join(codexRoot, "ai-video-workflow", "skills"));
  await copyDirectory(path.join(packRoot, "skills"), path.join(codexRoot, "ai-video-workflow", "skill-bundles"));
  await copyDirectory(path.join(packRoot, "templates"), path.join(codexRoot, "ai-video-workflow", "templates"));
  await copyDirectory(path.join(packRoot, "workflow", "indexes"), path.join(codexRoot, "ai-video-workflow", "indexes"));
  await writeGeneratedRuntimeFile(
    path.join(codexRoot, "ai-video-workflow", "WORKFLOW_OVERVIEW.md"),
    await fs.readFile(path.join(repoRoot, "WORKFLOW_OVERVIEW.md"), "utf8")
  );
  await writeGeneratedRuntimeFile(
    path.join(codexRoot, "README.md"),
    [
      "# Codex Runtime",
      "",
      "Read `AGENTS.md` and `docs/ai-workspace/` first. Use `.codex/agent-rules.md`, `.codex/repo-context.md`, and `.codex/skills/` as Codex runtime entrypoints.",
      "",
      "`project-step-files` are the source of truth; `.codex/` is a runtime mirror."
    ].join("\n")
  );
  await writeGeneratedRuntimeFile(
    path.join(codexRoot, "agent-rules.md"),
    [
      "# Codex Agent Rules",
      "",
      "Summary runtime rules:",
      "- Read `AGENTS.md` and `docs/ai-workspace/` before changing project files.",
      "- Treat `project-step-files` as the source of truth.",
      "- Keep Step 3 and Step 4 frame-aligned.",
      "- Enforce the Step 4 fixed file contract.",
      "- Use relative paths only.",
      "- Keep `.codex/ai-video-workflow/` as the full runtime mirror and `.codex/skills/` as runtime skill entries.",
      "- Platform memory is not project truth."
    ].join("\n")
  );
  await writeGeneratedRuntimeFile(
    path.join(codexRoot, "repo-context.md"),
    [
      "# Repo Context",
      "",
      "- Product repo: `ai-video-workflow`",
      "- Default pack: `official-ai-video`",
      "- Shared entry: `AGENTS.md`",
      "- Shared AI docs: `docs/ai-workspace/`",
      "- Source of truth: `project-step-files`",
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
  await writeGeneratedRuntimeFile(
    path.join(projectRoot, ".cursor", "ai-video-workflow", "WORKFLOW_OVERVIEW.md"),
    await fs.readFile(path.resolve(packRoot, "..", "..", "WORKFLOW_OVERVIEW.md"), "utf8")
  );
  await writeGeneratedRuntimeFile(
    path.join(projectRoot, ".cursor", "rules", "ai-video-workflow.mdc"),
    [
      "---",
      "description: AI video workflow runtime entry",
      "alwaysApply: true",
      "---",
      "",
      "# AI Video Workflow",
      "",
      "- Read `AGENTS.md` and `docs/ai-workspace/` first.",
      "- Use project Step 1 to Step 6 files as the source of truth.",
      "- Treat `project-step-files` as the shared cross-agent source of truth.",
      "- Use `.cursor/ai-video-workflow/` as the runtime mirror.",
      "- Use `.cursor/skills/` as adapter-ready skill bundles.",
      "- Keep Step 3 and Step 4 frame-aligned.",
      "- Keep Step 4 file contracts intact.",
      "- Use relative links only.",
      "- Platform memory is not project truth."
    ].join("\n")
  );
}

async function syncClaudeCode(repoRoot: string, projectRoot: string, packRoot: string): Promise<void> {
  await copyDirectory(path.join(packRoot, "skills"), path.join(projectRoot, ".claude", "skills"));
  await copyDirectory(path.join(packRoot, "workflow"), path.join(projectRoot, ".claude", "ai-video-workflow", "workflow"));
  await copyDirectory(path.join(packRoot, "skills-longform"), path.join(projectRoot, ".claude", "ai-video-workflow", "skills"));
  await copyDirectory(path.join(packRoot, "skills"), path.join(projectRoot, ".claude", "ai-video-workflow", "skill-bundles"));
  await copyDirectory(path.join(packRoot, "templates"), path.join(projectRoot, ".claude", "ai-video-workflow", "templates"));
  await copyDirectory(path.join(packRoot, "workflow", "indexes"), path.join(projectRoot, ".claude", "ai-video-workflow", "indexes"));
  await writeGeneratedRuntimeFile(
    path.join(projectRoot, ".claude", "ai-video-workflow", "WORKFLOW_OVERVIEW.md"),
    await fs.readFile(path.join(repoRoot, "WORKFLOW_OVERVIEW.md"), "utf8")
  );
  await writeFileIfMissing(
    path.join(projectRoot, "CLAUDE.md"),
    [
      "# Claude Code Runtime",
      "",
      "This is a Claude Code entrypoint. It does not replace `AGENTS.md`.",
      "",
      "Use project Step 1 to Step 6 files as the source of truth. Treat `project-step-files` as the shared source of truth.",
      "",
      "Read order:",
      "",
      "1. `project.config.yaml`",
      "2. `AGENTS.md`",
      "3. `docs/ai-workspace/README.md`",
      "4. `CLAUDE.md`",
      "5. `.claude/ai-video-workflow/WORKFLOW_OVERVIEW.md`",
      "6. `.claude/skills/<skill>/SKILL.md`",
      "7. Source Step files in the project",
      "",
      "Runtime boundaries:",
      "",
      "- `.claude/ai-video-workflow/` is a generated runtime mirror.",
      "- `.claude/skills/` contains adapter-ready skill bundles.",
      "- `.claude/commands/ai-video-workflow.md` is a command-style handoff entry.",
      "- Do not edit generated Obsidian projection files as the workflow source.",
      "- Keep Step 3 and Step 4 frame-aligned.",
      "- Keep Step 4 file contracts intact.",
      "- Use relative links only.",
      "- Platform memory is not project truth."
    ].join("\n")
  );
  await writeGeneratedRuntimeFile(
    path.join(projectRoot, ".claude", "commands", "ai-video-workflow.md"),
    [
      "# AI Video Workflow Command Entry",
      "",
      "When working on this project:",
      "",
      "1. Read `project.config.yaml`.",
      "2. Read `AGENTS.md`.",
      "3. Read `docs/ai-workspace/README.md` and `docs/ai-workspace/BOUNDARIES.md`.",
      "4. Read `.claude/ai-video-workflow/WORKFLOW_OVERVIEW.md`.",
      "5. Use `.claude/skills/film-workflow/SKILL.md` for workflow execution.",
      "6. Edit source Step files only when changing project truth.",
      "7. Run `ai-video-workflow verify --project <path> --ide claude-code` after changes.",
      "",
      "Do not treat `.claude/ai-video-workflow/`, generated Obsidian vault files, MCP resources, or platform memory as upstream creative truth. Source files are `project-step-files`."
    ].join("\n")
  );
}

async function syncTrae(repoRoot: string, projectRoot: string, packRoot: string): Promise<void> {
  await copyDirectory(path.join(packRoot, "skills"), path.join(projectRoot, ".trae", "skills"));
  await copyDirectory(path.join(packRoot, "workflow"), path.join(projectRoot, ".trae", "specs", "ai-video-workflow"));
  await copyDirectory(path.join(packRoot, "skills-longform"), path.join(projectRoot, ".trae", "documents", "ai-video-workflow", "skills"));
  await copyDirectory(path.join(packRoot, "skills"), path.join(projectRoot, ".trae", "documents", "ai-video-workflow", "skill-bundles"));
  await copyDirectory(path.join(packRoot, "templates"), path.join(projectRoot, ".trae", "documents", "ai-video-workflow", "templates"));
  await copyDirectory(path.join(packRoot, "workflow", "indexes"), path.join(projectRoot, ".trae", "documents", "ai-video-workflow", "indexes"));
  await writeGeneratedRuntimeFile(
    path.join(projectRoot, ".trae", "documents", "ai-video-workflow", "WORKFLOW_OVERVIEW.md"),
    await fs.readFile(path.join(repoRoot, "WORKFLOW_OVERVIEW.md"), "utf8")
  );
  await writeGeneratedRuntimeFile(
    path.join(projectRoot, ".trae", "rules", "ai-video-workflow.md"),
    [
      "# AI Video Workflow Trae Runtime",
      "",
      "Use project Step 1 to Step 6 files as the source of truth.",
      "",
      "Read order:",
      "",
      "1. `project.config.yaml`",
      "2. `AGENTS.md`",
      "3. `docs/ai-workspace/README.md`",
      "4. `.trae/rules/ai-video-workflow.md`",
      "5. `.trae/documents/ai-video-workflow/WORKFLOW_OVERVIEW.md`",
      "6. `.trae/skills/<skill>/SKILL.md`",
      "7. Source Step files in the project",
      "",
      "Runtime boundaries:",
      "",
      "- `project-step-files` are the source of truth.",
      "- `.trae/skills/` contains adapter-ready skill bundles.",
      "- `.trae/specs/ai-video-workflow/` contains generated workflow specs.",
      "- `.trae/documents/ai-video-workflow/` is a generated runtime mirror.",
      "- Do not edit generated Obsidian projection files as the workflow source.",
      "- Keep Step 3 and Step 4 frame-aligned.",
      "- Keep Step 4 file contracts intact.",
      "- Use relative links only.",
      "- Platform memory is not project truth."
    ].join("\n")
  );
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
      await syncClaudeCode(repoRoot, projectRoot, packRoot);
      break;
    case "trae":
      await syncTrae(repoRoot, projectRoot, packRoot);
      break;
  }
}

export async function syncProject(options: SyncProjectOptions): Promise<void> {
  const packRoot = path.join(options.repoRoot, "packs", options.pack);
  await assertCanSyncProject(options.projectRoot, options.repoRoot);
  await ensureSharedAgentWorkspace(options.projectRoot);
  await ensureProjectGitignore(options.projectRoot);
  await syncIde(options.repoRoot, options.projectRoot, packRoot, options.ide);
}
