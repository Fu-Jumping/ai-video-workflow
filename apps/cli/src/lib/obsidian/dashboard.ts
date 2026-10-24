import type { ObsidianGeneratedFile, ObsidianSourceFile } from "./types.js";
import { wikiLinkTargetForVaultPath, workflowVaultPath } from "./markdown.js";
import { shotReviewCanvasPath } from "./canvas.js";
import {
  contentScenePagePath,
  contentStoryboardPagePath,
  contentTreeIndexPath,
  notesIndexLink,
  notesIndexPath,
  agentHandoffPath,
  collaborationTemplatesDirectory,
  communityPluginRecipesPath,
  projectHomePath,
  productionBoardPath,
  projectionInfoPath,
  reviewOverviewPath,
  reviewMapCanvasPath,
  shotBasePath,
  shotGroupPagePath,
  shotLookupIndexPath,
  singleShotPagePath,
  stageReviewHubPath,
  stageReviewOverviewPath,
  stageReviewPath,
  mediaReviewIndexPath,
  mediaReviewPagePath,
  shotReviewNotePath,
  workflowBasePath,
  workflowCanvasPath,
  shotPipelineCanvasPath,
  productionStatusBasePath
} from "./routes.js";
import { CONTENT_ROOT_DIRECTORY } from "../constants.js";
import {
  sceneIdFromDirectory,
  shotGroupIdFromDirectory,
  shotIdFromDirectory,
  storyboardIdFromFileName
} from "../content-tree.js";
import { obsidianProperties, obsidianPropertyValues } from "./properties.js";
import { deviationScopeMatches, type DeviationsReadResult } from "../deviations.js";
import { formatReferenceAssets } from "../reference-assets.js";
import type { ReferenceAssetToken } from "../reference-assets.js";
import type { WorkflowDeviation, WorkflowShotMode } from "../types.js";
import type { LibTvState } from "../libtv/types.js";
import {
  canonicalMediaObjectId,
  canonicalMediaPurpose,
  formatMediaCandidate,
  formatMediaVersion,
  mediaIdentityCanonicalKey,
  mediaOutputDirectory,
  mediaPurposeDisplayName,
  mediaTimecodeSeconds,
  type MediaCandidateRecord,
  type MediaRecord
} from "../media-records.js";
import {
  humanReviewStateLabels,
  primaryMediaCandidate,
  summarizeHumanReviewStates,
  type HumanReviewState
} from "../media-human-state.js";
import {
  mediaCandidateKey,
  recordHumanReviewState,
  type MediaReviewDisplay
} from "./media-viewer.js";

function uniqueShotIds(sourceFiles: ObsidianSourceFile[]): string[] {
  return [...new Set(sourceFiles.map((file) => file.shotId).filter((shotId): shotId is string => Boolean(shotId)))].sort();
}

function uniqueShotGroupIds(sourceFiles: ObsidianSourceFile[]): string[] {
  return [...new Set(sourceFiles.map((file) => file.shotGroupId).filter((id): id is string => Boolean(id)))].sort();
}

function filesForKind(sourceFiles: ObsidianSourceFile[], kind: ObsidianSourceFile["sourceKind"]): ObsidianSourceFile[] {
  return sourceFiles.filter((sourceFile) => sourceFile.sourceKind === kind);
}

function shotDisplayName(shotId: string, sourceFiles: ObsidianSourceFile[]): string {
  const shotFiles = sourceFiles.filter((file) => file.shotId === shotId);
  const storyboard = shotFiles.find((file) => file.sourceKind === "storyboard");
  const title = storyboard?.headingTitle ?? storyboard?.title ?? shotFiles[0]?.headingTitle ?? shotFiles[0]?.title;
  return title?.trim() || shotId;
}

