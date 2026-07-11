import fs from "fs-extra";
import path from "node:path";

import { STEP6_FILES } from "./constants.js";
import type { Ide, ProjectConfig, VerificationIssue, VerificationResult } from "./types.js";
import { parseYaml } from "./yaml.js";

const step4RequiredSections = ["快速导读", "中文完整版本", "English Version (Copy Ready)"];
const step4ForbiddenText = ["参考前文", "同上", "模型应自行理解剧情", "same as previous"];
const ignoredMarkdownDirs = new Set(["node_modules", ".git"]);
const absoluteLinkPattern = /([A-Za-z]:\\|[A-Za-z]:\/|file:\/\/|vscode:\/\/|\]\(\/(?!\/))/;
const inlineCodePattern = /`[^`\r\n]*`/g;
const step4LinkPattern = /\]\((?:\.\.\/)?04_image_prompts\/([^)#]+)(?:#[^)]+)?\)/g;

interface IdeRuntimeRequirement {
  path: string;
  label: string;
}

const ideRuntimeRequirements: Record<Ide, IdeRuntimeRequirement[]> = {
  codex: [
    { path: ".codex/ai-video-workflow/WORKFLOW_OVERVIEW.md", label: "Codex runtime overview" },
    { path: ".codex/skills/film-workflow/SKILL.md", label: "Codex runtime skill bundle" },
    { path: ".codex/agent-rules.md", label: "Codex agent rules" },
    { path: ".codex/repo-context.md", label: "Codex repo context" }
  ],
  cursor: [
    { path: ".cursor/rules/ai-video-workflow.mdc", label: "Cursor rule entry" },
    { path: ".cursor/skills/film-workflow/SKILL.md", label: "Cursor runtime skill bundle" },
    { path: ".cursor/ai-video-workflow/WORKFLOW_OVERVIEW.md", label: "Cursor runtime overview" }
  ],
  "claude-code": [
    { path: "CLAUDE.md", label: "Claude Code root entry" },
    { path: ".claude/commands/ai-video-workflow.md", label: "Claude Code command entry" },
    { path: ".claude/skills/film-workflow/SKILL.md", label: "Claude Code runtime skill bundle" },
    { path: ".claude/ai-video-workflow/WORKFLOW_OVERVIEW.md", label: "Claude Code runtime overview" }
  ],
  trae: [
    { path: "AGENTS.md", label: "Trae compatibility entry" },
    { path: ".trae/rules/ai-video-workflow.md", label: "Trae rule entry" },
    { path: ".trae/skills/film-workflow/SKILL.md", label: "Trae runtime skill bundle" },
    { path: ".trae/specs/ai-video-workflow/indexes/capability-index.md", label: "Trae workflow specs" },
    { path: ".trae/documents/ai-video-workflow/WORKFLOW_OVERVIEW.md", label: "Trae runtime overview" }
  ]
};

async function loadConfig(projectRoot: string): Promise<ProjectConfig | null> {
  const configPath = path.join(projectRoot, "project.config.yaml");
  if (!(await fs.pathExists(configPath))) {
    return null;
  }
  return parseYaml<ProjectConfig>(await fs.readFile(configPath, "utf8"));
}

function pushIssue(issues: VerificationIssue[], issue: VerificationIssue): void {
  issues.push(issue);
}

async function listMarkdownFiles(root: string, current = root): Promise<string[]> {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (ignoredMarkdownDirs.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(root, fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(path.relative(root, fullPath));
    }
  }
  return files;
}

async function verifyRelativeMarkdownLinks(projectRoot: string, issues: VerificationIssue[]): Promise<void> {
  if (!(await fs.pathExists(projectRoot))) {
    return;
  }
  const files = await listMarkdownFiles(projectRoot);
  for (const relPath of files) {
    const content = await fs.readFile(path.join(projectRoot, relPath), "utf8");
    const searchableContent = content.replace(inlineCodePattern, "");
    if (absoluteLinkPattern.test(searchableContent)) {
      pushIssue(issues, {
        code: "absolute-path-link",
        message: "Found absolute path link",
        path: relPath
      });
    }
  }
}

async function verifyStep6(projectRoot: string, issues: VerificationIssue[]): Promise<void> {
  for (const file of STEP6_FILES) {
    const fullPath = path.join(projectRoot, "06_execution_plan", file);
    if (!(await fs.pathExists(fullPath))) {
      pushIssue(issues, {
        code: "missing-step6-file",
        message: `Missing ${file}`,
        path: "06_execution_plan"
      });
    }
  }
}

async function verifyStep4(projectRoot: string, issues: VerificationIssue[]): Promise<void> {
  const dir = path.join(projectRoot, "04_image_prompts");
  if (!(await fs.pathExists(dir))) {
    return;
  }
  const files = (await fs.readdir(dir)).filter((name) => name.endsWith(".md"));
  for (const file of files) {
    const relPath = path.join("04_image_prompts", file);
    const content = await fs.readFile(path.join(dir, file), "utf8");
    for (const section of step4RequiredSections) {
      if (!content.includes(section)) {
        pushIssue(issues, {
          code: "missing-step4-section",
          message: `Missing Step 4 section: ${section}`,
          path: relPath
        });
      }
    }
    if (!content.includes("避免:") || !content.includes("Avoid:")) {
      pushIssue(issues, {
        code: "missing-step4-section",
        message: "Missing `避免:` or `Avoid:` in Step 4 contract",
        path: relPath
      });
    }
    for (const forbidden of step4ForbiddenText) {
      if (content.includes(forbidden)) {
        pushIssue(issues, {
          code: "step4-forbidden-text",
          message: `Found forbidden Step 4 text: ${forbidden}`,
          path: relPath
        });
      }
    }
  }
}

async function verifyStep3Step4Traceability(projectRoot: string, issues: VerificationIssue[]): Promise<void> {
  const storyboardDir = path.join(projectRoot, "03_storyboard");
  if (!(await fs.pathExists(storyboardDir))) {
    return;
  }
  const files = (await fs.readdir(storyboardDir)).filter((name) => name.endsWith(".md"));
  for (const file of files) {
    const relPath = path.join("03_storyboard", file);
    const content = await fs.readFile(path.join(storyboardDir, file), "utf8");
    const matches = [...content.matchAll(step4LinkPattern)];
    if (matches.length === 0) {
      pushIssue(issues, {
        code: "missing-step3-step4-link",
        message: "Storyboard file does not link to a Step 4 image prompt",
        path: relPath
      });
      continue;
    }
    for (const match of matches) {
      const target = match[1];
      if (!target || target.includes("..")) {
        pushIssue(issues, {
          code: "broken-step3-step4-link",
          message: "Storyboard file links to an invalid Step 4 target",
          path: relPath
        });
        continue;
      }
      if (!(await fs.pathExists(path.join(projectRoot, "04_image_prompts", target)))) {
        pushIssue(issues, {
          code: "broken-step3-step4-link",
          message: `Storyboard file links to missing Step 4 target: ${target}`,
          path: relPath
        });
      }
    }
  }
}

async function verifyIdeRuntime(projectRoot: string, ide: Ide, issues: VerificationIssue[]): Promise<void> {
  for (const requirement of ideRuntimeRequirements[ide]) {
    if (!(await fs.pathExists(path.join(projectRoot, requirement.path)))) {
      pushIssue(issues, {
        code: "missing-ide-runtime",
        message: `Missing ${requirement.label}: ${requirement.path}`,
        path: requirement.path
      });
    }
  }
}

export async function verifyProject({
  projectRoot,
  ide
}: {
  projectRoot: string;
  ide: Ide;
  pack: string;
}): Promise<VerificationResult> {
  const issues: VerificationIssue[] = [];
  const config = await loadConfig(projectRoot);
  if (!config) {
    pushIssue(issues, { code: "missing-config", message: "Missing project.config.yaml", path: projectRoot });
  } else {
    if (!config.platforms?.image?.default) {
      pushIssue(issues, {
        code: "missing-image-default-platform",
        message: "Missing image default platform",
        path: "project.config.yaml"
      });
    }
    if (!config.platforms?.video?.default) {
      pushIssue(issues, {
        code: "missing-video-default-platform",
        message: "Missing video default platform",
        path: "project.config.yaml"
      });
    }
  }
  await verifyStep6(projectRoot, issues);
  await verifyStep4(projectRoot, issues);
  await verifyStep3Step4Traceability(projectRoot, issues);
  await verifyRelativeMarkdownLinks(projectRoot, issues);
  await verifyIdeRuntime(projectRoot, ide, issues);
  return { ok: issues.length === 0, issues };
}
