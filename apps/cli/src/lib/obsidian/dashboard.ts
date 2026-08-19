import type { ObsidianGeneratedFile, ObsidianSourceFile } from "./types.js";
import { wikiLinkTargetForVaultPath, workflowVaultPath } from "./markdown.js";
import { shotReviewCanvasPath } from "./canvas.js";
import {
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
  shotReviewNotePath,
  workflowBasePath,
  workflowCanvasPath,
  shotPipelineCanvasPath,
  productionStatusBasePath
} from "./routes.js";
import { obsidianProperties, obsidianPropertyValues } from "./properties.js";
import { formatReferenceAssets } from "../reference-assets.js";
import type { ReferenceAssetToken } from "../reference-assets.js";

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

## 1. 本阶段范围

当前阶段按工作流顺序审核；先确认阶段整体成立，再按镜头组和镜头顺序从头到尾检查。

## 2. 审核顺序

${sequence}

## 3. 本阶段检查

${stageReviewCheckList(step)}

## 4. 上下游导航

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
  return `## 8. 修改入口

- 需要智能体修改源文件时：[[${agentHandoffPath}#2. 单镜头交接|智能体交接]]`;
}

function renderShotHub(shotId: string, shotFiles: ObsidianSourceFile[], allSourceFiles: ObsidianSourceFile[], shotIds: string[]): ObsidianGeneratedFile {
  const sourcePath = shotFiles.find((file) => file.sourceKind === "storyboard")?.sourcePath ?? shotFiles[0]?.sourcePath;
  const sourcePathLine = sourcePath ? `${obsidianProperties.sourcePath}: ${sourcePath}\n` : "";
  const order = shotOrder(shotId);
  const shotOrderLine = order === undefined ? "" : `${obsidianProperties.shotOrder}: ${order}\n`;
  const displayName = shotDisplayName(shotId, allSourceFiles);
  const storyboard = fileForKind(shotFiles, "storyboard");
  const imagePrompt = fileForKind(shotFiles, "image-prompt");
  const videoPrompt = fileForKind(shotFiles, "video-prompt");
  const referenceAssets = referenceAssetsText(shotFiles);
  const reviewCanvasPath = shotReviewCanvasPath(shotId);
  const shotGroupId = shotFiles[0]?.shotGroupId;
  const groupLine = shotGroupId ? `${obsidianProperties.shotGroupId}: ${shotGroupId}\n` : "";
  const groupTag = shotGroupId ? `  - ai-video/shot-group/${shotGroupId}\n` : "";
  const groupNavigation = shotGroupId ? `- 镜头组：[[${shotGroupPagePath(shotGroupId)}|${shotGroupDisplayName(shotGroupId, allSourceFiles)}]]\n` : "";
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

## 2. 审阅路径

- 审阅总览：[[${reviewOverviewPath}|审阅总览]]
- 制作看板：[[${productionBoardPath}|制作看板]]
- 审阅地图：[[${reviewMapCanvasPath}|审阅地图]]
${groupNavigation}${shotNavigation(shotId, shotIds, allSourceFiles)}

## 3. 参考资产

- 必带参考资产：${referenceAssets}
- 使用口径：图片提示词中统一写成 \`@xx三视图\` / \`@xx场景图\`。

## 4. 源文件序列

${embeddedFileForKind(shotFiles, "storyboard", "分镜脚本")}

## 5. 画面连续性

审阅步骤四图片提示词连续性时，以步骤三分镜画面为参照。

${embeddedFilesForKind(shotFiles, "image-prompt", "图片提示词")}

## 6. 视频提示词

检查步骤五视频提示词是否保留步骤四视觉画面，并且只增加运动、时长、镜头行为和平台执行设置。

${embeddedFileForKind(shotFiles, "video-prompt", "视频提示词")}

## 7. 执行检查

- 分镜脚本、图片提示词和视频提示词逐镜头对齐。
- Step 4 已携带本页列出的必带参考资产。
- Step 5 已延续同镜头 Step 4 的角色三视图和场景图。
- Step 5 已写清默认视频平台、输入方式、开场参考、时长上限、画幅和负面约束。
- 执行前打开 [[${productionBoardPath}|制作看板]]。

${renderShotEditEntry()}

## 9. 数据视图

### 9.1 镜头记录

![[${shotBasePath}#镜头表]]

### 9.2 进度视图

![[${shotBasePath}#镜头进度]]

## 10. 审阅画布

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

export function renderDashboardFiles(projectName: string, sourceFiles: ObsidianSourceFile[], includePluginRecipes: boolean): ObsidianGeneratedFile[] {
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
- [[${notesIndexLink}|用户笔记]]
- [[${reviewMapCanvasPath}|审阅地图]]
- [[${workflowCanvasPath}|流程图]]
- [[${shotPipelineCanvasPath}|镜头流水线]]

## 3. 镜头组入口

${shotGroupLinks}

## 4. 镜头入口

${shotLinks}

## 5. 项目状态

### 5.1 审阅队列

![[${workflowBasePath}#审阅队列]]

### 5.2 镜头进度

![[${shotBasePath}#镜头进度]]

### 5.3 执行就绪

![[${productionStatusBasePath}#执行就绪]]

## 6. 画布与数据

### 6.1 画布导航

- [[${reviewMapCanvasPath}|审阅地图]]
- [[${workflowCanvasPath}|流程图]]
- [[${shotPipelineCanvasPath}|镜头流水线]]

### 6.2 数据表入口

- [[${workflowBasePath}|流程文件表]]
- [[${shotBasePath}|镜头表]]
- [[${productionStatusBasePath}|制作状态表]]

### 6.3 流程文件

![[${workflowBasePath}#流程文件]]

### 6.4 镜头卡片

![[${shotBasePath}#镜头卡片]]

### 6.5 流程图

![[${workflowCanvasPath}]]

### 6.6 镜头流水线

![[${shotPipelineCanvasPath}]]
`
    },
    {
      vaultPath: reviewOverviewPath,
      content: `# 审阅总览

## 1. 需要关注

![[${workflowBasePath}#审阅队列]]

## 2. 执行就绪

![[${productionStatusBasePath}#执行就绪]]

## 3. 审阅地图

![[${reviewMapCanvasPath}]]

## 4. 镜头审阅画布

${shotLinks}

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
- 流程图：[[${workflowCanvasPath}]]
- 审阅地图：[[${reviewMapCanvasPath}]]
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
    ...shotIds.map((shotId) => renderShotHub(shotId, sourceFiles.filter((file) => file.shotId === shotId), sourceFiles, shotIds))
  ];
  if (includePluginRecipes) {
    files.push(renderCommunityPluginRecipes());
  }
  return files;
}
