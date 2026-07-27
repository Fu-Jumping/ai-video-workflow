import fs from "fs-extra";
import path from "node:path";

import {
  cherryHostSurfaceDirs,
  cherryHostSurfaceFiles,
  classifySharedAgentEntry,
  sharedAgentDocMarkers,
  sharedAgentDocPaths,
  sharedAgentDocsDir,
  sharedAgentEntryPath
} from "./agent-workspace.js";
import { STEP6_FILES, STEP_DIR_BY_NUMBER } from "./constants.js";
import { readProjectConfig } from "./project-config.js";
import { projectRootIssues } from "./project-root.js";
import {
  extractReferenceAssets,
  findMissingCharacterTriViews,
  findMissingSceneReferenceImages,
  hasReferenceAssetRequirementSection,
  missingReferenceAssets
} from "./reference-assets.js";
import type { Ide, VerificationIssue, VerificationResult } from "./types.js";

const step2Dir = STEP_DIR_BY_NUMBER[2];
const step3Dir = STEP_DIR_BY_NUMBER[3];
const step4Dir = STEP_DIR_BY_NUMBER[4];
const step6Dir = STEP_DIR_BY_NUMBER[6];
const step4RequiredSections = ["快速导读", "中文完整版本", "可复制提示词"];
const step4ForbiddenText = ["参考前文", "同上", "模型应自行理解剧情", "same as previous"];
const ignoredMarkdownDirs = new Set(["node_modules", ".git"]);
const ignoredGeneratedViewRootDirs = ["_views", ".obsidian"] as const;
const ignoredRootMarkdownDirs = new Set([...cherryHostSurfaceDirs, ...ignoredGeneratedViewRootDirs]);
const ignoredRootMarkdownFiles = new Set(cherryHostSurfaceFiles);
const absoluteLinkPattern = /([A-Za-z]:\\|[A-Za-z]:\/|file:\/\/|vscode:\/\/|\]\(\/(?!\/))/;
const inlineCodePattern = /`[^`\r\n]*`/g;
const step4LinkPattern = /\]\((?:\.\.\/)?04_图片提示词\/([^)#]+)(?:#[^)]+)?\)/g;
const runtimeTruthConflictPattern =
  /(runtime mirror|运行镜像).{0,40}(source of truth|事实源|project truth)|(source of truth|事实源|project truth).{0,40}(runtime mirror|运行镜像)/i;
const runtimeTruthNegationPattern = /(not|不是|并非|only|只).{0,80}(source of truth|事实源|project truth)/i;

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

const ideSharedRuntimeEntryPaths: Record<Ide, string[]> = {
  codex: [".codex/agent-rules.md", ".codex/repo-context.md"],
  cursor: [".cursor/rules/ai-video-workflow.mdc"],
  "claude-code": ["CLAUDE.md", ".claude/commands/ai-video-workflow.md"],
  trae: [".trae/rules/ai-video-workflow.md"]
};

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
      if (current === root && ignoredRootMarkdownDirs.has(entry.name)) {
        continue;
      }
      files.push(...(await listMarkdownFiles(root, fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      if (current === root && ignoredRootMarkdownFiles.has(entry.name)) {
        continue;
      }
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
    const fullPath = path.join(projectRoot, step6Dir, file);
    if (!(await fs.pathExists(fullPath))) {
      pushIssue(issues, {
        code: "missing-step6-file",
        message: `Missing ${file}`,
        path: step6Dir
      });
    }
  }
}

async function verifyStep4(projectRoot: string, issues: VerificationIssue[]): Promise<void> {
  const dir = path.join(projectRoot, step4Dir);
  if (!(await fs.pathExists(dir))) {
    return;
  }
  const files = (await fs.readdir(dir)).filter((name) => name.endsWith(".md"));
  for (const file of files) {
    const relPath = path.join(step4Dir, file);
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
    if (!content.includes("避免：") && !content.includes("避免:")) {
      pushIssue(issues, {
        code: "missing-step4-section",
        message: "Missing `避免：` in Step 4 contract",
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

async function verifyStep2ReferenceAssets(projectRoot: string, issues: VerificationIssue[]): Promise<void> {
  const dir = path.join(projectRoot, step2Dir);
  if (!(await fs.pathExists(dir))) {
    return;
  }
  const files = (await fs.readdir(dir)).filter((name) => name.endsWith(".md"));
  for (const file of files) {
    const relPath = path.join(step2Dir, file);
    const content = await fs.readFile(path.join(dir, file), "utf8");
    for (const missing of findMissingCharacterTriViews(content)) {
      pushIssue(issues, {
        code: missing.code,
        message: `Main character ${missing.name} must declare ${missing.expectedToken}`,
        path: relPath
      });
    }
    for (const missing of findMissingSceneReferenceImages(content)) {
      pushIssue(issues, {
        code: missing.code,
        message: `Special scene ${missing.name} must declare ${missing.expectedToken}`,
        path: relPath
      });
    }
  }
}

async function verifyStep3Step4Traceability(projectRoot: string, issues: VerificationIssue[]): Promise<void> {
  const storyboardDir = path.join(projectRoot, step3Dir);
  if (!(await fs.pathExists(storyboardDir))) {
    return;
  }
  const files = (await fs.readdir(storyboardDir)).filter((name) => name.endsWith(".md"));
  for (const file of files) {
    const relPath = path.join(step3Dir, file);
    const content = await fs.readFile(path.join(storyboardDir, file), "utf8");
    const requiredReferenceAssets = extractReferenceAssets(content);
    if (hasReferenceAssetRequirementSection(content) && requiredReferenceAssets.length === 0) {
      pushIssue(issues, {
        code: "missing-storyboard-reference-assets",
        message: "Storyboard reference asset section is empty; declare required @xx三视图 or @xx场景图 assets",
        path: relPath
      });
    }
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
      const targetPath = path.join(projectRoot, step4Dir, target);
      if (!(await fs.pathExists(targetPath))) {
        pushIssue(issues, {
          code: "broken-step3-step4-link",
          message: `Storyboard file links to missing Step 4 target: ${target}`,
          path: relPath
        });
        continue;
      }
      if (requiredReferenceAssets.length > 0) {
        const step4Content = await fs.readFile(targetPath, "utf8");
        const missingAssets = missingReferenceAssets(requiredReferenceAssets, extractReferenceAssets(step4Content));
        for (const asset of missingAssets) {
          pushIssue(issues, {
            code: "missing-step4-reference-asset",
            message: `Step 4 prompt must include required reference asset: ${asset.token}`,
            path: path.join(step4Dir, target)
          });
        }
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

function contentHasAllMarkers(content: string, markers: readonly string[]): boolean {
  return markers.every((marker) => content.includes(marker));
}

function contentMentionsProjectTruth(content: string): boolean {
  return content.includes("project-step-files") || content.includes("Step 1 to Step 6 files") || content.includes("步骤一到步骤六文件");
}

async function verifySharedAgentWorkspace(projectRoot: string, ide: Ide, issues: VerificationIssue[]): Promise<void> {
  const agentEntryFullPath = path.join(projectRoot, sharedAgentEntryPath);
  if (!(await fs.pathExists(agentEntryFullPath))) {
    pushIssue(issues, {
      code: "missing-shared-agent-entry",
      message: "Missing shared agent entry: AGENTS.md",
      path: sharedAgentEntryPath
    });
  } else {
    const content = await fs.readFile(agentEntryFullPath, "utf8");
    const classification = classifySharedAgentEntry(content);
    if (classification === "custom-entry-needs-merge") {
      pushIssue(issues, {
        code: "shared-agent-entry-needs-merge",
        message:
          "Existing AGENTS.md must merge the ai-video-workflow shared entry block; keep user and Cherry Studio guidance intact.",
        path: sharedAgentEntryPath
      });
    }
  }

  for (const relPath of sharedAgentDocPaths) {
    const fullPath = path.join(projectRoot, relPath);
    if (!(await fs.pathExists(fullPath))) {
      pushIssue(issues, {
        code: "missing-shared-agent-doc",
        message: `Missing shared agent doc: ${relPath}`,
        path: relPath
      });
      continue;
    }
    const content = await fs.readFile(fullPath, "utf8");
    if (!contentHasAllMarkers(content, sharedAgentDocMarkers)) {
      pushIssue(issues, {
        code: "invalid-shared-agent-doc",
        message: `Shared agent doc is missing required ai-video-workflow markers: ${relPath}`,
        path: relPath
      });
    }
  }

  for (const relPath of ideSharedRuntimeEntryPaths[ide]) {
    const fullPath = path.join(projectRoot, relPath);
    if (!(await fs.pathExists(fullPath))) {
      continue;
    }
    const content = await fs.readFile(fullPath, "utf8");
    if (!content.includes("AGENTS.md") || !content.includes(sharedAgentDocsDir) || !contentMentionsProjectTruth(content)) {
      pushIssue(issues, {
        code: "agent-runtime-conflict",
        message: `Runtime entry does not point to the shared agent workspace: ${relPath}`,
        path: relPath
      });
      continue;
    }
    if (runtimeTruthConflictPattern.test(content) && !runtimeTruthNegationPattern.test(content)) {
      pushIssue(issues, {
        code: "agent-runtime-conflict",
        message: `Runtime entry appears to redefine project truth: ${relPath}`,
        path: relPath
      });
    }
  }
}

async function verifyNestedProjects(projectRoot: string, issues: VerificationIssue[], current = projectRoot): Promise<void> {
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "_views" || entry.name === ".obsidian") {
      continue;
    }
    if (current === projectRoot && [".codex", ".cursor", ".claude", ".trae"].includes(entry.name)) {
      continue;
    }
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      const nestedConfig = path.join(fullPath, "project.config.yaml");
      if (await fs.pathExists(nestedConfig)) {
        pushIssue(issues, {
          code: "nested-project",
          message: "Found nested ai-video-workflow project inside this project",
          path: path.relative(projectRoot, nestedConfig)
        });
        continue;
      }
      await verifyNestedProjects(projectRoot, issues, fullPath);
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
  const rootIssues = await projectRootIssues(projectRoot);
  if (rootIssues.length > 0) {
    return { ok: false, issues: rootIssues };
  }

  const { config, issues: configIssues } = await readProjectConfig(projectRoot);
  for (const issue of configIssues) {
    pushIssue(issues, issue);
  }
  if (config) {
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
  await verifyNestedProjects(projectRoot, issues);
  await verifyStep6(projectRoot, issues);
  await verifyStep2ReferenceAssets(projectRoot, issues);
  await verifyStep4(projectRoot, issues);
  await verifyStep3Step4Traceability(projectRoot, issues);
  await verifyRelativeMarkdownLinks(projectRoot, issues);
  await verifyIdeRuntime(projectRoot, ide, issues);
  await verifySharedAgentWorkspace(projectRoot, ide, issues);
  return { ok: issues.length === 0, issues };
}