function shotOrder(shotId: string): number | undefined {
  const match = shotId.match(/(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

function compareStageFiles(left: ObsidianSourceFile, right: ObsidianSourceFile): number {
  const group = (left.shotGroupId ?? "").localeCompare(right.shotGroupId ?? "");
  if (group !== 0) {
    return group;
  }
  const leftOrder = shotOrder(left.shotId ?? "") ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = shotOrder(right.shotId ?? "") ?? Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  return left.sourcePath.localeCompare(right.sourcePath);
}

function stageReviewCheckList(step: number): string {
  if (step === 0) {
    return "- 研究资料是否有可追溯来源，摘录是否保留原文语义。\n- 创作简报是否提炼出可执行的主题、风格、规格与制作链路。";
  }
  if (step === 1) {
    return "- 故事内核是否给出清晰主题、冲突、人物动机与结局落点。\n- 是否与 Step 0 研究结论一致，且不编造事实。";
  }
  if (step === 2) {
    return "- 角色与场景设定是否完整、一致，并为 Step 3/4 提供明确参考资产。\n- 设定是否支撑故事内核并避免内部代号。";
  }
  if (step === 3) {
    return "- 画面事实、构图、动作和镜头衔接是否清楚。\n- 每个镜头是否明确需要的关键帧，以及 Step 4 的帧级对应关系。";
  }
  if (step === 4) {
    return "- 每个关键帧是否与对应 Step 3 分镜保持帧级对齐。\n- 图片提示词是否自足、完整，并携带全部必需参考资产。";
  }
  if (step === 5) {
    return "- 视频提示词是否继承 Step 4 的视觉状态。\n- 运动、时长、平台执行设置和负面约束是否可执行。";
  }
  if (step === 6) {
    return "- 执行计划是否覆盖全部镜头、素材、顺序、依赖与风险。\n- 未锁版或未放行的镜头是否没有被当作已成片。";
  }
  if (step === 7) {
    return "- 发布物料是否基于 Step 1 故事内核与 Step 3 分镜高光。\n- 平台分区、来源亮点、避免项与发布总表是否一致，且无编造成片卖点。";
  }
  return "- 本阶段文件是否完整，并与上下游保持一致。";
}

function renderStageReviewHub(step: number, sourceFiles: ObsidianSourceFile[], availableSteps: number[]): ObsidianGeneratedFile {
  const stageFiles = sourceFiles.filter((file) => file.step === step).sort(compareStageFiles);
  const groupIds = [...new Set(stageFiles.map((file) => file.shotGroupId).filter((id): id is string => Boolean(id)))].sort();
  const groupSections = groupIds.map((groupId) => {
    const links = stageFiles
      .filter((file) => file.shotGroupId === groupId && file.shotId)
      .sort(compareStageFiles)
      .map((file) => `- [[${wikiLinkTargetForVaultPath(workflowVaultPath(file))}|${file.title}]]`)
      .join("\n");
    return `### ${groupId}\n\n${links || "- 尚未发现镜头文件。"}`;
  });
  const ungrouped = stageFiles
    .filter((file) => !file.shotGroupId || !file.shotId)
    .map((file) => `- [[${wikiLinkTargetForVaultPath(workflowVaultPath(file))}|${file.title}]]`)
    .join("\n");
  const sequence = [...groupSections, ungrouped ? `### 其他阶段文件\n\n${ungrouped}` : ""].filter(Boolean).join("\n\n") || "- 尚未发现本阶段文件。";
  const previousStep = [...availableSteps].filter((candidate) => candidate < step).at(-1);
  const nextStep = availableSteps.find((candidate) => candidate > step);
  const previous = previousStep === undefined
    ? "- 上一阶段：无"
    : `- 上一阶段：[[${stageReviewHubPath(previousStep)}|返回上一阶段]]`;
  const next = nextStep === undefined
    ? "- 下一阶段：无"
    : `- 下一阶段：[[${stageReviewHubPath(nextStep)}|进入下一阶段]]`;
  return {
    vaultPath: stageReviewHubPath(step),
    content: `# ${stageReviewPath(step).split("/").at(-1)}审核

## 1. 审核顺序

${sequence}

## 2. 本阶段检查

${stageReviewCheckList(step)}

## 3. 上下游导航

${previous}
${next}
- 异常时按镜头联查：[[${shotLookupIndexPath}|按镜头联查]]
`
  };
}

function linkForKind(sourceFiles: ObsidianSourceFile[], kind: ObsidianSourceFile["sourceKind"], label: string): string {
  const file = sourceFiles.find((sourceFile) => sourceFile.sourceKind === kind);
  return file ? `[[${wikiLinkTargetForVaultPath(workflowVaultPath(file))}|${label}]]` : `${label}: 缺失`;
}

function fileForKind(sourceFiles: ObsidianSourceFile[], kind: ObsidianSourceFile["sourceKind"]): ObsidianSourceFile | undefined {
  return sourceFiles.find((sourceFile) => sourceFile.sourceKind === kind);
}

function embeddedFileForKind(sourceFiles: ObsidianSourceFile[], kind: ObsidianSourceFile["sourceKind"], missingLabel: string): string {
  const file = fileForKind(sourceFiles, kind);
  return file ? `![[${wikiLinkTargetForVaultPath(workflowVaultPath(file))}]]` : `> ${missingLabel}: 缺失`;
}

function embeddedFilesForKind(sourceFiles: ObsidianSourceFile[], kind: ObsidianSourceFile["sourceKind"], missingLabel: string): string {
  const files = filesForKind(sourceFiles, kind);
  return files.length > 0
    ? files.map((file) => `![[${wikiLinkTargetForVaultPath(workflowVaultPath(file))}]]`).join("\n\n")
    : `> ${missingLabel}: 缺失`;
}

function sourcePathForKind(sourceFiles: ObsidianSourceFile[], kind: ObsidianSourceFile["sourceKind"]): string {
  return fileForKind(sourceFiles, kind)?.sourcePath ?? "missing";
}

function sourcePathsForKind(sourceFiles: ObsidianSourceFile[], kind: ObsidianSourceFile["sourceKind"]): string {
  return filesForKind(sourceFiles, kind).map((file) => `\`${file.sourcePath}\``).join(", ") || "missing";
}

function shotNavigation(shotId: string, shotIds: string[], sourceFiles: ObsidianSourceFile[]): string {
  const index = shotIds.indexOf(shotId);
  const previousShotId = index > 0 ? shotIds[index - 1] : undefined;
  const nextShotId = index >= 0 && index < shotIds.length - 1 ? shotIds[index + 1] : undefined;
  return [
    previousShotId ? `- 上一镜头：[[${singleShotPagePath(previousShotId)}|${shotDisplayName(previousShotId, sourceFiles)}]]` : "- 上一镜头：无",
    nextShotId ? `- 下一镜头：[[${singleShotPagePath(nextShotId)}|${shotDisplayName(nextShotId, sourceFiles)}]]` : "- 下一镜头：无"
  ].join("\n");
}

function shotGroupDisplayName(groupId: string, sourceFiles: ObsidianSourceFile[]): string {
  const description = sourceFiles.find((file) => file.shotGroupId === groupId && file.sourceKind === "storyboard" && !file.shotId);
  return description?.headingTitle?.trim() || description?.title?.trim() || groupId;
}

function renderShotGroupHub(groupId: string, sourceFiles: ObsidianSourceFile[]): ObsidianGeneratedFile {
  const groupFiles = sourceFiles.filter((file) => file.shotGroupId === groupId);
  const groupShotIds = uniqueShotIds(groupFiles);
  const description = groupFiles.find((file) => file.sourceKind === "storyboard" && !file.shotId);
  const sourcePath = description?.sourcePath ?? groupFiles[0]?.sourcePath;
  const sourcePathLine = sourcePath ? `${obsidianProperties.sourcePath}: ${sourcePath}\n` : "";
  const title = shotGroupDisplayName(groupId, sourceFiles);
  const shotLinks = groupShotIds.map((shotId) => `- [[${singleShotPagePath(shotId)}|${shotDisplayName(shotId, sourceFiles)}]]`).join("\n") || "- 尚未发现镜头。";
  return {
    vaultPath: shotGroupPagePath(groupId),
    sourcePath,
    content: `---
${obsidianProperties.projectionGenerated}: ${obsidianPropertyValues.yes}
${obsidianProperties.title}: ${JSON.stringify(title)}
${obsidianProperties.sourceKind}: ${obsidianPropertyValues.sourceKind.index}
${sourcePathLine}${obsidianProperties.shotGroupId}: ${groupId}
${obsidianProperties.status}: ${obsidianPropertyValues.ready}
tags:
  - ai-video/project
  - ai-video/shot-group/${groupId}
  - ai-video/type/index
---

# ${title}

## 1. 导航

- [[${projectHomePath}|首页]]
- [[${shotLookupIndexPath}|按镜头联查]]

## 2. 组内镜头

${shotLinks}

## 3. 镜头组说明

${description ? `![[${wikiLinkTargetForVaultPath(workflowVaultPath(description))}]]` : "> 镜头组说明：缺失"}
`
  };
}

function yesNoProperty(value: boolean): string {
  return value ? obsidianPropertyValues.yes : obsidianPropertyValues.no;
}

function referenceAssetsForFiles(sourceFiles: ObsidianSourceFile[]): ReferenceAssetToken[] {
  const seen = new Set<string>();
  const assets: ReferenceAssetToken[] = [];
  for (const sourceFile of sourceFiles) {
    for (const asset of sourceFile.referenceAssets ?? []) {
      if (seen.has(asset.token)) {
        continue;
      }
      seen.add(asset.token);
      assets.push(asset);
    }
  }
  return assets;
}

function referenceAssetsText(sourceFiles: ObsidianSourceFile[]): string {
  return formatReferenceAssets(referenceAssetsForFiles(sourceFiles));
}

function renderShotHandoffEntry(shotId: string, shotIndex: number, shotFiles: ObsidianSourceFile[], allSourceFiles: ObsidianSourceFile[]): string {
  const storyboardSourcePath = sourcePathForKind(shotFiles, "storyboard");
  const videoPromptSourcePath = sourcePathForKind(shotFiles, "video-prompt");
  const executionPlanSourcePath = sourcePathForKind(allSourceFiles, "execution-plan");
  const displayName = shotDisplayName(shotId, allSourceFiles);
  const referenceAssets = referenceAssetsText(shotFiles);
  return `### 2.${shotIndex + 1} [[${singleShotPagePath(shotId)}|${displayName}]]

- 审阅画布：[[${shotReviewCanvasPath(shotId)}|审阅画布]]
- 分镜脚本源文件：\`${storyboardSourcePath}\`
- 步骤四图片提示词源文件：${sourcePathsForKind(shotFiles, "image-prompt")}
- 步骤五视频提示词源文件：\`${videoPromptSourcePath}\`
- 必带参考资产：${referenceAssets}
- 执行计划源文件：\`${executionPlanSourcePath}\``;
}

function renderShotEditEntry(): string {
  return `## 7. 修改入口

- 需要智能体修改源文件时：[[${agentHandoffPath}#2. 单镜头交接|智能体交接]]`;
}

function renderLibtvDecisionText(libtvState: LibTvState | null | undefined, shotId: string): string {
  const items = (libtvState?.keyframes ?? []).filter((item) => item.shotId === shotId);
  if (items.length === 0) {
    return "> 尚无 LibTV 关键帧执行状态；执行 `ai-video-workflow libtv apply --only keyframes` 后可在状态文件中查看。";
  }
  return items.map((item) => {
    const lastRound = item.refineRounds && item.refineRounds.length > 0
      ? item.refineRounds[item.refineRounds.length - 1]
      : undefined;
    return [
      `- ${item.keyframeId}: status=${item.status}`,
      item.reviewDecision ? `  - 审阅决策：${item.reviewDecision}` : "",
      item.finalNodeId ? `  - 最终采用：${item.finalNodeId}` : "",
      item.refineRounds && item.refineRounds.length > 0 ? `  - 精修轮数：${item.refineRounds.length}` : "",
      lastRound ? `  - 最近精修：${lastRound.refineNodeId}（基准 ${lastRound.base}）` : "",
      item.feedback ? `  - 用户反馈：${item.feedback}` : ""
    ].filter(Boolean).join("\n");
  }).join("\n");
}

/** 内容树模式下，这个镜头自己的分镜页面入口；旧格式没有内容树，返回空串。 */
function contentStoryboardLinksForShot(shotId: string, sourceFiles: ObsidianSourceFile[]): string {
  const entries = contentTreeEntries(sourceFiles).filter((entry) => entry.shotId === shotId && entry.storyboardId);
  if (entries.length === 0) {
    return "";
  }
  return entries
    .sort((left, right) => left.sourcePath.localeCompare(right.sourcePath))
    .map((entry) => `- 分镜 ${entry.storyboardId}：[[${contentStoryboardPagePath(shotId, entry.storyboardId ?? "")}|${entry.storyboardId}]]`)
    .join("\n");
}

/**
 * 镜头页与分镜页共用的媒体片段（C3）。
 *
 * 素材记录仍然是唯一事实源；这里只读展示：当前选用、原文件相对路径、素材审阅页入口、
 * 选中版本嵌入与全部候选的文字表。旧版本图片不嵌入，避免页面变重。
 */
function shotMediaRecords(shotId: string, display?: MediaReviewDisplay): { keyframes: MediaRecord[]; videos: MediaRecord[] } {
  const records = display?.records ?? [];
  const keyframes = records
    .filter(
      (record) =>
        record.identity.category === "keyframe" && canonicalMediaObjectId(record.identity.objectId) === shotId
    )
    .sort((left, right) =>
      canonicalMediaPurpose("keyframe", left.identity.purpose).localeCompare(
        canonicalMediaPurpose("keyframe", right.identity.purpose),
        "zh-Hans-CN"
      )
    );
  const videos = records.filter(
    (record) => record.identity.category === "video" && canonicalMediaObjectId(record.identity.objectId) === shotId
  );
  return { keyframes, videos };
}

function mediaRecordRelativePath(record: MediaRecord, candidate: MediaCandidateRecord): string {
  return mediaOutputDirectory(record.identity) + "/" + candidate.fileName;
}

function escapeMediaCell(value: string): string {
  return value.split("|").join("｜").split("\n").join(" ").trim();
}

function candidateHumanState(
  record: MediaRecord,
  candidate: MediaCandidateRecord,
  display: MediaReviewDisplay
): HumanReviewState {
  return display.humanStates.get(mediaCandidateKey(record.identity, candidate.fileName)) ?? "not-ready";
}

/** 镜头汇总：只看每条素材的主候选；没有主候选就记一条「还没准备好」。 */
function shotHumanReviewState(shotId: string, display?: MediaReviewDisplay): HumanReviewState {
  const { keyframes, videos } = shotMediaRecords(shotId, display);
  const states = [...keyframes, ...videos].map((record) =>
    display ? recordHumanReviewState(record, display.humanStates) : "not-ready"
  );
  return summarizeHumanReviewStates(states);
}

function renderMediaRecordBlock(record: MediaRecord, display: MediaReviewDisplay): string[] {
  const primary = primaryMediaCandidate(record);
  const state = recordHumanReviewState(record, display.humanStates);
  const lines = [
    "#### " + mediaPurposeDisplayName(record.identity.category, record.identity.purpose) + "（" + humanReviewStateLabels[state] + "）",
    ""
  ];
  if (primary) {
    lines.push("- 当前选用：v" + String(primary.version) + " / 候选 " + String(primary.candidate));
  } else if (record.currentSelection) {
    lines.push("- 当前选用：版本未知（当前选用在候选里找不到）");
  } else {
    lines.push("- 当前选用：未选用（版本未知）");
  }
  const relativePath = primary ? mediaRecordRelativePath(record, primary) : undefined;
  lines.push("- 原文件（项目内相对路径）：" + (relativePath ?? "（没有当前选用）"));
  const pageTarget = wikiLinkTargetForVaultPath(
    mediaReviewPagePath(record.identity.category, record.identity.objectId, record.identity.purpose)
  );
  lines.push("- 素材审阅页：[[" + pageTarget + "|打开素材审阅页（全部候选版本）]]");
  if (primary) {
    const asset = display.assetsByCandidate.get(mediaCandidateKey(record.identity, primary.fileName));
    if (asset?.exists) {
      const seconds = record.identity.category === "video" ? mediaTimecodeSeconds(primary.timecode) : undefined;
      lines.push("", "![[" + asset.embedTarget + (seconds !== undefined ? "#t=" + String(seconds) : "") + "]]");
      if (primary.timecode) {
        lines.push("", "时间位置：" + primary.timecode);
      }
    } else if (relativePath) {
      lines.push("", "- 缺少：" + relativePath);
    }
  }
  lines.push("", "| 版本 | 候选 | 人工审核 | 时间位置 | 文件 |", "| --- | --- | --- | --- | --- |");
  if (record.candidates.length === 0) {
    lines.push("| - | - | - | - | 暂无候选 |");
  }
  for (const candidate of record.candidates) {
    lines.push(
      "| " +
        formatMediaVersion(candidate.version) +
        " | " +
        formatMediaCandidate(candidate.candidate) +
        " | " +
        humanReviewStateLabels[candidateHumanState(record, candidate, display)] +
        " | " +
        (candidate.timecode ?? "-") +
        " | " +
        escapeMediaCell(candidate.fileName) +
        " |"
    );
  }
  return lines;
}

function renderShotMediaSection(shotId: string, display?: MediaReviewDisplay): string {
  const { keyframes, videos } = shotMediaRecords(shotId, display);
  if (!display || keyframes.length + videos.length === 0) {
    return "> 本镜媒体：还没准备好（还没有关键帧或视频素材记录）。";
  }
  const blocks: string[] = [];
  if (keyframes.length > 0) {
    blocks.push("### 关键帧");
    for (const record of keyframes) {
      blocks.push(renderMediaRecordBlock(record, display).join("\n"));
    }
  }
  if (videos.length > 0) {
    blocks.push("### 整镜视频");
    for (const record of videos) {
      blocks.push(renderMediaRecordBlock(record, display).join("\n"));
    }
  }
  return blocks.join("\n\n");
}

function renderShotHub(
  shotId: string,
  shotFiles: ObsidianSourceFile[],
  allSourceFiles: ObsidianSourceFile[],
  shotIds: string[],
  deviationsContext: DeviationsReadResult,
  libtvState?: LibTvState | null,
  mediaDisplay?: MediaReviewDisplay
): ObsidianGeneratedFile {
  const sourcePath = shotFiles.find((file) => file.sourceKind === "storyboard")?.sourcePath ?? shotFiles[0]?.sourcePath;
  const sourcePathLine = sourcePath ? `${obsidianProperties.sourcePath}: ${sourcePath}\n` : "";
  const order = shotOrder(shotId);
  const shotOrderLine = order === undefined ? "" : `${obsidianProperties.shotOrder}: ${order}\n`;
  const displayName = shotDisplayName(shotId, allSourceFiles);
  const shotDeviations = deviationsForShot(deviationsContext, shotFiles);
  const shotModes = shotModesForShot(deviationsContext, shotId);
  const acceptedDeviationLines = [
    ...shotDeviations.map(
      (deviation) => `- ${deviation.rule}${deviation.scope ? ` [${deviation.scope}]` : ""}${deviation.reason ? ` — ${deviation.reason}` : ""}`
    ),
    ...shotModes.map((shot) => `- ${shot.id}: ${shot.mode}${shot.reason ? ` — ${shot.reason}` : ""}`)
  ];
  const acceptedDeviationsSection = acceptedDeviationLines.length > 0
    ? `\n### 7.1 已接受偏离\n\n${acceptedDeviationLines.join("\n")}\n`
    : "";
  const storyboard = fileForKind(shotFiles, "storyboard");
  const imagePrompt = fileForKind(shotFiles, "image-prompt");
  const videoPrompt = fileForKind(shotFiles, "video-prompt");
  const referenceAssets = referenceAssetsText(shotFiles);
  const reviewCanvasPath = shotReviewCanvasPath(shotId);
  const shotGroupId = shotFiles[0]?.shotGroupId;
  const groupLine = shotGroupId ? `${obsidianProperties.shotGroupId}: ${shotGroupId}\n` : "";
  const groupTag = shotGroupId ? `  - ai-video/shot-group/${shotGroupId}\n` : "";
  const groupNavigation = shotGroupId ? `- 镜头组：[[${shotGroupPagePath(shotGroupId)}|${shotGroupDisplayName(shotGroupId, allSourceFiles)}]]\n` : "";
  const contentStoryboards = contentStoryboardLinksForShot(shotId, allSourceFiles);
  const shotMedia = shotMediaRecords(shotId, mediaDisplay);
  const hasShotMediaRecords = shotMedia.keyframes.length + shotMedia.videos.length > 0;
  const shotHasContentTree = contentTreeEntries(allSourceFiles).some((entry) => entry.shotId === shotId);
  // 旧格式项目（没有内容树、没有素材记录）不追加任何媒体行，页面保持原样。
  const showShotMedia = mediaDisplay !== undefined && (hasShotMediaRecords || shotHasContentTree);
  const shotHumanReviewLine = showShotMedia
    ? "- 人工审核：**" + humanReviewStateLabels[shotHumanReviewState(shotId, mediaDisplay)] + "**"
    : "";
  const shotMediaReviewLine = hasShotMediaRecords
    ? "- 素材审阅：[[" + wikiLinkTargetForVaultPath(mediaReviewIndexPath) + "|素材审阅]]"
    : "";
  const shotMediaInfoBlock = [shotHumanReviewLine, shotMediaReviewLine].filter(Boolean).join("\n");
  return {
    vaultPath: singleShotPagePath(shotId),
    content: `---
${obsidianProperties.projectionGenerated}: ${obsidianPropertyValues.yes}
${obsidianProperties.title}: ${JSON.stringify(displayName)}
${obsidianProperties.shotTitle}: ${JSON.stringify(displayName)}
${obsidianProperties.nextAction}: ${obsidianPropertyValues.nextAction.index}
${obsidianProperties.sourceKind}: ${obsidianPropertyValues.sourceKind.index}
${sourcePathLine}${groupLine}${obsidianProperties.shotId}: ${shotId}
${shotOrderLine}${obsidianProperties.stageGroup}: ${obsidianPropertyValues.stageGroup["shot-review"]}
${obsidianProperties.reviewStatus}: ${obsidianPropertyValues.reviewStatus["shot-review"]}
${obsidianProperties.executionStatus}: ${obsidianPropertyValues.executionStatus["prompt-ready"]}
${obsidianProperties.needsAttention}: ${obsidianPropertyValues.no}
${obsidianProperties.reviewMode}: ${obsidianPropertyValues.reviewMode.immersive}
${obsidianProperties.reviewCanvas}: "[[${reviewCanvasPath}]]"
${obsidianProperties.reviewNote}: "[[${shotReviewNotePath(shotId)}]]"
${obsidianProperties.agentHandoff}: "[[${agentHandoffPath}#2. 单镜头交接|智能体交接]]"
${obsidianProperties.hasStoryboard}: ${yesNoProperty(Boolean(storyboard))}
${obsidianProperties.hasImagePrompt}: ${yesNoProperty(Boolean(imagePrompt))}
${obsidianProperties.hasVideoPrompt}: ${yesNoProperty(Boolean(videoPrompt))}
${obsidianProperties.referenceAssets}: ${JSON.stringify(referenceAssets)}
${obsidianProperties.status}: ${obsidianPropertyValues.ready}
tags:
  - ai-video/project
  - ai-video/shot/${shotId}
${groupTag}  - ai-video/type/index
  - ai-video/status/ready
---

# ${displayName}

## 1. 快速审阅

- 分镜脚本：${linkForKind(shotFiles, "storyboard", "分镜脚本")}
- 图片提示词：${filesForKind(shotFiles, "image-prompt").map((file, index) => `[[${wikiLinkTargetForVaultPath(workflowVaultPath(file))}|关键帧 ${index + 1}]]`).join("、") || "缺失"}
- 视频提示词：${linkForKind(shotFiles, "video-prompt", "视频提示词")}
- 执行计划：${linkForKind(allSourceFiles, "execution-plan", "执行计划")}
- 必带参考资产：${referenceAssets}
- 审阅画布：[[${reviewCanvasPath}|镜头审阅画布]]
- 用户审阅笔记：[[${shotReviewNotePath(shotId)}|${displayName} 审阅笔记]]

${shotMediaInfoBlock ? shotMediaInfoBlock + "\n\n" : ""}## 2. 审阅路径

- 审阅总览：[[${reviewOverviewPath}|审阅总览]]
- 制作看板：[[${productionBoardPath}|制作看板]]
- 审阅地图：[[${reviewMapCanvasPath}|审阅地图]]
${groupNavigation}${contentStoryboards ? `- 本镜分镜（内容树）：\n${contentStoryboards}\n` : ""}${shotNavigation(shotId, shotIds, allSourceFiles)}

## 3. 源文件序列

${embeddedFileForKind(shotFiles, "storyboard", "分镜脚本")}

## 4. 画面连续性

审阅步骤四图片提示词连续性时，以步骤三分镜画面为参照。

${embeddedFilesForKind(shotFiles, "image-prompt", "图片提示词")}

## 4.1 图片出图决策

${renderLibtvDecisionText(libtvState, shotId)}

## 5. 视频提示词

检查步骤五视频提示词是否保留步骤四视觉画面，并且只增加运动、时长、镜头行为和平台执行设置。

${embeddedFileForKind(shotFiles, "video-prompt", "视频提示词")}
${showShotMedia ? `
## 5.1 本镜媒体与版本

${renderShotMediaSection(shotId, mediaDisplay)}
` : ""}
## 6. 执行检查

- 分镜脚本、图片提示词和视频提示词逐镜头对齐。
- Step 4 已携带本页列出的必带参考资产。
- Step 5 已延续同镜头 Step 4 的角色三视图和场景图。
- Step 5 已写清默认视频平台、输入方式、开场参考、时长上限、画幅和负面约束。
- 执行前打开 [[${productionBoardPath}|制作看板]]。
${acceptedDeviationsSection}
${renderShotEditEntry()}

## 8. 审阅画布

![[${reviewCanvasPath}]]
`
  };
}

function renderAgentHandoffPage(shotIds: string[], sourceFiles: ObsidianSourceFile[]): ObsidianGeneratedFile {
  const shotHandoffEntries = shotIds.length > 0
    ? shotIds.map((shotId, index) => renderShotHandoffEntry(shotId, index, sourceFiles.filter((file) => file.shotId === shotId), sourceFiles)).join("\n\n")
    : "尚未发现镜头文件。";
  return {
    vaultPath: agentHandoffPath,
    content: `# 智能体交接

这个页面集中放给智能体的源文件路径、编辑边界和提示词。先在审阅页定位问题，再把对应内容复制到智能体对话中。

## 1. 导航

- 项目首页：[[${projectHomePath}|项目首页]]
- 审阅总览：[[${reviewOverviewPath}|审阅总览]]
- 镜头联查：[[${shotLookupIndexPath}|按镜头联查]]
- 制作看板：[[${productionBoardPath}|制作看板]]
- 流程文件表：[[${workflowBasePath}|流程文件表]]
- 镜头表：[[${shotBasePath}|镜头表]]
- 制作状态表：[[${productionStatusBasePath}|制作状态表]]

## 2. 单镜头交接

${shotHandoffEntries}

## 3. 源文件编辑边界

- 故事意图或镜头构图修改写入步骤三分镜脚本文件。
- 图片构图、主体描述和画面连续性修改写入步骤四图片提示词文件。
- 运动、时长、镜头移动和视频行为修改写入步骤五视频提示词文件。
- 不要把生成的 Obsidian 观看层文件当作工作流源文件编辑。

## 4. 可复制提示词

### 4.1 单镜头检查

\`\`\`text
请检查选中镜头的步骤三分镜脚本、步骤四图片提示词和步骤五视频提示词。
使用“单镜头交接”中对应镜头的源文件路径。
保持步骤三和步骤四逐镜头对齐。
如果需要修改，只编辑步骤源文件，不要编辑生成的 Obsidian 观看层文件。
\`\`\`

### 4.2 步骤四图片提示词修改

\`\`\`text
请更新选中镜头的步骤四图片提示词，使它和步骤三分镜脚本保持逐镜头对齐。
保持步骤四文件合同完整，避免依赖上下文的模糊写法。
检查 Step 4 是否携带单镜头交接中的全部 \`@xx三视图\` / \`@xx场景图\`。
不要编辑生成的 Obsidian 观看层文件。
\`\`\`

### 4.3 步骤五视频提示词修改

\`\`\`text
请更新选中镜头的步骤五视频提示词。
保留步骤四视觉画面，只修改运动、时长、镜头行为、平台执行设置或视频专属细节。
检查 Step 5 是否延续单镜头交接中的全部 \`@xx三视图\` / \`@xx场景图\`。
检查 Step 5 是否写清默认视频平台、输入方式、开场参考、时长上限、画幅和负面约束。
不要编辑生成的 Obsidian 观看层文件。
\`\`\`

### 4.4 全项目验证

\`\`\`text
请在步骤源文件修改后验证项目。
运行项目校验，必要时刷新 Obsidian 观看层，然后运行 verify-obsidian。
用精确源路径报告仍存在的步骤三到步骤四对齐问题或投影问题。
\`\`\`

## 5. 验证命令

\`\`\`powershell
pnpm build
node apps/cli/dist/index.js verify --project <project-path> --ide codex
node apps/cli/dist/index.js export-obsidian --project <project-path> --in-project-view
node apps/cli/dist/index.js verify-obsidian --project <project-path> --in-project-view
\`\`\`
`
  };
}

function renderCommunityPluginRecipes(): ObsidianGeneratedFile {
  return {
    vaultPath: communityPluginRecipesPath,
    content: `# 社区插件配方

默认 Obsidian 观看层只依赖 Obsidian 核心功能。以下配方都是可选项。

## 1. Dataview

当项目需要比核心 Bases 更复杂的查询时，再使用 Dataview。

## 2. Tasks

当项目希望在 vault 中做交互式任务查询时，再使用 Tasks。

## 3. Kanban

当项目需要 Markdown 支撑的看板视图时，再使用 Kanban。

## 4. Excalidraw

当项目需要比核心 Canvas 更强的视觉草图能力时，再使用 Excalidraw。
`
  };
}

function renderDeviationsMarkdown(context: DeviationsReadResult): string {
  const lines: string[] = [];
  if (context.mode !== "standard" || context.deviations.length > 0 || context.shots.length > 0) {
    lines.push("## 6. 已接受偏离与流程模式", "");
    lines.push(`- 流程模式：${context.mode}`);
  }
  if (context.deviations.length > 0) {
    lines.push("", "### 6.1 已登记偏离", "");
    for (const deviation of context.deviations) {
      const scope = deviation.scope ? ` [${deviation.scope}]` : "";
      const reason = deviation.reason ? ` — ${deviation.reason}` : "";
      lines.push(`- ${deviation.rule}${scope}${reason}`);
    }
  }
  if (context.shots.length > 0) {
    lines.push("", "### 6.2 镜头模式", "");
    for (const shot of context.shots) {
      const reason = shot.reason ? ` — ${shot.reason}` : "";
      lines.push(`- ${shot.id}: ${shot.mode}${reason}`);
    }
  }
  return lines.length > 0 ? `${lines.join("\n")}\n` : "";
}

function deviationsForShot(context: DeviationsReadResult, shotFiles: ObsidianSourceFile[]): WorkflowDeviation[] {
  const paths = shotFiles.map((file) => file.sourcePath.replace(/\\/g, "/"));
  return context.deviations.filter((deviation) => deviation.scope && paths.some((filePath) => deviationScopeMatches(deviation.scope, filePath)));
}

function shotModesForShot(context: DeviationsReadResult, shotId: string): WorkflowShotMode[] {
  return context.shots.filter((shot) => shot.id === shotId);
}


// 内容树（内容/）在观看层里的投影。
//
// 旧投影按「阶段 + 镜头组」平铺，内容树里的分镜文件没有自己的页面，索引页也就无处可点。
// 这里按内容树自己的四层（场 / 镜头组 / 镜头 / 分镜）补入口页；只投影「内容/」下真实存在的
// 文件，链接目标全部在本函数组里一起产出，避免出现指向不存在文件的链接。
interface ContentTreeEntry {
  sourcePath: string;
  sceneId: string | null;
  groupId: string | null;
  shotId: string | null;
  storyboardId: string | null;
}

function contentTreeEntries(sourceFiles: ObsidianSourceFile[]): ContentTreeEntry[] {
  const prefix = `${CONTENT_ROOT_DIRECTORY}/`;
  return sourceFiles
    .filter((file) => file.sourcePath.startsWith(prefix))
    .map((file) => {
      const segments = file.sourcePath.split("/");
      const fileName = segments.at(-1) ?? "";
      return {
        sourcePath: file.sourcePath,
        sceneId: segments[1] ? sceneIdFromDirectory(segments[1]) : null,
        groupId: segments[2] ? shotGroupIdFromDirectory(segments[2]) : null,
        shotId: segments[3] ? shotIdFromDirectory(segments[3]) : null,
        storyboardId: storyboardIdFromFileName(fileName)
      };
    });
}

function contentEntryLink(entry: ContentTreeEntry, sourceFiles: ObsidianSourceFile[], label?: string): string {
  const file = sourceFiles.find((candidate) => candidate.sourcePath === entry.sourcePath);
  if (!file) {
    return label ?? entry.sourcePath;
  }
  return `[[${wikiLinkTargetForVaultPath(workflowVaultPath(file))}|${label ?? file.headingTitle ?? file.title}]]`;
}

function contentOverviewEntries(entries: ContentTreeEntry[]): ContentTreeEntry[] {
  return entries.filter((entry) => !entry.sceneId && !entry.groupId && !entry.shotId && !entry.storyboardId);
}

function renderContentTreeIndex(sourceFiles: ObsidianSourceFile[]): ObsidianGeneratedFile | null {
  const entries = contentTreeEntries(sourceFiles);
  if (entries.length === 0) {
    return null;
  }
  const overviews = contentOverviewEntries(entries)
    .map((entry) => `- ${contentEntryLink(entry, sourceFiles)}`)
    .join("\n");
  const sceneIds = [...new Set(entries.map((entry) => entry.sceneId).filter((id): id is string => Boolean(id)))].sort();
  const sceneLinks = sceneIds
    .map((sceneId) => {
      const sceneEntry = entries.find((entry) => entry.sceneId === sceneId && entry.groupId === null);
      return `- [[${contentScenePagePath(sceneId)}|${sceneId}]]${sceneEntry ? ` - ${contentEntryLink(sceneEntry, sourceFiles)}` : ""}`;
    })
    .join("\n");
  const storyboardEntries = entries
    .filter((entry) => entry.storyboardId && entry.shotId)
    .sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
  const storyboardLinks = storyboardEntries
    .map((entry) => `- [[${contentStoryboardPagePath(entry.shotId ?? "", entry.storyboardId ?? "")}|${entry.storyboardId}]] - ${contentEntryLink(entry, sourceFiles)}`)
    .join("\n");
  return {
    vaultPath: contentTreeIndexPath,
    content: `# 内容树

内容树是正文的唯一事实源，按「场 → 镜头组 → 镜头 → 分镜」分层。这里只做入口索引，正文仍在源文件里。

## 1. 总表

${overviews || "- 尚未发现内容树总表。"}

## 2. 场

${sceneLinks || "- 尚未发现场目录。"}

## 3. 分镜

${storyboardLinks || "- 尚未发现分镜文件。"}
`
  };
}

function renderContentScenePage(sceneId: string, sourceFiles: ObsidianSourceFile[]): ObsidianGeneratedFile {
  const entries = contentTreeEntries(sourceFiles).filter((entry) => entry.sceneId === sceneId);
  const sceneOverview = entries.find((entry) => entry.groupId === null && entry.shotId === null);
  const groupIds = [...new Set(entries.map((entry) => entry.groupId).filter((id): id is string => Boolean(id)))].sort();
  const groupSections = groupIds.map((groupId) => {
    const groupOverview = entries.find((entry) => entry.groupId === groupId && entry.shotId === null);
    const shots = entries.filter((entry) => entry.groupId === groupId && entry.shotId && !entry.storyboardId);
    const shotLinks = shots
      .map((shot) => {
        const shotStoryboards = entries.filter((entry) => entry.groupId === groupId && entry.shotId === shot.shotId && entry.storyboardId);
        const storyboardLinks = shotStoryboards
          .map((storyboard) => `  - [[${contentStoryboardPagePath(shot.shotId ?? "", storyboard.storyboardId ?? "")}|${storyboard.storyboardId}]]`)
          .join("\n");
        return [`- ${contentEntryLink(shot, sourceFiles)}`, storyboardLinks].filter(Boolean).join("\n");
      })
      .join("\n");
    return `### ${groupId}

${groupOverview ? `- 组总览：${contentEntryLink(groupOverview, sourceFiles)}` : "- 组总览：缺失"}

${shotLinks || "- 尚未发现镜头。"}`;
  });
  return {
    vaultPath: contentScenePagePath(sceneId),
    content: `# ${sceneId}

## 1. 导航

- [[${contentTreeIndexPath}|内容树]]
- [[${shotLookupIndexPath}|按镜头联查]]

## 2. 场总览

${sceneOverview ? `![[${wikiLinkTargetForVaultPath(workflowVaultPath(sourceFiles.find((file) => file.sourcePath === sceneOverview.sourcePath)!))}]]` : "> 场总览：缺失"}

## 3. 镜头组与镜头

${groupSections.join("\n\n") || "- 尚未发现镜头组。"}
`
  };
}

function storyboardKeyframeIds(storyboardFile: ObsidianSourceFile | undefined): string[] {
  return storyboardFile?.keyframeIds ?? [];
}

function renderStoryboardFrame(
  shotId: string,
  keyframeId: string,
  mediaDisplay?: MediaReviewDisplay
): string {
  const targetKey = mediaIdentityCanonicalKey({ category: "keyframe", objectId: shotId, purpose: keyframeId });
  const record = mediaDisplay?.records.find(
    (candidate) => mediaIdentityCanonicalKey(candidate.identity) === targetKey
  );
  if (!record || !mediaDisplay) {
    return [
      "#### " + mediaPurposeDisplayName("keyframe", keyframeId) + "（" + humanReviewStateLabels["not-ready"] + "）",
      "",
      "- 还没有素材记录。"
    ].join("\n");
  }
  return renderMediaRecordBlock(record, mediaDisplay).join("\n");
}

function renderStoryboardFrames(
  shotId: string,
  storyboardFile: ObsidianSourceFile | undefined,
  mediaDisplay?: MediaReviewDisplay
): string {
  const keyframeIds = storyboardKeyframeIds(storyboardFile);
  if (keyframeIds.length === 0) {
    return "- 本段没有独立关键帧。";
  }
  return keyframeIds.map((keyframeId) => renderStoryboardFrame(shotId, keyframeId, mediaDisplay)).join("\n\n");
}

function storyboardPromptLink(file: ObsidianSourceFile): string {
  return "[[" + wikiLinkTargetForVaultPath(workflowVaultPath(file)) + "|" + (file.headingTitle?.trim() || file.title) + "]]";
}

function renderStoryboardPrompts(shotId: string, sourceFiles: ObsidianSourceFile[], storyboardFile?: ObsidianSourceFile): string {
  const keyframeLabels = storyboardKeyframeIds(storyboardFile).map((keyframeId) => keyframeId.replace(/^keyframe-/u, ""));
  const step4Files = sourceFiles.filter(
    (file) =>
      file.sourceKind === "image-prompt" &&
      file.shotId === shotId &&
      keyframeLabels.some((label) => file.sourcePath.includes("关键帧-" + label))
  );
  const step5Files = sourceFiles.filter((file) => file.sourceKind === "video-prompt" && file.shotId === shotId);
  const missingLine = (step: string, label: string): string =>
    "- " + step + " 执行文件（" + label + "）：缺失（运行 content assemble 生成执行文件）";
  const step4Lines =
    step4Files.length > 0
      ? step4Files.map((file) => "- Step 4 执行文件（关键帧图片提示词）：" + storyboardPromptLink(file)).join("\n")
      : missingLine("Step 4", "关键帧图片提示词");
  const step5Lines =
    step5Files.length > 0
      ? step5Files.map((file) => "- Step 5 执行文件（整镜视频提示词）：" + storyboardPromptLink(file)).join("\n")
      : missingLine("Step 5", "整镜视频提示词");
  return [
    step4Lines,
    step5Lines,
    "",
    "指回正文：本段画面见第 2 节「本段画面」，提示词执行文件见第 3 节「本段提示词」，完整正文见第 4 节「本段正文」。"
  ].join("\n");
}

function renderContentStoryboardPage(
  shotId: string,
  storyboardId: string,
  sourceFiles: ObsidianSourceFile[],
  mediaDisplay?: MediaReviewDisplay
): ObsidianGeneratedFile {
  const entries = contentTreeEntries(sourceFiles).filter((entry) => entry.shotId === shotId);
  const storyboard = entries.find((entry) => entry.storyboardId === storyboardId);
  const shotEntry = entries.find((entry) => !entry.storyboardId);
  const storyboardFile = sourceFiles.find((file) => file.sourcePath === storyboard?.sourcePath);
  return {
    vaultPath: contentStoryboardPagePath(shotId, storyboardId),
    content: `# ${storyboardFile?.headingTitle?.trim() || storyboardId}

## 1. 导航

- [[${contentTreeIndexPath}|内容树]]
- 所属镜头：${shotEntry ? contentEntryLink(shotEntry, sourceFiles) : shotId}
- 镜头页：[[${singleShotPagePath(shotId)}|${shotDisplayName(shotId, sourceFiles)}]]

## 2. 本段画面

${renderStoryboardFrames(shotId, storyboardFile, mediaDisplay)}

## 3. 本段提示词

${renderStoryboardPrompts(shotId, sourceFiles, storyboardFile)}

## 4. 本段正文

${storyboardFile ? `![[${wikiLinkTargetForVaultPath(workflowVaultPath(storyboardFile))}]]` : "> 分镜文件：缺失"}
`
  };
}

function contentTreeFiles(sourceFiles: ObsidianSourceFile[], mediaDisplay?: MediaReviewDisplay): ObsidianGeneratedFile[] {
  const index = renderContentTreeIndex(sourceFiles);
  if (!index) {
    return [];
  }
  const entries = contentTreeEntries(sourceFiles);
  const sceneIds = [...new Set(entries.map((entry) => entry.sceneId).filter((id): id is string => Boolean(id)))].sort();
  const storyboardKeys = [
    ...new Set(
      entries
        .filter((entry) => entry.storyboardId && entry.shotId)
        .map((entry) => `${entry.shotId ?? ""}/${entry.storyboardId ?? ""}`)
    )
  ].sort();
  return [
    index,
    ...sceneIds.map((sceneId) => renderContentScenePage(sceneId, sourceFiles)),
    ...storyboardKeys.map((key) => {
      const [shotId, storyboardId] = key.split("/");
      return renderContentStoryboardPage(shotId ?? "", storyboardId ?? "", sourceFiles, mediaDisplay);
    })
  ];
}

export function renderDashboardFiles(
  projectName: string,
  sourceFiles: ObsidianSourceFile[],
  includePluginRecipes: boolean,
  deviationsContext: DeviationsReadResult = { mode: "standard", deviations: [], shots: [], issues: [] },
  libtvState?: LibTvState | null,
  hasMediaReviewIndex = false,
  mediaDisplay?: MediaReviewDisplay
): ObsidianGeneratedFile[] {
  const shotIds = uniqueShotIds(sourceFiles);
  const shotGroupIds = uniqueShotGroupIds(sourceFiles);
  const shotLinks = shotIds.length > 0
    ? shotIds.map((shotId) => `- [[${singleShotPagePath(shotId)}|${shotDisplayName(shotId, sourceFiles)}]] - [[${shotReviewCanvasPath(shotId)}|审阅画布]]`).join("\n")
    : "- 尚未发现镜头文件。";
  const shotGroupLinks = shotGroupIds.length > 0
    ? shotGroupIds.map((groupId) => `- [[${shotGroupPagePath(groupId)}|${shotGroupDisplayName(groupId, sourceFiles)}]]`).join("\n")
    : "- 尚未发现镜头组。";
  const availableSteps = [...new Set(sourceFiles.map((file) => file.step))].sort((left, right) => left - right);
  const stageReviewHubs = availableSteps.map((step) => renderStageReviewHub(step, sourceFiles, availableSteps));
  const stageReviewLinks = availableSteps.map((step) => `- [[${stageReviewHubPath(step)}|${stageReviewPath(step).split("/").at(-1)}]]`).join("\n") || "- 尚未发现阶段文件。";
  const stageReviewOverview: ObsidianGeneratedFile = {
    vaultPath: stageReviewOverviewPath,
    content: `# 阶段审核总览

按工作流阶段顺序审核；进入阶段后，再按镜头组和镜头顺序从头到尾检查。

${stageReviewLinks}

发现跨阶段不一致时，再进入 [[${shotLookupIndexPath}|按镜头联查]]。
`
  };
  // 素材审阅（B3）：仅当本次导出确实生成了素材总览页时，首页才给出入口。
  const mediaReviewEntry = hasMediaReviewIndex
    ? "\n- [[" + mediaReviewIndexPath + "|素材审阅]]"
    : "";
  // 内容树入口：只有项目里真的有「内容/」文件时才出现，旧格式项目的首页一字不变。
  const contentTreeEntry = contentTreeEntries(sourceFiles).length > 0
    ? `\n- [[${contentTreeIndexPath}|内容树]]`
    : "";
  const deviationsMarkdown = renderDeviationsMarkdown(deviationsContext);
  const files: ObsidianGeneratedFile[] = [
    {
      vaultPath: projectionInfoPath,
      content: `# ${projectName} Obsidian 观看层

打开 vault 后，从 [[${projectHomePath}|项目首页]] 开始。主审阅路线是 [[${stageReviewOverviewPath}|阶段审核]]；发现跨阶段不一致时，再用 [[${shotLookupIndexPath}|按镜头联查]]。执行准备看 [[${productionBoardPath}|制作看板]]，长期记录写到 [[${notesIndexLink}]]。
`
    },
    {
      vaultPath: projectHomePath,
      content: `# 项目首页

## 1. 打开路线

1. 打开 [[${stageReviewOverviewPath}|阶段审核]]，按阶段顺序完成一批产物审核。
2. 在每个阶段中按镜头组和镜头顺序从头到尾审核。
3. 只有发现跨阶段不一致时，打开 [[${shotLookupIndexPath}|按镜头联查]]。
4. 审阅意见写到 [[${notesIndexLink}|笔记]]；需要智能体修改时再打开 [[${agentHandoffPath}|智能体交接]]。

## 2. 审阅入口

- [[${stageReviewOverviewPath}|阶段审核]]
- [[${reviewOverviewPath}|审阅总览]]
- [[${shotLookupIndexPath}|按镜头联查]]
- [[${productionBoardPath}|制作看板]]
- [[${agentHandoffPath}|智能体交接]]
- [[${notesIndexLink}|用户笔记]]${mediaReviewEntry}${contentTreeEntry}

## 3. 镜头审阅

- [[${shotLookupIndexPath}|按镜头联查]]
${shotGroupLinks}

## 4. 项目状态

### 4.1 审阅队列

![[${workflowBasePath}#审阅队列]]

### 4.2 镜头进度

![[${shotBasePath}#镜头进度]]

### 4.3 执行就绪

![[${productionStatusBasePath}#执行就绪]]

## 5. 工具入口

- [[${productionBoardPath}|制作看板]]
- [[${agentHandoffPath}|智能体交接]]
- [[${reviewMapCanvasPath}|审阅地图]]
- [[${workflowCanvasPath}|流程图]]
- [[${shotPipelineCanvasPath}|镜头流水线]]
- [[${workflowBasePath}|流程文件表]]
- [[${shotBasePath}|镜头表]]
- [[${productionStatusBasePath}|制作状态表]]

${deviationsMarkdown}
`
    },
    {
      vaultPath: reviewOverviewPath,
      content: `# 审阅总览

## 1. 需要关注

![[${workflowBasePath}#审阅队列]]

## 2. 异常镜头

- 暂无异常镜头；如有需要，进入 [[${shotLookupIndexPath}|按镜头联查]] 逐镜头检查。

`
    },
    {
      vaultPath: shotLookupIndexPath,
      content: `# 镜头索引

## 1. 镜头组入口

${shotGroupLinks}

## 2. 镜头入口

${shotLinks}

## 3. 镜头表

![[${shotBasePath}#镜头表]]

## 4. 镜头进度

![[${shotBasePath}#镜头进度]]

## 5. 沉浸式审阅表

![[${shotBasePath}#沉浸式审阅]]
`
    },
    {
      vaultPath: productionBoardPath,
      content: `# 制作看板

## 1. 执行就绪

![[${productionStatusBasePath}#执行就绪]]

## 2. 制作状态

![[${productionStatusBasePath}#制作状态]]

## 3. 镜头进度

![[${shotBasePath}#镜头进度]]

## 4. 导航

- 审阅队列：[[${reviewOverviewPath}|审阅总览]]
- 按镜头联查：[[${shotLookupIndexPath}|按镜头联查]]
- 阶段审核：[[${stageReviewOverviewPath}|阶段审核]]
`
    },
    {
      vaultPath: `${collaborationTemplatesDirectory}/审阅笔记模板.md`,
      content: `---
tags:
  - ai-video/review
---

# 审阅笔记

## 1. 发现

## 2. 源文件链接

## 3. 后续动作
`
    },
    {
      vaultPath: `${collaborationTemplatesDirectory}/镜头跟进模板.md`,
      content: `---
tags:
  - ai-video/shot
---

# 镜头跟进

## 1. 镜头

## 2. 问题

## 3. 下一步
`
    },
    {
      vaultPath: notesIndexPath,
      content: `# 笔记说明

这个文件夹用于存放审阅意见、会议记录和研究材料。你在这里写的内容会保留在 Obsidian vault 中。
`
    },
    stageReviewOverview,
    ...stageReviewHubs,
    renderAgentHandoffPage(shotIds, sourceFiles),
    ...shotGroupIds.map((groupId) => renderShotGroupHub(groupId, sourceFiles)),
    ...shotIds.map((shotId) => renderShotHub(shotId, sourceFiles.filter((file) => file.shotId === shotId), sourceFiles, shotIds, deviationsContext, libtvState, mediaDisplay)),
    ...contentTreeFiles(sourceFiles, mediaDisplay)
  ];
  if (includePluginRecipes) {
    files.push(renderCommunityPluginRecipes());
  }
  return files;
}