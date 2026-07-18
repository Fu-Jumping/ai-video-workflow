import fs from "fs-extra";
import path from "node:path";

import {
  generatedLocalSurfaceIgnoreBlock,
  sharedAgentDocsBoundaryPath,
  sharedAgentDocsDir,
  sharedAgentDocsReadmePath,
  sharedAgentEntryContent,
  sharedAiWorkspaceDocs
} from "./agent-workspace.js";
import { copyDirectory, writeFileIfMissing } from "./fs-utils.js";
import { assertCanSyncProject } from "./project-root.js";
import type { Ide, SyncProjectOptions } from "./types.js";

async function ensureSharedAgentWorkspace(projectRoot: string): Promise<void> {
  await writeFileIfMissing(path.join(projectRoot, "AGENTS.md"), sharedAgentEntryContent());
  for (const [fileName, content] of Object.entries(sharedAiWorkspaceDocs)) {
    await writeFileIfMissing(path.join(projectRoot, sharedAgentDocsDir, fileName), content);
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
      "# Codex 运行入口",
      "",
      `请先读取 \`AGENTS.md\` 和 \`${sharedAgentDocsDir}/\`。\`.codex/agent-rules.md\`、\`.codex/repo-context.md\` 和 \`.codex/skills/\` 是 Codex 运行入口。`,
      "",
      "`project-step-files` 是事实源；`.codex/` 是运行镜像。"
    ].join("\n")
  );
  await writeGeneratedRuntimeFile(
    path.join(codexRoot, "agent-rules.md"),
    [
      "# Codex 智能体规则",
      "",
      "运行规则摘要：",
      `- 修改项目文件前先读取 \`AGENTS.md\` 和 \`${sharedAgentDocsDir}/\`。`,
      "- 将 `project-step-files` 作为事实源。",
      "- 保持步骤三和步骤四逐镜头对齐。",
      "- 保持步骤四固定文件合同。",
      "- 只使用相对路径。",
      "- 保持 `.codex/ai-video-workflow/` 作为完整运行镜像，`.codex/skills/` 作为运行技能入口。",
      "- 平台记忆不是项目事实源。"
    ].join("\n")
  );
  await writeGeneratedRuntimeFile(
    path.join(codexRoot, "repo-context.md"),
    [
      "# 仓库上下文",
      "",
      "- 产品仓库：`ai-video-workflow`",
      "- 默认工作流包：`official-ai-video`",
      "- 共享入口：`AGENTS.md`",
      `- 共享 AI 文档：\`${sharedAgentDocsDir}/\``,
      "- 事实源：`project-step-files`",
      "- 运行镜像：`.codex/ai-video-workflow/`",
      "- 运行技能：`.codex/skills/`"
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
      "# AI 视频工作流",
      "",
      `- 先读取 \`AGENTS.md\` 和 \`${sharedAgentDocsDir}/\`。`,
      "- 将项目步骤一到步骤六文件作为事实源。",
      "- 将 `project-step-files` 作为跨智能体共享事实源。",
      "- `.cursor/ai-video-workflow/` 是运行镜像。",
      "- `.cursor/skills/` 是适配器可用的技能包。",
      "- 保持步骤三和步骤四逐镜头对齐。",
      "- 保持步骤四文件合同完整。",
      "- 只使用相对链接。",
      "- 平台记忆不是项目事实源。"
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
      "# Claude Code 运行入口",
      "",
      "这是 Claude Code 专属入口。它不替代 `AGENTS.md`。",
      "",
      "将项目步骤一到步骤六文件作为事实源。将 `project-step-files` 作为共享事实源。",
      "",
      "## 阅读顺序",
      "",
      "1. `project.config.yaml`",
      "2. `AGENTS.md`",
      `3. \`${sharedAgentDocsReadmePath}\``,
      "4. `CLAUDE.md`",
      "5. `.claude/ai-video-workflow/WORKFLOW_OVERVIEW.md`",
      "6. `.claude/skills/<skill>/SKILL.md`",
      "7. 项目中的步骤源文件",
      "",
      "## 运行边界",
      "",
      "- `.claude/ai-video-workflow/` 是生成的运行镜像。",
      "- `.claude/skills/` 包含适配器可用的技能包。",
      "- `.claude/commands/ai-video-workflow.md` 是命令式交接入口。",
      "- 不要把生成的 Obsidian 投影文件当作工作流源文件来编辑。",
      "- 保持步骤三和步骤四逐镜头对齐。",
      "- 保持步骤四文件合同完整。",
      "- 只使用相对链接。",
      "- 平台记忆不是项目事实源。"
    ].join("\n")
  );
  await writeGeneratedRuntimeFile(
    path.join(projectRoot, ".claude", "commands", "ai-video-workflow.md"),
    [
      "# AI 视频工作流命令入口",
      "",
      "处理这个项目时：",
      "",
      "1. 读取 `project.config.yaml`。",
      "2. 读取 `AGENTS.md`。",
      `3. 读取 \`${sharedAgentDocsReadmePath}\` 和 \`${sharedAgentDocsBoundaryPath}\`。`,
      "4. 读取 `.claude/ai-video-workflow/WORKFLOW_OVERVIEW.md`。",
      "5. 使用 `.claude/skills/film-workflow/SKILL.md` 执行工作流。",
      "6. 只有在改变项目事实时才编辑步骤源文件。",
      "7. 修改后运行 `ai-video-workflow verify --project <path> --ide claude-code`。",
      "",
      "不要把 `.claude/ai-video-workflow/`、生成的 Obsidian vault 文件、MCP 资源或平台记忆当作上游创作事实源。源文件是 `project-step-files`。"
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
      "# AI 视频工作流 Trae 运行入口",
      "",
      "将项目步骤一到步骤六文件作为事实源。",
      "",
      "## 阅读顺序",
      "",
      "1. `project.config.yaml`",
      "2. `AGENTS.md`",
      `3. \`${sharedAgentDocsReadmePath}\``,
      "4. `.trae/rules/ai-video-workflow.md`",
      "5. `.trae/documents/ai-video-workflow/WORKFLOW_OVERVIEW.md`",
      "6. `.trae/skills/<skill>/SKILL.md`",
      "7. 项目中的步骤源文件",
      "",
      "## 运行边界",
      "",
      "- `project-step-files` 是事实源。",
      "- `.trae/skills/` 包含适配器可用的技能包。",
      "- `.trae/specs/ai-video-workflow/` 包含生成的工作流规格。",
      "- `.trae/documents/ai-video-workflow/` 是生成的运行镜像。",
      "- 不要把生成的 Obsidian 投影文件当作工作流源文件来编辑。",
      "- 保持步骤三和步骤四逐镜头对齐。",
      "- 保持步骤四文件合同完整。",
      "- 只使用相对链接。",
      "- 平台记忆不是项目事实源。"
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
