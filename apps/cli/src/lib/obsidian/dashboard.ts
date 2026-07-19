import type { ObsidianGeneratedFile, ObsidianSourceFile } from "./types.js";
import { workflowVaultPath } from "./markdown.js";
import { shotReviewCanvasPath } from "./canvas.js";
import { notesIndexLink, notesIndexPath } from "./routes.js";
import { obsidianProperties, obsidianPropertyValues } from "./properties.js";

function uniqueShotIds(sourceFiles: ObsidianSourceFile[]): string[] {
  return [...new Set(sourceFiles.map((file) => file.shotId).filter((shotId): shotId is string => Boolean(shotId)))].sort();
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

function linkForKind(sourceFiles: ObsidianSourceFile[], kind: ObsidianSourceFile["sourceKind"], label: string): string {
  const file = sourceFiles.find((sourceFile) => sourceFile.sourceKind === kind);
  return file ? `[[${workflowVaultPath(file)}|${label}]]` : `${label}: 缺失`;
}

function fileForKind(sourceFiles: ObsidianSourceFile[], kind: ObsidianSourceFile["sourceKind"]): ObsidianSourceFile | undefined {
  return sourceFiles.find((sourceFile) => sourceFile.sourceKind === kind);
}

function embeddedFileForKind(sourceFiles: ObsidianSourceFile[], kind: ObsidianSourceFile["sourceKind"], missingLabel: string): string {
  const file = fileForKind(sourceFiles, kind);
  return file ? `![[${workflowVaultPath(file)}]]` : `> ${missingLabel}: 缺失`;
}

function sourcePathForKind(sourceFiles: ObsidianSourceFile[], kind: ObsidianSourceFile["sourceKind"]): string {
  return fileForKind(sourceFiles, kind)?.sourcePath ?? "missing";
}

function shotNavigation(shotId: string, shotIds: string[], sourceFiles: ObsidianSourceFile[]): string {
  const index = shotIds.indexOf(shotId);
  const previousShotId = index > 0 ? shotIds[index - 1] : undefined;
  const nextShotId = index >= 0 && index < shotIds.length - 1 ? shotIds[index + 1] : undefined;
  return [
    previousShotId ? `- 上一镜头：[[镜头/${previousShotId}|${shotDisplayName(previousShotId, sourceFiles)}]]` : "- 上一镜头：无",
    nextShotId ? `- 下一镜头：[[镜头/${nextShotId}|${shotDisplayName(nextShotId, sourceFiles)}]]` : "- 下一镜头：无"
  ].join("\n");
}

function yesNoProperty(value: boolean): string {
  return value ? obsidianPropertyValues.yes : obsidianPropertyValues.no;
}

function renderShotAgentHandoff(shotId: string, shotFiles: ObsidianSourceFile[], allSourceFiles: ObsidianSourceFile[]): string {
  const storyboardSourcePath = sourcePathForKind(shotFiles, "storyboard");
  const imagePromptSourcePath = sourcePathForKind(shotFiles, "image-prompt");
  const videoPromptSourcePath = sourcePathForKind(shotFiles, "video-prompt");
  const executionPlanSourcePath = sourcePathForKind(allSourceFiles, "execution-plan");
  const displayName = shotDisplayName(shotId, allSourceFiles);
  return `## 智能体交接

这一段用于把当前镜头上下文复制到智能体对话里。反馈写在智能体聊天中，不要编辑生成的 Obsidian 观看层文件。

### 给智能体的源文件

- 分镜脚本源文件：\`${storyboardSourcePath}\`
- 步骤四图片提示词源文件：\`${imagePromptSourcePath}\`
- 步骤五视频提示词源文件：\`${videoPromptSourcePath}\`
- 执行计划源文件：\`${executionPlanSourcePath}\`
- 项目交接入口：[[04_智能体交接|智能体交接]]

### 源文件编辑边界

- 叙事画面或镜头意图修改写入步骤三：\`${storyboardSourcePath}\`
- 图片与画面一致性修改写入步骤四：\`${imagePromptSourcePath}\`
- 运动、时长和镜头行为修改写入步骤五：\`${videoPromptSourcePath}\`
- \`镜头/\`、\`流程/\`、\`数据表/\` 和 \`画布/\` 下的生成文件只是观看层输出。

### 可复制提示词

\`\`\`text
请检查 ${displayName}（${shotId}）的步骤三分镜脚本、步骤四图片提示词和步骤五视频提示词。

源文件：
- 分镜脚本：${storyboardSourcePath}
- 步骤四图片提示词：${imagePromptSourcePath}
- 步骤五视频提示词：${videoPromptSourcePath}
- 执行计划：${executionPlanSourcePath}

保持步骤三和步骤四逐镜头对齐。如果需要修改，只编辑步骤源文件，不要编辑生成的 Obsidian 观看层文件。
\`\`\`

### 验证命令

\`\`\`powershell
node apps/cli/dist/index.js verify --project <project-path> --ide codex
node apps/cli/dist/index.js export-obsidian --project <project-path> --in-project-view
node apps/cli/dist/index.js verify-obsidian --project <project-path> --in-project-view
\`\`\`
`;
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
  const reviewCanvasPath = shotReviewCanvasPath(shotId);
  return {
    vaultPath: `镜头/${shotId}.md`,
    content: `---
${obsidianProperties.projectionGenerated}: ${obsidianPropertyValues.yes}
${obsidianProperties.sourceKind}: ${obsidianPropertyValues.sourceKind.index}
${sourcePathLine}${obsidianProperties.shotId}: ${shotId}
${shotOrderLine}${obsidianProperties.stageGroup}: ${obsidianPropertyValues.stageGroup["shot-review"]}
${obsidianProperties.reviewStatus}: ${obsidianPropertyValues.reviewStatus["shot-review"]}
${obsidianProperties.executionStatus}: ${obsidianPropertyValues.executionStatus["prompt-ready"]}
${obsidianProperties.needsAttention}: ${obsidianPropertyValues.no}
${obsidianProperties.reviewMode}: ${obsidianPropertyValues.reviewMode.immersive}
${obsidianProperties.reviewCanvas}: "[[${reviewCanvasPath}]]"
${obsidianProperties.reviewNote}: "[[笔记/镜头审阅/${shotId}]]"
${obsidianProperties.agentHandoff}: "[[04_智能体交接#单镜头交接|智能体交接]]"
${obsidianProperties.hasStoryboard}: ${yesNoProperty(Boolean(storyboard))}
${obsidianProperties.hasImagePrompt}: ${yesNoProperty(Boolean(imagePrompt))}
${obsidianProperties.hasVideoPrompt}: ${yesNoProperty(Boolean(videoPrompt))}
${obsidianProperties.status}: ${obsidianPropertyValues.ready}
tags:
  - ai-video/project
  - ai-video/shot/${shotId}
  - ai-video/type/index
  - ai-video/status/ready
---

# ${displayName}

## 沉浸式审阅

- 分镜脚本：${linkForKind(shotFiles, "storyboard", "分镜脚本")}
- 图片提示词：${linkForKind(shotFiles, "image-prompt", "图片提示词")}
- 视频提示词：${linkForKind(shotFiles, "video-prompt", "视频提示词")}
- 执行计划：${linkForKind(allSourceFiles, "execution-plan", "执行计划")}
- 审阅画布：[[${reviewCanvasPath}|镜头审阅画布]]
- 用户审阅笔记：[[笔记/镜头审阅/${shotId}|${displayName} 审阅笔记]]

## 审阅路径

- 审阅总览：[[01_审阅总览]]
- 制作看板：[[03_制作看板]]
- 审阅地图：[[画布/审阅地图.canvas]]
${shotNavigation(shotId, shotIds, allSourceFiles)}

## 源文件序列

${embeddedFileForKind(shotFiles, "storyboard", "分镜脚本")}

## 画面连续性

审阅步骤四图片提示词连续性时，以步骤三分镜画面为参照。

${embeddedFileForKind(shotFiles, "image-prompt", "图片提示词")}

## 提示词交接

检查步骤五视频提示词是否保留步骤四视觉画面，并且只增加运动、时长和镜头行为。

${embeddedFileForKind(shotFiles, "video-prompt", "视频提示词")}

## 执行就绪

- 步骤源文件仍是事实源。
- 执行前确认分镜脚本、图片提示词和视频提示词对齐。
- 项目级执行检查使用 [[03_制作看板]]。

${renderShotAgentHandoff(shotId, shotFiles, allSourceFiles)}

## 镜头记录

![[数据表/镜头.base#镜头表]]

## 进度视图

![[数据表/镜头.base#镜头进度]]

## 用户笔记

持久审阅意见写到 [[笔记/镜头审阅/${shotId}|${displayName} 审阅笔记]]，这样增量导出可以持续替换生成文件。

## 审阅画布

![[${reviewCanvasPath}]]
`
  };
}

function renderAgentHandoffPage(shotIds: string[], sourceFiles: ObsidianSourceFile[]): ObsidianGeneratedFile {
  const shotLinks = shotIds.length > 0
    ? shotIds.map((shotId) => `- [[镜头/${shotId}|${shotDisplayName(shotId, sourceFiles)}]] - [[画布/镜头审阅/${shotId}.canvas|审阅画布]]`).join("\n")
    : "- 尚未发现镜头文件。";
  return {
    vaultPath: "04_智能体交接.md",
    content: `# 智能体交接

当你已经在 Obsidian 中检查项目，并希望让智能体修改步骤源文件时，使用这个页面。Obsidian 是观看和定位层，项目步骤文件才是事实源。

## 导航

- 项目首页：[[00_项目首页]]
- 审阅总览：[[01_审阅总览]]
- 镜头索引：[[02_镜头索引]]
- 制作看板：[[03_制作看板]]
- 流程文件表：[[数据表/流程文件.base]]
- 镜头表：[[数据表/镜头.base]]
- 制作状态表：[[数据表/制作状态.base]]

## 单镜头交接

${shotLinks}

## 源文件编辑边界

- 故事意图或镜头构图修改写入步骤三分镜脚本文件。
- 图片构图、主体描述和画面连续性修改写入步骤四图片提示词文件。
- 运动、时长、镜头移动和视频行为修改写入步骤五视频提示词文件。
- 不要把生成的 Obsidian 观看层文件当作工作流源文件编辑。

## 可复制提示词

### 单镜头检查

\`\`\`text
请检查选中镜头的步骤三分镜脚本、步骤四图片提示词和步骤五视频提示词。
保持步骤三和步骤四逐镜头对齐。
如果需要修改，只编辑步骤源文件，不要编辑生成的 Obsidian 观看层文件。
\`\`\`

### 步骤四图片提示词修改

\`\`\`text
请更新选中镜头的步骤四图片提示词，使它和步骤三分镜脚本保持逐镜头对齐。
保持步骤四文件合同完整，避免依赖上下文的模糊写法。
不要编辑生成的 Obsidian 观看层文件。
\`\`\`

### 步骤五视频提示词修改

\`\`\`text
请更新选中镜头的步骤五视频提示词。
保留步骤四视觉画面，只修改运动、时长、镜头行为或视频专属细节。
不要编辑生成的 Obsidian 观看层文件。
\`\`\`

### 全项目验证

\`\`\`text
请在步骤源文件修改后验证项目。
运行项目校验，必要时刷新 Obsidian 观看层，然后运行 verify-obsidian。
用精确源路径报告仍存在的步骤三到步骤四对齐问题或投影问题。
\`\`\`

## 验证命令

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
    vaultPath: "社区插件配方.md",
    content: `# 社区插件配方

默认 Obsidian 观看层只依赖 Obsidian 核心功能。以下配方都是可选项。

## Dataview

当项目需要比核心 Bases 更复杂的查询时，再使用 Dataview。

## Tasks

当项目希望在 vault 中做交互式任务查询时，再使用 Tasks。

## Kanban

当项目需要 Markdown 支撑的看板视图时，再使用 Kanban。

## Excalidraw

当项目需要比核心 Canvas 更强的视觉草图能力时，再使用 Excalidraw。
`
  };
}

export function renderDashboardFiles(projectName: string, sourceFiles: ObsidianSourceFile[], includePluginRecipes: boolean): ObsidianGeneratedFile[] {
  const shotIds = uniqueShotIds(sourceFiles);
  const shotLinks = shotIds.length > 0
    ? shotIds.map((shotId) => `- [[镜头/${shotId}|${shotDisplayName(shotId, sourceFiles)}]] - [[${shotReviewCanvasPath(shotId)}|审阅画布]]`).join("\n")
    : "- 尚未发现镜头文件。";
  const files: ObsidianGeneratedFile[] = [
    {
      vaultPath: "说明.md",
      content: `# ${projectName} Obsidian 观看层

打开 vault 后，从 [[00_项目首页]] 开始。用 [[02_镜头索引]] 检查镜头，用 [[画布/审阅地图.canvas|审阅地图]] 做空间导航，用 [[04_智能体交接]] 把源文件上下文复制到智能体聊天中，执行前打开 [[03_制作看板]]。

不要把生成的观看层文件当作事实源。工作流修改请编辑原始步骤文件；Obsidian 专属笔记写到 [[${notesIndexLink}]]。
`
    },
    {
      vaultPath: "00_项目首页.md",
      content: `# 项目首页

## 打开观看层后的流程

1. 检查项目：使用 [[00_项目首页|项目首页]] 和 [[画布/审阅地图.canvas|审阅地图]]。
2. 检查镜头：打开 [[02_镜头索引|镜头索引]]，再选择镜头页和审阅画布。
3. 交接给智能体：打开 [[04_智能体交接|智能体交接]]，把源文件上下文复制到智能体聊天中。
4. 修改后验证：运行项目校验，刷新这个观看层，再运行 \`verify-obsidian\`。

生成的 Obsidian 文件只用于观看和交接。步骤源文件仍是工作流事实源。

## 审阅总控

- [[01_审阅总览|审阅总览]]
- [[02_镜头索引|镜头索引]]
- [[03_制作看板|制作看板]]
- [[04_智能体交接|智能体交接]]
- [[${notesIndexLink}|用户笔记]]
- [[画布/审阅地图.canvas|审阅地图]]
- [[画布/流程图.canvas|流程图]]
- [[画布/镜头流水线.canvas|镜头流水线]]

## 沉浸式镜头审阅

${shotLinks}

## 项目健康

![[数据表/流程文件.base#审阅队列]]

## 镜头进度

![[数据表/镜头.base#镜头进度]]

## 执行就绪

![[数据表/制作状态.base#执行就绪]]

## 图谱和画布导航

- 打开图谱视图检查项目首页、仪表盘、镜头页和流程文件之间的生成链接。
- 使用 [[画布/审阅地图.canvas|审阅地图]] 查看审阅路径。
- 使用 [[画布/流程图.canvas|流程图]] 查看步骤级流转。
- 使用 [[画布/镜头流水线.canvas|镜头流水线]] 查看镜头级流转。

## 数据表

- [[数据表/流程文件.base|流程文件表]]
- [[数据表/镜头.base|镜头表]]
- [[数据表/制作状态.base|制作状态表]]

## 生成文件冲突检查

- 增量导出会跳过在 Obsidian 中被修改过的生成文件，并报告 \`skipped-user-modified\`。
- 执行前运行 \`verify-obsidian\`，检查投影清单哈希是否有冲突。

## 编辑边界

- 步骤源文件仍是工作流事实源。
- 生成的观看层文件可以由 \`export-obsidian\` 刷新。
- 用户手写 Obsidian 笔记放在 [[${notesIndexLink}|笔记]]。

## 流程文件

![[数据表/流程文件.base#流程文件]]

## 镜头卡片

![[数据表/镜头.base#镜头卡片]]

## 流程图

![[画布/流程图.canvas]]

## 镜头流水线

![[画布/镜头流水线.canvas]]

## 审阅查询

\`\`\`query
tag:#ai-video/review/needs-step4-link OR tag:#ai-video/status/blocked
\`\`\`
`
    },
    {
      vaultPath: "01_审阅总览.md",
      content: `# 审阅总览

## 需要关注

![[数据表/流程文件.base#审阅队列]]

## 阻塞项

\`\`\`query
tag:#ai-video/status/blocked OR tag:#ai-video/review/needs-source-link OR tag:#ai-video/review/needs-step4-link
\`\`\`

## 执行就绪

![[数据表/制作状态.base#执行就绪]]

## 生成文件冲突

![[数据表/流程文件.base#已改动生成文件]]

当这个队列显示可能的投影冲突时，使用 \`verify-obsidian\`。持久审阅笔记请移到 [[${notesIndexLink}|笔记]]，不要直接编辑生成文件。

## 智能体交接

[[04_智能体交接|智能体交接]]

## 审阅地图

![[画布/审阅地图.canvas]]

## 镜头审阅画布

${shotLinks}

`
    },
    {
      vaultPath: "02_镜头索引.md",
      content: `# 镜头索引

${shotLinks}

## 智能体交接

[[04_智能体交接|智能体交接]]

## 镜头表

![[数据表/镜头.base#镜头表]]

## 镜头进度

![[数据表/镜头.base#镜头进度]]

## 沉浸式审阅表

![[数据表/镜头.base#沉浸式审阅]]

## 智能体交接表

![[数据表/镜头.base#智能体交接]]
`
    },
    {
      vaultPath: "03_制作看板.md",
      content: `# 制作看板

## 执行就绪

![[数据表/制作状态.base#执行就绪]]

## 制作状态

![[数据表/制作状态.base#制作状态]]

## 镜头进度

![[数据表/镜头.base#镜头进度]]

## 就绪项

\`\`\`query
tag:#ai-video/status/ready
\`\`\`

## 交接链接

- 审阅队列：[[01_审阅总览]]
- 镜头索引：[[02_镜头索引]]
- 智能体交接：[[04_智能体交接]]
- 流程图：[[画布/流程图.canvas]]
- 审阅地图：[[画布/审阅地图.canvas]]
- 镜头审阅：[[02_镜头索引]]
`
    },
    {
      vaultPath: "模板/审阅笔记模板.md",
      content: `---
tags:
  - ai-video/review
---

# 审阅笔记

## 发现

## 源文件链接

## 后续动作
`
    },
    {
      vaultPath: "模板/镜头跟进模板.md",
      content: `---
tags:
  - ai-video/shot
---

# 镜头跟进

## 镜头

## 问题

## 下一步
`
    },
    {
      vaultPath: notesIndexPath,
      content: `# 笔记说明

这个文件夹用于存放 Obsidian 专属笔记、审阅意见、会议记录和研究材料，它们可以放在生成观看层旁边。

你在这个文件夹中创建的文件不属于生成投影清单，增量运行 \`export-obsidian\` 时会保留。

如果你编辑了生成文件，下一次增量导出会跳过那个文件，并报告 \`skipped-user-modified\`。
`
    },
    renderAgentHandoffPage(shotIds, sourceFiles),
    ...shotIds.map((shotId) => renderShotHub(shotId, sourceFiles.filter((file) => file.shotId === shotId), sourceFiles, shotIds))
  ];
  if (includePluginRecipes) {
    files.push(renderCommunityPluginRecipes());
  }
  return files;
}
