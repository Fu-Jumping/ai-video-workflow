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
import {
  CONTENT_BLOCK_NAMES,
  CONTENT_INDEX_FILE,
  MIGRATED_SNAPSHOT_DIRECTORY,
  STEP0_FILES,
  STEP6_FILES,
  STEP7_FILES,
  STEP_DIR_BY_NUMBER,
  researchStepEnabled
} from "./constants.js";
import {
  autoBlockDrifted,
  checkExecutionFileFreshness,
  loadMaterialIndex,
  platformDefaults,
  renderShotSegmentDigest,
  step4FileRelPath,
  step5FileRelPath,
  stripBlockHash
} from "./content-assemble.js";
import { buildContentTree, getContentBlockBody, hasMigrationSnapshot, resolveContentMode, shotGroupDirectoryName } from "./content-tree.js";
import { applyAcceptedDeviations, readDeviations } from "./deviations.js";
import { verifyMediaRecords } from "./media-records.js";
import { contentFormatVersion, isSupportedContentFormatVersion, readProjectConfig } from "./project-config.js";
import { projectRootIssues } from "./project-root.js";
import {
  declaredReferenceAssetTokens,
  extractReferenceAssets,
  findMissingCharacterTriViews,
  findMissingSceneReferenceImages,
  hasReferenceAssetRequirementSection,
  missingReferenceAssets
} from "./reference-assets.js";
import { buildShotGraph, keyframeMappedSegment, linkedStepFiles, type ShotGraph } from "./shot-graph.js";
import type { Ide, Platform, VerificationIssue, VerificationResult } from "./types.js";

const step2Dir = STEP_DIR_BY_NUMBER[2];
const step6Dir = STEP_DIR_BY_NUMBER[6];
const step4RequiredSections = ["快速导读", "中文完整版本", "可复制提示词"];
const step4ForbiddenText = ["参考前文", "同上", "模型应自行理解剧情", "same as previous"];
// Quick-guide blocks must stay pure visual facts; these markers indicate maintenance or director
// meta-language that belongs in the review conversation, not in the prompt file.
const step4QuickGuideMetaMarkers = ["导演解释", "导演意图", "镜头设计意图", "画面设计意图"];
const step5RequiredSections = ["## 元信息", "## 平台执行设置", "## 参考素材映射", "## 可复制提示词", "## 负面约束"];
const step5PlatformExecutionMarkers = ["默认视频平台", "目标时长", "画幅", "参考素材", "素材上传顺序", "负面约束"];
const step4PlatformExecutionMarkers = ["## 平台执行参数", "midjourney", "--v 8.2", "--ar"];
const step4MidjourneyForbiddenParameters = ["--cref", "--cw", "::"];
const step4MidjourneyPromptMaxLength = 1024;
const step4MidjourneyMinChineseLength = 180;
const step4MidjourneyStylizeMax = 1000;
const step5ForbiddenImagePlatformParameters = ["--v 8.2", "--ar", "--style raw", "--stylize"];
const step7ContentFiles = ["01_标题.md", "02_简介正文.md", "03_话题标签.md", "04_封面文案.md"];
const step7PlatformHeadingPattern = /^##\s*(抖音\/快手|B站|小红书|视频号|YouTube)\s*$/mu;
const step7AvoidHeadingPattern = /^##\s*避免[：:]\s*$/mu;
// Template-generic negative constraints. A Step 5 file must add at least one shot-specific
// constraint beyond these defaults, otherwise the negative block is not per-shot customized.
const step5GenericNegativeDefaults = [
  "不得超过 15 秒。",
  "不得超过 6 个连续编号的镜头段。",
  // Kept so projects written before the 4→6 contract change are still recognized as
  // carrying only template-default negatives instead of looking customized.
  "不得超过 4 个连续编号的镜头段。",
  "不得丢失 Step 4 已选关键帧和语义参考素材。",
  "不得把 `{{Mixed n}}` 槽位号写成事实源引用。",
  "不得加入配乐或字幕；无字幕不禁止场景内真实招牌、木牌等叙事文字。",
  "不得使用“同上”“保持一致”替代具体可见事实。"
];
const step5GenericNegativeNormalized = new Set(step5GenericNegativeDefaults.map(normalizeNegativeLine));

