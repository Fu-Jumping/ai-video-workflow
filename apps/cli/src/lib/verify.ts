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
import { STEP0_FILES, STEP6_FILES, STEP_DIR_BY_NUMBER, researchStepEnabled } from "./constants.js";
import { readProjectConfig } from "./project-config.js";
import { projectRootIssues } from "./project-root.js";
import {
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
// Template-generic negative constraints. A Step 5 file must add at least one shot-specific
// constraint beyond these defaults, otherwise the negative block is not per-shot customized.
const step5GenericNegativeDefaults = [
  "不得超过 15 秒。",
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
const ignoredMarkdownDirs = new Set(["node_modules", ".git"]);
const ignoredGeneratedViewRootDirs = ["_views", ".obsidian"] as const;
const ignoredRootMarkdownDirs = new Set([...cherryHostSurfaceDirs, ...ignoredGeneratedViewRootDirs]);
const ignoredRootMarkdownFiles = new Set(cherryHostSurfaceFiles);
const absoluteLinkPattern = /([A-Za-z]:\\|[A-Za-z]:\/|file:\/\/|vscode:\/\/|\]\(\/(?!\/))/;
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

function verifyShotGraphContract(graph: ShotGraph, issues: VerificationIssue[], requireKeyframes: boolean): void {
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
    if (segments.length < 1 || segments.length > 4 || !consecutive) {
      pushIssue(issues, {
        code: "invalid-storyboard-segment-count",
        message: `Storyboard ${shot.id} must declare 1-4 consecutive 分镜 sections`,
        path: shot.storyboard.relPath
      });
    }
    if (requireKeyframes && (shot.imagePrompts.length < 1 || shot.imagePrompts.length > Math.min(4, Math.max(segments.length, 1)))) {
      pushIssue(issues, {
        code: "invalid-keyframe-mapping",
        message: `Shot ${shot.id} must select 1-${Math.min(4, Math.max(segments.length, 1))} keyframes`,
        path: shot.storyboard.relPath
      });
    }
    if (!requireKeyframes || shot.imagePrompts.length < 1) {
      continue;
    }
    for (const imagePrompt of shot.imagePrompts) {
      const mappedSegment = keyframeMappedSegment(imagePrompt.content);
      const declaredGroup = imagePrompt.content.match(/镜头组\s*[：:]\s*(group-\d{3})/iu)?.[1]?.toLowerCase();
      const declaredShot = imagePrompt.content.match(/镜头编号\s*[：:]\s*(shot-\d{3})/iu)?.[1]?.toLowerCase();
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
      if (videoShots.length < 1 || videoShots.length > 4 || !videoConsecutive || videoShots.length !== segments.length) {
        pushIssue(issues, {
          code: "invalid-step5-contract",
          message: `Step 5 ${shot.id} must contain 1-4 continuous 镜头N sections matching Step 3 分镜 count`,
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

async function verifyStep3Step4Traceability(projectRoot: string, graph: ShotGraph, issues: VerificationIssue[]): Promise<void> {
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
        message: `Step 5 must use the formal prompt contract for ${defaultVideoPlatform}, semantic references, 无配乐 and 无字幕`,
        path: relPath
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

export async function verifyProject({
  projectRoot,
  ide,
  step
}: {
  projectRoot: string;
  ide: Ide;
  pack: string;
  /**
   * Optional step filter 0-6: verify only what has been completed so far. Checks that require
   * artifacts from later steps (for example Step 3 keyframe mapping before Step 4 files exist)
   * are skipped, turning the command into a per-step gate.
   */
  step?: number;
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
  if (step === undefined || step >= 0) {
    if (config && researchStepEnabled(config)) {
      await verifyStep0(projectRoot, issues);
    }
  }
  if (step === undefined || step >= 2) {
    await verifyStep2ReferenceAssets(projectRoot, issues);
  }
  const shotGraph = await buildShotGraph(projectRoot);
  const requireKeyframes = step === undefined || step >= 4;
  verifyShotGraphContract(shotGraph, issues, requireKeyframes);
  if (step === undefined || step >= 4) {
    await verifyStep4(shotGraph, issues);
    await verifyStep3Step4Traceability(projectRoot, shotGraph, issues);
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
  await verifyResearchSensitiveAuthMaterial(projectRoot, issues);
  await verifyRelativeMarkdownLinks(projectRoot, issues);
  await verifyIdeRuntime(projectRoot, ide, issues);
  await verifySharedAgentWorkspace(projectRoot, ide, issues);
  return { ok: issues.length === 0, issues };
}