function normalizeNegativeLine(line: string): string {
  return line
    .replace(/[“”]/gu, '"')
    .replace(/[‘’]/gu, "'")
    .replace(/`/gu, "")
    .replace(/\s+/gu, "")
    .replace(/[。；;]$/u, "")
    .toLowerCase();
}

/** Returns the body of the markdown section whose heading line equals `headingText`, or "". */
function sectionAfterHeading(content: string, headingText: string): string {
  const lines = content.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim().replace(/#+\s*$/u, "").trim() === headingText);
  if (headingIndex === -1) {
    return "";
  }
  const body: string[] = [];
  for (const line of lines.slice(headingIndex + 1)) {
    if (/^#{1,6}\s/u.test(line)) {
      break;
    }
    body.push(line);
  }
  return body.join("\n");
}

/** 逐字比对前统一行尾：小节提取经 split/join 已是 LF，拼装正文保留分镜文件原样（可能是 CRLF，J8）。 */
function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/gu, "\n");
}
// .tmp 是工具自己的临时区（整理前的备份、探针与夹具），不属于项目正文。
const ignoredMarkdownDirs = new Set(["node_modules", ".git", ".tmp"]);
// 迁移快照目录：迁移后的旧文件在这里保留为只读快照，不参与当前内容的链接检查与投影。
const ignoredGeneratedViewRootDirs = ["_views", ".obsidian", MIGRATED_SNAPSHOT_DIRECTORY] as const;
const ignoredRootMarkdownDirs = new Set([...cherryHostSurfaceDirs, ...ignoredGeneratedViewRootDirs]);
const ignoredRootMarkdownFiles = new Set(cherryHostSurfaceFiles);
// 盘符分支带负向后行：https:// 里的 s:/ 不再误判为绝对路径（K1）；markdown 根链接分支不受断言影响。
const absoluteLinkPattern = /(?:(?<![A-Za-z])[A-Za-z]:[\\/]|file:\/\/|vscode:\/\/|\]\(\/(?!\/))/;
const inlineCodePattern = /`[^`\r\n]*`/g;
const runtimeTruthConflictPattern =
  /(runtime mirror|运行镜像).{0,40}(source of truth|事实源|project truth)|(source of truth|事实源|project truth).{0,40}(runtime mirror|运行镜像)/i;
const runtimeTruthNegationPattern = /(not|不是|并非|only|只).{0,80}(source of truth|事实源|project truth)/i;
const researchSourceIdPattern = /^SRC-\d{4}$/;
const sensitiveAuthPattern = /(cookie|cookies|token|access[_-]?token|refresh[_-]?token|authorization|bearer|sessionid|手机号|私信)\s*[:=]/i;
const ignoredResearchArchiveDirs = ["/raw/", "/media/", "/full-comments/", "/browser-profile/", "/cookies/", "/_inbox/"];

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

function stripTrailingNewlines(value: string): string {
  return value.replace(/\n+$/u, "");
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

async function listProjectTextFiles(root: string, extensions: string[], current = root): Promise<string[]> {
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
      files.push(...(await listProjectTextFiles(root, extensions, fullPath)));
    } else if (entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension))) {
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

const relativeMarkdownLinkPattern = /(?<!!)\[[^\]\r\n]+\]\(([^)\r\n]+)\)/g;

function stripLinkFragmentAndQuery(target: string): string {
  return target.split(/[?#]/, 1)[0]?.trim() ?? "";
}

function normalizeProjectRelPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function isExternalOrAbsoluteLink(target: string): boolean {
  return /^(https?|mailto|tel|file|vscode):/i.test(target) || target.startsWith("/") || /^[A-Za-z]:[\\/]/.test(target);
}

function stepDirNamesByNumber(): Map<string, number> {
  const byDir: Map<string, number> = new Map();
  for (const [number, dirName] of Object.entries(STEP_DIR_BY_NUMBER)) {
    byDir.set(dirName, Number(number));
  }
  return byDir;
}

async function verifyRelativeMarkdownLinkTargets(projectRoot: string, issues: VerificationIssue[], step?: number): Promise<void> {
  if (!(await fs.pathExists(projectRoot))) {
    return;
  }
  const stepByDir = stepDirNamesByNumber();
  const files = await listMarkdownFiles(projectRoot);
  for (const relPath of files) {
    const fullPath = path.join(projectRoot, relPath);
    const content = await fs.readFile(fullPath, "utf8");
    const searchableContent = content.replace(inlineCodePattern, "");
    for (const match of searchableContent.matchAll(relativeMarkdownLinkPattern)) {
      const rawTarget = match[1]?.trim() ?? "";
      const target = stripLinkFragmentAndQuery(rawTarget);
      if (target === "" || isExternalOrAbsoluteLink(target)) {
        continue;
      }
      const resolved = path.resolve(path.dirname(fullPath), target);
      const projectRelative = normalizeProjectRelPath(path.relative(projectRoot, resolved));
      if (projectRelative.startsWith("..")) {
        pushIssue(issues, {
          code: "broken-relative-link",
          message: `Markdown link escapes the project root: ${rawTarget}`,
          path: normalizeProjectRelPath(relPath)
        });
        continue;
      }
      // Step-scoped verification must not demand downstream files that are not due yet
      // (for example `verify --step 3` may link to Step 4 keyframes created later).
      const targetStepDir = projectRelative.split("/")[0] ?? "";
      const targetStep = stepByDir.get(targetStepDir);
      if (step !== undefined && targetStep !== undefined && targetStep > step) {
        continue;
      }
      if (!(await fs.pathExists(resolved))) {
        pushIssue(issues, {
          code: "broken-relative-link",
          message: `Markdown link target does not exist: ${rawTarget}`,
          path: normalizeProjectRelPath(relPath)
        });
      }
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

async function verifyStep7(projectRoot: string, issues: VerificationIssue[]): Promise<void> {
  const step7Dir = "07_发布物料";
  const fullDir = path.join(projectRoot, step7Dir);
  if (!(await fs.pathExists(fullDir))) {
    return;
  }
  for (const file of STEP7_FILES) {
    const fullPath = path.join(fullDir, file);
    if (!(await fs.pathExists(fullPath))) {
      pushIssue(issues, {
        code: "missing-step7-file",
        message: `Missing Step 7 file: ${file}`,
        path: path.join(step7Dir, file)
      });
      continue;
    }
    const content = await fs.readFile(fullPath, "utf8");
    const relPath = path.join(step7Dir, file);
    if (file === "00_发布总表.md") {
      if (!content.includes("## 一、平台清单与规格") || !content.includes("## 四、发布前核对清单")) {
        pushIssue(issues, {
          code: "invalid-step7-overview",
          message: "Step 7 发布总表 must include 平台清单与规格 and 发布前核对清单",
          path: relPath
        });
      }
      continue;
    }
    if (!content.includes("## 来源亮点")) {
      pushIssue(issues, {
        code: "missing-step7-source-highlights",
        message: `Step 7 publish material must include 来源亮点: ${file}`,
        path: relPath
      });
    }
    if (!step7PlatformHeadingPattern.test(content)) {
      pushIssue(issues, {
        code: "missing-step7-platform-section",
        message: `Step 7 publish material must include at least one ## 平台 section: ${file}`,
        path: relPath
      });
    }
    if (!step7AvoidHeadingPattern.test(content)) {
      pushIssue(issues, {
        code: "missing-step7-avoid-section",
        message: `Step 7 publish material must include ## 避免: section: ${file}`,
        path: relPath
      });
    }
  }
}

async function verifyStep0(projectRoot: string, issues: VerificationIssue[]): Promise<void> {
  const step0Dir = STEP_DIR_BY_NUMBER[0];
  for (const file of STEP0_FILES) {
    const fullPath = path.join(projectRoot, step0Dir, file);
    if (!(await fs.pathExists(fullPath))) {
      pushIssue(issues, {
        code: "missing-step0-file",
        message: `Missing Step 0 file: ${file}`,
        path: path.join(step0Dir, file)
      });
    }
  }
  const libraryRoot = path.join(projectRoot, step0Dir, "_资料库");
  if (await fs.pathExists(libraryRoot)) {
    const entries = await fs.readdir(libraryRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !researchSourceIdPattern.test(entry.name)) {
        pushIssue(issues, {
          code: "invalid-research-source-id",
          message: `Invalid research source id directory: ${entry.name}`,
          path: path.join(step0Dir, "_资料库", entry.name)
        });
      }
    }
  }
}

async function verifyResearchSensitiveAuthMaterial(projectRoot: string, issues: VerificationIssue[]): Promise<void> {
  const files = await listMarkdownFiles(projectRoot);
  const jsonFiles = await listProjectTextFiles(projectRoot, [".json"]);
  for (const relPath of [...files, ...jsonFiles]) {
    const normalized = relPath.replace(/\\/g, "/");
    if (ignoredResearchArchiveDirs.some((dir) => normalized.includes(dir))) {
      continue;
    }
    const content = await fs.readFile(path.join(projectRoot, relPath), "utf8");
    if (sensitiveAuthPattern.test(content)) {
      pushIssue(issues, {
        code: "research-sensitive-auth-material",
        message: "Found possible auth material in project text file",
        path: relPath
      });
    }
  }
}

async function verifyStep4(graph: ShotGraph, issues: VerificationIssue[]): Promise<void> {
  for (const file of graph.files.filter((candidate) => candidate.step === 4)) {
    const relPath = file.relPath;
    const content = file.content;
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
    if (/避免[：:]\s*避免[：:]/u.test(content)) {
      pushIssue(issues, {
        code: "step4-avoid-double-prefix",
        message: "Found duplicated `避免：` prefix in Step 4 contract",
        path: relPath
      });
    }
    const quickGuide = sectionAfterHeading(content, "## 快速导读");
    const metaMarker = step4QuickGuideMetaMarkers.find((marker) => quickGuide.includes(marker));
    if (metaMarker) {
      pushIssue(issues, {
        code: "step4-quick-guide-meta-language",
        message: `Step 4 快速导读 must stay pure visual facts; found meta-language marker: ${metaMarker}`,
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

async function verifyStep4PlatformExecutionSettings(
  graph: ShotGraph,
  defaultImagePlatform: Platform,
  issues: VerificationIssue[]
): Promise<void> {
  if (defaultImagePlatform !== "midjourney" && defaultImagePlatform !== "gpt-image-2") {
    return;
  }
  const cjkPattern = /[\u4e00-\u9fff]/u;
  const gptImage2ForbiddenMjPattern =
    /(?:--v\b|--ar\b|--style\s+raw\b|--raw\b|--stylize\b|--s\b|--sref\b|--oref\b|--cref\b|--cw\b|--no\b|--q\b|--profile\b|--chaos\b|--weird\b|--seed\b|--tile\b|--repeat\b|--draft\b|::)/iu;
  for (const file of graph.files.filter((candidate) => candidate.step === 4 && candidate.shotId !== undefined)) {
    const relPath = file.relPath;
    const content = file.content;
    const hasHeading = /^##\s*平台执行参数\s*$/mu.test(content);
    const platformSection = hasHeading ? sectionAfterHeading(content, "## 平台执行参数") : "";

    if (defaultImagePlatform === "midjourney") {
      const missingMarker = !hasHeading
        ? "## 平台执行参数"
        : step4PlatformExecutionMarkers.slice(1).find((marker) => !platformSection.includes(marker));
      if (missingMarker) {
        pushIssue(issues, {
          code: "missing-step4-platform-execution-setting",
          message: `Step 4 must include 平台执行参数 with ${missingMarker} for midjourney`,
          path: relPath
        });
        continue;
      }
      const promptBlock = sectionAfterHeading(content, "## 可复制提示词");
      const promptBody = promptBlock.replace(/避免[：:][\s\S]*$/u, "").trim();
      if (promptBody.length > step4MidjourneyPromptMaxLength) {
        pushIssue(issues, {
          code: "step4-midjourney-prompt-too-long",
          message: `Step 4 midjourney prompt body exceeds ${step4MidjourneyPromptMaxLength} characters`,
          path: relPath
        });
      }
      const styleLine = platformSection.split(/\r?\n/).find((line) => line.includes("风格参数")) ?? "";
      const validStyle = /(?:^|\W)--style raw(?:\s|$)/u.test(styleLine) || /(?:^|\W)--raw(?:\s|$)/u.test(styleLine);
      if (styleLine && !validStyle) {
        pushIssue(issues, {
          code: "invalid-step4-midjourney-style-parameter",
          message: "Step 4 midjourney 平台执行参数 must use --style raw (or --raw)",
          path: relPath
        });
      }
      const stylizeLine = platformSection.split(/\r?\n/).find((line) => /stylize/i.test(line)) ?? "";
      const stylizeNumber = stylizeLine.match(/(\d+)/)?.[1];
      if (stylizeNumber && Number.parseInt(stylizeNumber, 10) > step4MidjourneyStylizeMax) {
        pushIssue(issues, {
          code: "invalid-step4-midjourney-stylize-range",
          message: `Step 4 midjourney stylize must be 0-${step4MidjourneyStylizeMax}`,
          path: relPath
        });
      }
      const chineseBlock = sectionAfterHeading(content, "## 中文完整版本");
      const chineseBody = chineseBlock.replace(/```text|```/gu, "").replace(/避免[：:][\s\S]*$/u, "").trim();
      if (chineseBody.replace(/\s+/gu, "").length < step4MidjourneyMinChineseLength) {
        pushIssue(issues, {
          code: "invalid-step4-midjourney-chinese-length",
          message: `Step 4 midjourney Chinese full prompt must be at least ${step4MidjourneyMinChineseLength} non-whitespace characters`,
          path: relPath
        });
      }
      if (cjkPattern.test(promptBody)) {
        pushIssue(issues, {
          code: "invalid-step4-midjourney-copyable-language",
          message: "Step 4 midjourney copyable prompt must be English",
          path: relPath
        });
      }
      const scannableContent = `${platformSection}\n${promptBlock}`;
      const forbidden = step4MidjourneyForbiddenParameters.find((parameter) =>
        parameter === "--cw" ? /\B--cw\b/u.test(scannableContent) : scannableContent.includes(parameter)
      );
      if (/\b--q\b/u.test(scannableContent) || forbidden) {
        pushIssue(issues, {
          code: "invalid-step4-midjourney-parameter",
          message: "Step 4 midjourney prompt uses parameters unsupported in V8 (--cref / --cw / --q / ::)",
          path: relPath
        });
      }
      continue;
    }

    // gpt-image-2 (LibTV lib-image-2) prompt contract.
    const missingMarker = !hasHeading
      ? "## 平台执行参数"
      : ["gpt-image-2", "lib-image-2"].find((marker) => !platformSection.includes(marker));
    if (missingMarker) {
      pushIssue(issues, {
        code: "missing-step4-gpt-image-2-platform-setting",
        message: `Step 4 must include 平台执行参数 with ${missingMarker} for gpt-image-2`,
        path: relPath
      });
      continue;
    }
    const promptBlock = sectionAfterHeading(content, "## 可复制提示词");
    const promptBody = promptBlock.replace(/避免[：:][\s\S]*$/u, "").trim();
    if (!cjkPattern.test(promptBody)) {
      pushIssue(issues, {
        code: "invalid-step4-gpt-image-2-copyable-language",
        message: "Step 4 gpt-image-2 copyable prompt must be Chinese natural language",
        path: relPath
      });
    }
    const scannableContent = `${platformSection}\n${promptBlock}`;
    if (gptImage2ForbiddenMjPattern.test(scannableContent)) {
      pushIssue(issues, {
        code: "invalid-step4-gpt-image-2-parameter",
        message: "Step 4 gpt-image-2 prompt must not use Midjourney parameters",
        path: relPath
      });
    }
  }
}

async function verifyStep5NegativeConstraints(graph: ShotGraph, issues: VerificationIssue[]): Promise<void> {
  for (const file of graph.files.filter((candidate) => candidate.step === 5 && candidate.shotId !== undefined)) {
    const relPath = file.relPath;
    const negativeBlock = sectionAfterHeading(file.content, "## 负面约束");
    const lines = negativeBlock
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
      .filter((line) => line.length > 0);
    const customLines = lines.filter((line) => !step5GenericNegativeNormalized.has(normalizeNegativeLine(line)));
    if (lines.length > 0 && customLines.length === 0) {
      pushIssue(issues, {
        code: "step5-generic-negative-only",
        message: "Step 5 负面约束 must include at least one shot-specific constraint beyond the template defaults",
        path: relPath
      });
    }
  }
}

function verifyShotGraphContract(
  graph: ShotGraph,
  issues: VerificationIssue[],
  requireKeyframes: boolean,
  contentTreeMode = false
): void {
  for (const group of graph.groups.filter((candidate) => candidate.shots.length > 0 && !candidate.description)) {
    pushIssue(issues, {
      code: "missing-shot-group",
      message: `Shot group ${group.id} must include 00_镜头组说明.md in Step 3`,
      path: `${STEP_DIR_BY_NUMBER[3]}/${group.directoryName}`
    });
  }
  for (const file of graph.ungroupedShotFiles) {
    pushIssue(issues, {
      code: "missing-shot-group",
      message: "Shot files must live under a 镜头组-001 directory",
      path: file.relPath
    });
  }
  for (const duplicate of graph.duplicateShotFiles) {
    pushIssue(issues, {
      code: "duplicate-shot-id",
      message: `Shot id ${duplicate.shotId} appears more than once in Step ${duplicate.step}`,
      path: duplicate.relPaths.join(", ")
    });
  }
  for (const mismatch of graph.groupMismatches) {
    pushIssue(issues, {
      code: "shot-group-mismatch",
      message: `Shot ${mismatch.shotId} is split across groups: ${mismatch.groupIds.join(", ")}`,
      path: mismatch.relPaths.join(", ")
    });
  }
  for (const shot of graph.shots) {
    if (!shot.storyboard) {
      continue;
    }
    const segments = shot.storyboardSegments;
    const consecutive = segments.every((value, index) => value === index + 1);
    if (segments.length < 1 || segments.length > 6 || !consecutive) {
      pushIssue(issues, {
        code: "invalid-storyboard-segment-count",
        message: `Storyboard ${shot.id} must declare 1-6 consecutive 分镜 sections — use \`### 分镜 N\` headings numbered 1..6 (entry-style \`- 分镜 1：...\` lines are not supported)`,
        path: shot.storyboard.relPath
      });
    }
    // 内容树允许整镜没有独立关键帧（分镜里显式写明「本段没有单独关键帧」），
    // 所以下限按内容树口径放到 0；上限仍是 min(4, max(分镜数, 1))，不重新定值。
    const keyframeFloor = contentTreeMode ? 0 : 1;
    const keyframeCeiling = Math.min(4, Math.max(segments.length, 1));
    if (requireKeyframes && (shot.imagePrompts.length < keyframeFloor || shot.imagePrompts.length > keyframeCeiling)) {
      pushIssue(issues, {
        code: "invalid-keyframe-mapping",
        message: `Shot ${shot.id} must select ${keyframeFloor}-${keyframeCeiling} keyframes`,
        path: shot.storyboard.relPath
      });
    }
    if (!requireKeyframes || shot.imagePrompts.length < 1) {
      continue;
    }
    for (const imagePrompt of shot.imagePrompts) {
      const mappedSegment = keyframeMappedSegment(imagePrompt.content);
      // 元信息里的人读编号（镜头组-001 / 镜头-001）与内部标识（group-001 / shot-001）指向同一实体：
      // 两种写法都接受，旧项目无需迁移，新项目按人读编号生成也能通过同一映射校验。
      const declaredGroup = imagePrompt.content
        .match(/镜头组\s*[：:]\s*((?:group|镜头组)-\d{3})/iu)?.[1]
        ?.toLowerCase()
        .replace(/^镜头组-/u, "group-");
      const declaredShot = imagePrompt.content
        .match(/镜头编号\s*[：:]\s*((?:shot|镜头)-\d{3})/iu)?.[1]
        ?.toLowerCase()
        .replace(/^镜头-/u, "shot-");
      const hasMoment = /关键时刻\s*[：:]\s*\S+/u.test(imagePrompt.content);
      if (
        !imagePrompt.keyframeId ||
        !mappedSegment ||
        !segments.includes(mappedSegment) ||
        declaredGroup !== shot.groupId ||
        declaredShot !== shot.id ||
        !hasMoment
      ) {
        pushIssue(issues, {
          code: "invalid-keyframe-mapping",
          message: `Keyframe must declare matching 镜头组、镜头编号、对应分镜和关键时刻 for ${shot.id}`,
          path: imagePrompt.relPath
        });
      }
    }
    if (shot.videoPrompt) {
      const videoShots = shot.videoPromptShots;
      const videoConsecutive = videoShots.every((value, index) => value === index + 1);
      if (videoShots.length < 1 || videoShots.length > 6 || !videoConsecutive || videoShots.length !== segments.length) {
        pushIssue(issues, {
          code: "invalid-step5-contract",
          message: `Step 5 ${shot.id} must contain 1-6 continuous 镜头N sections matching Step 3 分镜 count`,
          path: shot.videoPrompt.relPath
        });
      }
    }
  }
  for (const shot of graph.shots.filter((candidate) => !candidate.storyboard && candidate.imagePrompts.length > 0)) {
    for (const imagePrompt of shot.imagePrompts) {
      pushIssue(issues, {
        code: "invalid-keyframe-mapping",
        message: `Keyframe cannot map without a Step 3 storyboard for ${shot.id}`,
        path: imagePrompt.relPath
      });
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
        message: `Main character ${missing.name} must declare ${missing.expectedToken} — each character must be its own flat \`## <角色名>\` section with \`主角色：是\` and the tri-view reference in the same section (nested layouts like \`## 角色细节\` + \`### 角色一\` are not supported)`,
        path: relPath
      });
    }
    for (const missing of findMissingSceneReferenceImages(content)) {
      pushIssue(issues, {
        code: missing.code,
        message: `Special scene ${missing.name} must declare ${missing.expectedToken} — each scene must be its own flat \`## <场景名>\` section with \`需要场景图：是\` and the scene image reference in the same section (nested layouts like \`## 场景细节\` + \`### 场景一\` are not supported)`,
        path: relPath
      });
    }
  }
}

async function verifyStep2DeclaredAssetUsage(projectRoot: string, graph: ShotGraph, issues: VerificationIssue[]): Promise<void> {
  const step2FullDir = path.join(projectRoot, step2Dir);
  if (!(await fs.pathExists(step2FullDir))) {
    return;
  }
  const step2Files = (await fs.readdir(step2FullDir)).filter((name) => name.endsWith(".md"));
  const declaredTokens = new Set<string>();
  for (const file of step2Files) {
    const content = await fs.readFile(path.join(step2FullDir, file), "utf8");
    for (const asset of declaredReferenceAssetTokens(content)) {
      declaredTokens.add(asset.token);
    }
  }
  if (declaredTokens.size === 0) {
    return;
  }
  for (const file of graph.files) {
    if (file.step < 3 || file.step > 5 || file.shotId === undefined) {
      continue;
    }
    for (const asset of extractReferenceAssets(file.content)) {
      if (!declaredTokens.has(asset.token)) {
        pushIssue(issues, {
          code: "undeclared-reference-asset",
          message: `Reference asset ${asset.token} is used in Step ${file.step} but not declared in Step 2 (${asset.name}). Only sections with 主角色：是 or 需要场景图：是 declare a token.`,
          path: file.relPath
        });
      }
    }
  }
}

async function verifyStep3Step4Traceability(
  projectRoot: string,
  graph: ShotGraph,
  issues: VerificationIssue[],
  contentTreeMode = false
): Promise<void> {
  const graphPaths = new Set(graph.files.map((file) => file.relPath));
  for (const shot of graph.shots) {
    if (!shot.storyboard) {
      continue;
    }
    const relPath = shot.storyboard.relPath;
    const content = shot.storyboard.content;
    const requiredReferenceAssets = extractReferenceAssets(content);
    if (hasReferenceAssetRequirementSection(content) && requiredReferenceAssets.length === 0) {
      pushIssue(issues, {
        code: "missing-storyboard-reference-assets",
        message: "Storyboard reference asset section is empty; declare required @xx三视图 or @xx场景图 assets",
        path: relPath
      });
    }
    if (contentTreeMode) {
      // 内容树模式：Step 4 目标由内容树的稳定身份推导（shot.imagePrompts 就是本镜的 04 执行文件），
      // 不要求镜头汇总里再手写一遍 04 链接；缺文件由内容树检查负责报。
      for (const imagePrompt of shot.imagePrompts) {
        const targetPath = path.join(projectRoot, ...imagePrompt.relPath.split("/"));
        if (!(await fs.pathExists(targetPath))) {
          continue;
        }
        if (requiredReferenceAssets.length > 0) {
          const step4Content = await fs.readFile(targetPath, "utf8");
          const missingAssets = missingReferenceAssets(requiredReferenceAssets, extractReferenceAssets(step4Content));
          for (const asset of missingAssets) {
            pushIssue(issues, {
              code: "missing-step4-reference-asset",
              message: `Step 4 prompt must include required reference asset: ${asset.token}`,
              path: imagePrompt.relPath
            });
          }
        }
      }
      continue;
    }
    const linkedPaths = linkedStepFiles(shot.storyboard, 4);
    if (linkedPaths.length === 0) {
      pushIssue(issues, {
        code: "missing-step3-step4-link",
        message: "Storyboard file does not link to a Step 4 image prompt",
        path: relPath
      });
      continue;
    }
    for (const target of linkedPaths) {
      const targetPath = path.join(projectRoot, ...target.split("/"));
      if (!graphPaths.has(target) || !(await fs.pathExists(targetPath))) {
        pushIssue(issues, {
          code: "broken-step3-step4-link",
          message: `Storyboard file links to missing Step 4 target: ${target}`,
          path: relPath
        });
        continue;
      }
      const linkedFile = graph.files.find((file) => file.relPath === target);
      if (linkedFile && (linkedFile.shotId !== shot.id || linkedFile.groupId !== shot.groupId)) {
        pushIssue(issues, {
          code: "invalid-keyframe-mapping",
          message: `Storyboard ${shot.id} links a keyframe from another shot or group: ${target}`,
          path: relPath
        });
      }
      if (requiredReferenceAssets.length > 0) {
        const step4Content = await fs.readFile(targetPath, "utf8");
        const missingAssets = missingReferenceAssets(requiredReferenceAssets, extractReferenceAssets(step4Content));
        for (const asset of missingAssets) {
          pushIssue(issues, {
            code: "missing-step4-reference-asset",
            message: `Step 4 prompt must include required reference asset: ${asset.token}`,
            path: target
          });
        }
      }
    }
    for (const imagePrompt of shot.imagePrompts) {
      if (!linkedPaths.includes(imagePrompt.relPath)) {
        pushIssue(issues, {
          code: "invalid-keyframe-mapping",
          message: `Storyboard must link selected keyframe: ${imagePrompt.relPath}`,
          path: relPath
        });
      }
    }
  }
}

async function verifyStep4Step5ReferenceAssets(graph: ShotGraph, issues: VerificationIssue[]): Promise<void> {
  for (const shot of graph.shots) {
    if (!shot.videoPrompt || shot.imagePrompts.length === 0) {
      continue;
    }
    const requiredReferenceAssets = shot.imagePrompts.flatMap((imagePrompt) => extractReferenceAssets(imagePrompt.content));
    if (requiredReferenceAssets.length === 0) {
      continue;
    }
    const videoRelPath = shot.videoPrompt.relPath;
    const missingAssets = missingReferenceAssets(requiredReferenceAssets, extractReferenceAssets(shot.videoPrompt.content));
    for (const asset of missingAssets) {
      pushIssue(issues, {
        code: "missing-step5-reference-asset",
        message: `Step 5 prompt must inherit Step 4 reference asset: ${asset.token}`,
        path: videoRelPath
      });
    }
  }
}

async function verifyStep5PlatformExecutionSettings(
  graph: ShotGraph,
  defaultVideoPlatform: Platform,
  issues: VerificationIssue[]
): Promise<void> {
  for (const file of graph.files.filter((candidate) => candidate.step === 5 && candidate.shotId !== undefined)) {
    const relPath = file.relPath;
    const content = file.content;
    const missingSection = step5RequiredSections.find((section) => !content.includes(section));
    const missingMarker = step5PlatformExecutionMarkers.find((marker) => !content.includes(marker));
    const copyPrompt = content.match(/## 可复制提示词\s*([\s\S]*?)(?=\n## |$)/u)?.[1] ?? "";
    const seedanceSettingsMissing =
      defaultVideoPlatform === "seedance" && (!content.includes("Seedance 2.0") || !content.includes("全能参考模式"));
    const driftingMixedSlot = /\{\{Mixed\s*\d+\}\}/iu.test(content);
    // 只改消息：把缺失项逐条点名，通过／失败条件与 issue code 仍由下面同一组布尔值决定。
    const missingSeedanceSettings = ["Seedance 2.0", "全能参考模式"].filter(
      (word) => defaultVideoPlatform === "seedance" && !content.includes(word)
    );
    const missingCopyPromptMarkers = ["无配乐", "无字幕"].filter((word) => !copyPrompt.includes(word));
    const missingItems: string[] = [];
    if (missingSection) missingItems.push("小节 " + missingSection);
    if (missingMarker) missingItems.push("平台执行项 " + missingMarker);
    if (!content.includes(defaultVideoPlatform)) missingItems.push("平台名 " + defaultVideoPlatform);
    missingItems.push(...missingSeedanceSettings, ...missingCopyPromptMarkers);
    if (driftingMixedSlot) missingItems.push("提示词里仍有 {{Mixed N}} 占位");
    if (
      missingSection ||
      missingMarker ||
      !content.includes(defaultVideoPlatform) ||
      seedanceSettingsMissing ||
      !copyPrompt.includes("无配乐") ||
      !copyPrompt.includes("无字幕") ||
      driftingMixedSlot
    ) {
      pushIssue(issues, {
        code: missingSection || !copyPrompt.includes("无配乐") || !copyPrompt.includes("无字幕") || driftingMixedSlot
          ? "invalid-step5-contract"
          : "missing-step5-platform-execution-setting",
        message: `Step 5 缺少必需内容：${missingItems.join("、")}（平台 ${defaultVideoPlatform}；正式提示词契约见 workflow-spec Step 5）`,
        path: relPath
      });
    }
  }
  // Image platform parameters are banned across the whole Step 5 layer, including
  // shot-group template files without a shot id: those templates get copied into
  // per-shot files, so scanning only shot-domain files lets a violating template
  // pass verify as a "compliant" seed.
  for (const file of graph.files.filter((candidate) => candidate.step === 5)) {
    const forbiddenImageParameter = step5ForbiddenImagePlatformParameters.find((parameter) =>
      file.content.includes(parameter)
    );
    if (forbiddenImageParameter) {
      pushIssue(issues, {
        code: "step5-forbidden-image-platform-parameter",
        message: `Step 5 must not include image platform parameter: ${forbiddenImageParameter}`,
        path: file.relPath
      });
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
  return (
    content.includes("project-step-files") ||
    content.includes("enabled Step files") ||
    content.includes("已启用步骤文件") ||
    content.includes("Step 1 to Step 6 files") ||
    content.includes("步骤一到步骤六文件")
  );
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

/* ------------------------------ 内容树校验 ------------------------------ */

/** 旧格式镜头文件名：与 shot-graph 旧路径同一口径（03 递归、04／05 递归）。 */
const legacyShotFileNamePattern = /(?:^|[-_ ])(?:镜头|shot)[-_ ]?(\d+)/iu;
const fencedBlockPattern = new RegExp("\u0060{3,}[^\\n]*\\n([\\s\\S]*?)\u0060{3,}", "u");
/** 已由 verifyShotGraphContract 用同一文件报过的错误码，合并内容树问题时不再重复。 */
const contentTreeOverlappingCodes = new Set<string>(["invalid-storyboard-segment-count", "invalid-keyframe-mapping"]);

/**
 * 旧 03／04／05 目录下仍然存在的旧格式镜头文件（相对项目根、正斜杠）。
 *
 * 判定口径与 shot-graph 旧路径一致：03 递归、04／05 递归，文件名匹配「镜头N／shotN」。
 * 内容树自己生成在 04／05 的执行文件（镜头-NNN.md、镜头-NNN-关键帧-NN.md）不算旧正文，
 * 由 expectedExecution 排除，否则新格式项目会误报「两套正文并存」。
 */
async function listLegacyShotMarkdownFiles(projectRoot: string, expectedExecution: Set<string>): Promise<string[]> {
  const found: string[] = [];
  for (const step of [3, 4, 5] as const) {
    const stepDir = STEP_DIR_BY_NUMBER[step];
    const absDir = path.join(projectRoot, stepDir);
    if (!(await fs.pathExists(absDir))) continue;
    for (const relPath of await listMarkdownFiles(absDir)) {
      if (!legacyShotFileNamePattern.test(path.basename(relPath))) continue;
      const projectRelPath = normalizeProjectRelPath(path.join(stepDir, relPath));
      if (expectedExecution.has(projectRelPath)) continue;
      // 已迁移的旧正文在「已迁移/」里有只读快照：原件保留但不再参与检查与投影，
      // 不算「两套正文并存」（规范 §7.8）。
      if (await hasMigrationSnapshot(projectRoot, projectRelPath)) continue;
      found.push(projectRelPath);
    }
  }
  return found.sort();
}

/** 取「## 可复制提示词」里的第一个代码块正文；没有区块或没有代码块返回 null。 */
function copyablePromptBody(content: string): string | null {
  const section = sectionAfterHeading(content, "## 可复制提示词");
  if (section.trim().length === 0) return null;
  const matched = fencedBlockPattern.exec(section);
  return matched ? (matched[1] ?? "").replace(/\n+$/u, "") : null;
}

function joinPromptParts(parts: Array<string | null>): string {
  return parts
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0)
    .join("\n\n");
}

/**
 * 内容树模式下的专项校验。
 *
 * 结构问题直接并入 buildContentTree 的结果；本函数另外负责：
 * 1. 新旧两套正文并存；
 * 2. 汇总自动区块与拼装结果（过期／手工改动）；
 * 3. 05 执行文件与拼装结果（过期）；
 * 4. 汇总展示的整镜正文与 05 执行文件（互不相等）；
 * 5. 03 内容树索引是否存在（链接存在性交给通用链接检查）。
 *
 * 同一处不一致只报一次：汇总文件与 05 文件各自最多一条。
 */
async function verifyContentTree(
  projectRoot: string,
  shotGraph: ShotGraph,
  issues: VerificationIssue[]
): Promise<void> {
  const resolution = await resolveContentMode(projectRoot);
  // 版本号这类问题在总入口已经报过一次；同一处只报一次，读的人不会被重复条目干扰。
  const alreadyReported = new Set(issues.map((issue) => `${issue.code}::${issue.path ?? ""}`));
  for (const issue of resolution.issues) {
    const key = `${issue.code}::${issue.path ?? ""}`;
    if (alreadyReported.has(key)) continue;
    alreadyReported.add(key);
    pushIssue(issues, issue);
  }
  if (resolution.mode !== "content-tree") {
    return;
  }
  // 声明了新格式但没有「内容/」目录：上面已经报 content-tree-missing，不再叠加结构问题。
  if (!resolution.contentRootExists) {
    return;
  }

  const tree = await buildContentTree(projectRoot);
  const reportedKeys = new Set(issues.map((issue) => `${issue.code}::${issue.path ?? ""}`));
  for (const issue of tree.issues) {
    if (contentTreeOverlappingCodes.has(issue.code)) {
      const key = `${issue.code}::${issue.path ?? ""}`;
      if (reportedKeys.has(key)) continue;
      reportedKeys.add(key);
    }
    pushIssue(issues, issue);
  }

  // 内容树自己生成的 04／05 执行文件，不算「旧正文」。
  const expectedExecution = new Set<string>();
  for (const shot of tree.shots) {
    expectedExecution.add(normalizeProjectRelPath(step5FileRelPath(shot)));
    for (const storyboard of shot.storyboards) {
      for (const keyframe of storyboard.document.keyframes) {
        expectedExecution.add(normalizeProjectRelPath(step4FileRelPath(shot, keyframe.id)));
      }
    }
  }

  // 1. 新旧两套正文并存：内容树模式以内容树为准。
  const legacyFiles = await listLegacyShotMarkdownFiles(projectRoot, expectedExecution);
  if (legacyFiles.length > 0) {
    pushIssue(issues, {
      code: "content-legacy-and-tree-coexist",
      message:
        "项目已声明内容树格式（content.format_version），03／04／05 里却还留着旧格式镜头正文：" +
        legacyFiles.join("、") +
        "。以内容树「内容/」为准；旧正文请迁入「" +
        MIGRATED_SNAPSHOT_DIRECTORY +
        "/」作为只读快照，不要两套并存。",
      path: legacyFiles[0]
    });
  }

  // 5. Step 3 索引必须存在（索引里的相对链接由通用链接检查负责）。
  const indexRelPath = normalizeProjectRelPath(path.join(STEP_DIR_BY_NUMBER[3], CONTENT_INDEX_FILE));
  if (!(await fs.pathExists(path.join(projectRoot, indexRelPath)))) {
    pushIssue(issues, {
      code: "content-index-missing",
      message: "内容树模式下 " + STEP_DIR_BY_NUMBER[3] + " 必须保留「" + CONTENT_INDEX_FILE + "」，指向内容树，不复制正文。",
      path: indexRelPath
    });
  }

  const step5ByShot = new Map<string, string>();
  for (const graphShot of shotGraph.shots) {
    if (graphShot.videoPrompt) {
      step5ByShot.set(graphShot.id, normalizeProjectRelPath(graphShot.videoPrompt.relPath));
    }
  }

  for (const shot of tree.shots) {
    if (shot.assembly.text === null || shot.assembly.segments.length === 0) {
      // 拼装本身失败：原因已由内容树结构检查报出，这里不再比对。
      continue;
    }
    if (!(await fs.pathExists(path.join(projectRoot, shot.relPath)))) {
      continue;
    }

    const shotLabel = shot.shotId.replace(/^shot-/u, "镜头-");
    const assembledSegments = shot.assembly.segments
      .map((segment) => segment.text.replace(/\n+$/u, ""))
      .join("\n\n");
    const summaryBlock = shot.document.segmentsBody;
    const summaryActual = summaryBlock === null ? null : stripBlockHash(summaryBlock).replace(/\n+$/u, "");
    const summaryFresh =
      summaryActual !== null && normalizeLineEndings(summaryActual) === normalizeLineEndings(assembledSegments);
    const summaryWholeText = joinPromptParts([shot.document.promptBefore, summaryActual, shot.document.promptAfter]);

    if (summaryBlock === null) {
      pushIssue(issues, {
        code: "content-summary-stale",
        message:
          "「" + shot.relPath + "」缺少自动区块「镜头段拼装」；镜头汇总必须由各分镜片段拼装后刷新（content assemble）。",
        path: shot.relPath
      });
    } else if (autoBlockDrifted(summaryBlock)) {
      pushIssue(issues, {
        code: "content-summary-manual-drift",
        message:
          "「" + shot.relPath + "」的自动区块「镜头段拼装」被手工改过（区块内记录的哈希与正文不符）；" +
          "自动区块只能由工具刷新，正文请改对应的分镜文件。",
        path: shot.relPath
      });
    } else if (!summaryFresh) {
      pushIssue(issues, {
        code: "content-summary-stale",
        message:
          "「" + shot.relPath + "」的自动区块「镜头段拼装」与按分镜重新拼装的结果不一致；正文改过之后要重新整理（content assemble）。",
        path: shot.relPath
      });
    }

    const step5RelPath = step5ByShot.get(shot.shotId);
    if (step5RelPath === undefined) {
      pushIssue(issues, {
        code: "content-execution-stale",
        message:
          shotLabel + " 缺少 05 执行文件（" + STEP_DIR_BY_NUMBER[5] + " 下应有一份由内容树生成的完整执行文件）；请重新整理（content assemble）。自动区块被手改时需 content assemble --force（覆盖前会备份到 .tmp/）。",
        path: path.posix.join(STEP_DIR_BY_NUMBER[5], shotGroupDirectoryName(shot.groupId), shotLabel + ".md")
      });
      continue;
    }
    const step5Content = await fs.readFile(path.join(projectRoot, step5RelPath), "utf8");
    const step5Copyable = copyablePromptBody(step5Content);
    if (step5Copyable === null) {
      pushIssue(issues, {
        code: "content-summary-execution-mismatch",
        message:
          "「" + step5RelPath + "」没有「## 可复制提示词」代码块，无法与镜头汇总「" + shot.relPath + "」逐字核对；" +
          "05 执行文件必须保持 Step 5 文件合同。区块被手改删除时需 content assemble --force（覆盖前会备份到 .tmp/）恢复。",
        path: step5RelPath
      });
      continue;
    }
    if (normalizeLineEndings(step5Copyable) !== normalizeLineEndings(shot.assembly.text)) {
      if (summaryFresh) {
        pushIssue(issues, {
          code: "content-execution-stale",
          message:
            "「" + step5RelPath + "」的可复制提示词与镜头 " + shotLabel + " 的当前拼装结果不一致（汇总「" +
            shot.relPath + "」已是最新）；05 执行文件落后，请重新整理（content assemble）。自动区块被手改时需 content assemble --force（覆盖前会备份到 .tmp/），不要手改执行文件。",
          path: step5RelPath
        });
      } else if (normalizeLineEndings(step5Copyable) !== normalizeLineEndings(summaryWholeText)) {
        pushIssue(issues, {
          code: "content-summary-execution-mismatch",
          message:
            "镜头 " + shotLabel + " 的汇总「" + shot.relPath + "」与 05 执行文件「" + step5RelPath +
            "」展示的整镜正文互不相等，且都与当前拼装结果不一致；请重新整理后再核对。自动区块被手改时需 content assemble --force（覆盖前会备份到 .tmp/）。",
          path: step5RelPath
        });
      }
    }
  }

  // 分镜速览区块与 04／05 执行文件的新鲜度，与 content check 同口径：
  // 正文标注行、展示名、素材状态等改动后没有重新整理时，verify 也要能报出来。
  const materialIndex = await loadMaterialIndex(projectRoot);
  const { config } = await readProjectConfig(projectRoot);
  await checkExecutionFileFreshness(projectRoot, tree, materialIndex, platformDefaults(config), issues);
  for (const shot of tree.shots) {
    const absPath = path.join(projectRoot, shot.relPath);
    if (!(await fs.pathExists(absPath))) continue;
    const content = await fs.readFile(absPath, "utf8");
    const digestBody = getContentBlockBody(content, CONTENT_BLOCK_NAMES.shotSegmentDigest);
    if (digestBody === null) continue;
    const expected = stripTrailingNewlines(renderShotSegmentDigest(shot));
    const actual = stripTrailingNewlines(stripBlockHash(digestBody));
    if (actual !== expected) {
      pushIssue(issues, {
        code: "content-summary-stale",
        message:
          "「" + shot.relPath + "」的自动区块「" + CONTENT_BLOCK_NAMES.shotSegmentDigest + "」与分镜正文不一致；正文改过之后要重新整理（content assemble）。",
        path: shot.relPath
      });
    }
  }
}

export async function verifyProject({
  projectRoot,
  ide,
  step,
  strict
}: {
  projectRoot: string;
  ide: Ide;
  pack: string;
  /**
   * Optional step filter 0-7: verify only what has been completed so far. Checks that require
   * artifacts from later steps (for example Step 3 keyframe mapping before Step 4 files exist)
   * are skipped, turning the command into a per-step gate.
   */
  step?: number;
  /**
   * When true, ignore registered deviations in deviations.yaml and report all matching issues.
   * Defaults to false: explicitly registered deviations are accepted and shown as accepted.
   */
  strict?: boolean;
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
    const declaredContentVersion = contentFormatVersion(config);
    if (!isSupportedContentFormatVersion(declaredContentVersion)) {
      pushIssue(issues, {
        code: "unsupported-content-format",
        message:
          "project.config.yaml 声明的内容树格式版本 " +
          String(declaredContentVersion) +
          " 本工具还不支持；请升级工具或改回受支持的版本（缺这个键的旧项目按旧格式读取，不受影响）",
        path: "project.config.yaml"
      });
    }
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
  if (step === undefined || step >= 0) {
    if (config && researchStepEnabled(config)) {
      await verifyStep0(projectRoot, issues);
    }
  }
  if (step === undefined || step >= 2) {
    await verifyStep2ReferenceAssets(projectRoot, issues);
  }
  const contentMode = await resolveContentMode(projectRoot);
  const contentTreeMode = contentMode.mode === "content-tree";
  const shotGraph = await buildShotGraph(projectRoot);
  const requireKeyframes = step === undefined || step >= 4;
  verifyShotGraphContract(shotGraph, issues, requireKeyframes, contentTreeMode);
  await verifyContentTree(projectRoot, shotGraph, issues);
  if (step === undefined || step >= 3) {
    await verifyStep2DeclaredAssetUsage(projectRoot, shotGraph, issues);
  }
  if (step === undefined || step >= 4) {
    await verifyStep4(shotGraph, issues);
    if (config?.platforms.image.default) {
      await verifyStep4PlatformExecutionSettings(shotGraph, config.platforms.image.default, issues);
    }
    await verifyStep3Step4Traceability(projectRoot, shotGraph, issues, contentTreeMode);
  }
  if (step === undefined || step >= 5) {
    await verifyStep4Step5ReferenceAssets(shotGraph, issues);
    await verifyStep5NegativeConstraints(shotGraph, issues);
    if (config?.platforms.video.default) {
      await verifyStep5PlatformExecutionSettings(shotGraph, config.platforms.video.default, issues);
    }
  }
  if (step === undefined || step >= 6) {
    await verifyStep6(projectRoot, issues);
  }
  if (step === undefined || step >= 7) {
    await verifyStep7(projectRoot, issues);
  }
  await verifyResearchSensitiveAuthMaterial(projectRoot, issues);
  await verifyRelativeMarkdownLinks(projectRoot, issues);
  await verifyRelativeMarkdownLinkTargets(projectRoot, issues, step);
  await verifyIdeRuntime(projectRoot, ide, issues);
  await verifySharedAgentWorkspace(projectRoot, ide, issues);
  await verifyMediaRecords(projectRoot, issues);

  const { mode, deviations, shots, issues: deviationIssues } = await readDeviations(projectRoot);
  for (const issue of deviationIssues) {
    pushIssue(issues, issue);
  }
  const shotByPath = new Map<string, string>();
  for (const file of shotGraph.files) {
    if (file.shotId) {
      shotByPath.set(normalizeProjectRelPath(file.relPath), file.shotId);
    }
  }
  const { issues: finalIssues, acceptedDeviations } = applyAcceptedDeviations(
    issues,
    deviations,
    strict ?? false,
    mode,
    shots,
    shotByPath
  );
  return {
    ok: finalIssues.length === 0,
    issues: finalIssues,
    ...(acceptedDeviations.length > 0 ? { acceptedDeviations } : {})
  };
}
