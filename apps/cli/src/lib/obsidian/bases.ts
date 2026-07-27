import type { ObsidianGeneratedFile } from "./types.js";
import { obsidianProperties, obsidianPropertyValues } from "./properties.js";

const modifiedTimeColumn = "file.mtime";
const modifiedTimeDisplayName = "最近修改时间";

export function renderBaseFiles(): ObsidianGeneratedFile[] {
  return [
    {
      vaultPath: "数据表/流程文件.base",
      content: `filters:
  and:
    - file.hasTag("ai-video/project")
properties:
  ${obsidianProperties.title}:
    displayName: ${obsidianProperties.title}
  ${obsidianProperties.shotTitle}:
    displayName: ${obsidianProperties.shotTitle}
  ${obsidianProperties.nextAction}:
    displayName: ${obsidianProperties.nextAction}
  ${obsidianProperties.stageGroup}:
    displayName: ${obsidianProperties.stageGroup}
  ${obsidianProperties.reviewStatus}:
    displayName: ${obsidianProperties.reviewStatus}
  ${obsidianProperties.executionStatus}:
    displayName: ${obsidianProperties.executionStatus}
  ${obsidianProperties.needsAttention}:
    displayName: ${obsidianProperties.needsAttention}
  ${obsidianProperties.projectionGenerated}:
    displayName: ${obsidianProperties.projectionGenerated}
  ${obsidianProperties.step}:
    displayName: ${obsidianProperties.step}
  ${obsidianProperties.stepName}:
    displayName: ${obsidianProperties.stepName}
  ${obsidianProperties.sourceKind}:
    displayName: ${obsidianProperties.sourceKind}
  ${obsidianProperties.shotIndex}:
    displayName: ${obsidianProperties.shotIndex}
  ${obsidianProperties.referenceAssets}:
    displayName: ${obsidianProperties.referenceAssets}
  ${obsidianProperties.sourcePath}:
    displayName: ${obsidianProperties.sourcePath}
  ${modifiedTimeColumn}:
    displayName: ${modifiedTimeDisplayName}
views:
  - type: table
    name: 流程文件
    order:
      - ${obsidianProperties.title}
      - ${obsidianProperties.shotTitle}
      - ${obsidianProperties.sourcePath}
      - ${obsidianProperties.sourceKind}
      - ${obsidianProperties.stepName}
      - ${obsidianProperties.reviewStatus}
      - ${obsidianProperties.executionStatus}
      - ${obsidianProperties.shotIndex}
      - ${modifiedTimeColumn}
  - type: list
    name: 审阅列表
    order:
      - ${obsidianProperties.title}
      - ${obsidianProperties.reviewStatus}
      - ${obsidianProperties.executionStatus}
  - type: table
    name: 审阅队列
    groupBy:
      property: ${obsidianProperties.reviewStatus}
      direction: ASC
    order:
      - ${obsidianProperties.title}
      - ${obsidianProperties.shotTitle}
      - ${obsidianProperties.sourcePath}
      - ${obsidianProperties.sourceKind}
      - ${obsidianProperties.stepName}
      - ${obsidianProperties.reviewStatus}
      - ${obsidianProperties.executionStatus}
      - ${obsidianProperties.shotIndex}
      - ${modifiedTimeColumn}
  - type: table
    name: 已改动生成文件
    filters:
      and:
        - '${obsidianProperties.projectionGenerated} == "${obsidianPropertyValues.yes}"'
    order:
      - ${obsidianProperties.title}
      - ${obsidianProperties.shotTitle}
      - ${obsidianProperties.sourcePath}
      - ${obsidianProperties.sourceKind}
      - ${obsidianProperties.stepName}
      - ${obsidianProperties.reviewStatus}
      - ${obsidianProperties.executionStatus}
      - ${obsidianProperties.shotIndex}
      - ${modifiedTimeColumn}
`
    },
    {
      vaultPath: "数据表/镜头.base",
      content: `filters:
  and:
    - file.hasTag("ai-video/shot")
properties:
  ${obsidianProperties.title}:
    displayName: ${obsidianProperties.title}
  ${obsidianProperties.shotTitle}:
    displayName: ${obsidianProperties.shotTitle}
  ${obsidianProperties.nextAction}:
    displayName: ${obsidianProperties.nextAction}
  ${obsidianProperties.shotId}:
    displayName: ${obsidianProperties.shotId}
  ${obsidianProperties.shotOrder}:
    displayName: ${obsidianProperties.shotOrder}
  ${obsidianProperties.sourceKind}:
    displayName: ${obsidianProperties.sourceKind}
  ${obsidianProperties.stepName}:
    displayName: ${obsidianProperties.stepName}
  ${obsidianProperties.shotIndex}:
    displayName: ${obsidianProperties.shotIndex}
  ${obsidianProperties.referenceAssets}:
    displayName: ${obsidianProperties.referenceAssets}
  ${obsidianProperties.reviewMode}:
    displayName: ${obsidianProperties.reviewMode}
  ${obsidianProperties.reviewCanvas}:
    displayName: ${obsidianProperties.reviewCanvas}
  ${obsidianProperties.reviewNote}:
    displayName: ${obsidianProperties.reviewNote}
  ${obsidianProperties.agentHandoff}:
    displayName: ${obsidianProperties.agentHandoff}
  ${obsidianProperties.hasStoryboard}:
    displayName: ${obsidianProperties.hasStoryboard}
  ${obsidianProperties.hasImagePrompt}:
    displayName: ${obsidianProperties.hasImagePrompt}
  ${obsidianProperties.hasVideoPrompt}:
    displayName: ${obsidianProperties.hasVideoPrompt}
  ${obsidianProperties.reviewStatus}:
    displayName: ${obsidianProperties.reviewStatus}
  ${obsidianProperties.executionStatus}:
    displayName: ${obsidianProperties.executionStatus}
  ${obsidianProperties.needsAttention}:
    displayName: ${obsidianProperties.needsAttention}
  ${obsidianProperties.status}:
    displayName: ${obsidianProperties.status}
  ${obsidianProperties.sourcePath}:
    displayName: ${obsidianProperties.sourcePath}
  ${modifiedTimeColumn}:
    displayName: ${modifiedTimeDisplayName}
views:
  - type: table
    name: 镜头表
    order:
      - ${obsidianProperties.title}
      - ${obsidianProperties.shotTitle}
      - ${obsidianProperties.sourcePath}
      - ${obsidianProperties.sourceKind}
      - ${obsidianProperties.stepName}
      - ${obsidianProperties.reviewStatus}
      - ${obsidianProperties.executionStatus}
      - ${obsidianProperties.shotIndex}
      - ${obsidianProperties.reviewCanvas}
      - ${obsidianProperties.reviewNote}
      - ${modifiedTimeColumn}
  - type: cards
    name: 镜头卡片
    order:
      - ${obsidianProperties.shotTitle}
      - ${obsidianProperties.title}
      - ${obsidianProperties.reviewStatus}
      - ${obsidianProperties.executionStatus}
      - ${obsidianProperties.reviewCanvas}
      - ${obsidianProperties.reviewNote}
      - ${modifiedTimeColumn}
  - type: table
    name: 镜头进度
    groupBy:
      property: ${obsidianProperties.shotTitle}
      direction: ASC
    order:
      - ${obsidianProperties.title}
      - ${obsidianProperties.shotTitle}
      - ${obsidianProperties.sourcePath}
      - ${obsidianProperties.sourceKind}
      - ${obsidianProperties.stepName}
      - ${obsidianProperties.reviewStatus}
      - ${obsidianProperties.executionStatus}
      - ${obsidianProperties.shotIndex}
      - ${obsidianProperties.reviewCanvas}
      - ${obsidianProperties.reviewNote}
      - ${modifiedTimeColumn}
  - type: table
    name: 沉浸式审阅
    order:
      - ${obsidianProperties.title}
      - ${obsidianProperties.shotTitle}
      - ${obsidianProperties.sourcePath}
      - ${obsidianProperties.sourceKind}
      - ${obsidianProperties.stepName}
      - ${obsidianProperties.reviewStatus}
      - ${obsidianProperties.executionStatus}
      - ${obsidianProperties.shotIndex}
      - ${obsidianProperties.reviewCanvas}
      - ${obsidianProperties.reviewNote}
      - ${modifiedTimeColumn}
  - type: table
    name: 智能体交接
    order:
      - ${obsidianProperties.title}
      - ${obsidianProperties.shotTitle}
      - ${obsidianProperties.sourcePath}
      - ${obsidianProperties.sourceKind}
      - ${obsidianProperties.stepName}
      - ${obsidianProperties.reviewStatus}
      - ${obsidianProperties.executionStatus}
      - ${obsidianProperties.shotIndex}
      - ${obsidianProperties.reviewCanvas}
      - ${obsidianProperties.reviewNote}
      - ${modifiedTimeColumn}
`
    },
    {
      vaultPath: "数据表/制作状态.base",
      content: `filters:
  and:
    - file.hasTag("ai-video/status")
properties:
  ${obsidianProperties.title}:
    displayName: ${obsidianProperties.title}
  ${obsidianProperties.shotTitle}:
    displayName: ${obsidianProperties.shotTitle}
  ${obsidianProperties.nextAction}:
    displayName: ${obsidianProperties.nextAction}
  ${obsidianProperties.status}:
    displayName: ${obsidianProperties.status}
  ${obsidianProperties.step}:
    displayName: ${obsidianProperties.step}
  ${obsidianProperties.stepName}:
    displayName: ${obsidianProperties.stepName}
  ${obsidianProperties.stageGroup}:
    displayName: ${obsidianProperties.stageGroup}
  ${obsidianProperties.reviewStatus}:
    displayName: ${obsidianProperties.reviewStatus}
  ${obsidianProperties.executionStatus}:
    displayName: ${obsidianProperties.executionStatus}
  ${obsidianProperties.shotId}:
    displayName: ${obsidianProperties.shotId}
  ${obsidianProperties.sourceKind}:
    displayName: ${obsidianProperties.sourceKind}
  ${obsidianProperties.shotIndex}:
    displayName: ${obsidianProperties.shotIndex}
  ${obsidianProperties.referenceAssets}:
    displayName: ${obsidianProperties.referenceAssets}
  ${obsidianProperties.reviewCanvas}:
    displayName: ${obsidianProperties.reviewCanvas}
  ${obsidianProperties.reviewNote}:
    displayName: ${obsidianProperties.reviewNote}
  ${obsidianProperties.sourcePath}:
    displayName: ${obsidianProperties.sourcePath}
  ${modifiedTimeColumn}:
    displayName: ${modifiedTimeDisplayName}
views:
  - type: table
    name: 制作状态
    groupBy:
      property: ${obsidianProperties.executionStatus}
      direction: ASC
    order:
      - ${obsidianProperties.title}
      - ${obsidianProperties.shotTitle}
      - ${obsidianProperties.sourcePath}
      - ${obsidianProperties.sourceKind}
      - ${obsidianProperties.stepName}
      - ${obsidianProperties.reviewStatus}
      - ${obsidianProperties.executionStatus}
      - ${obsidianProperties.shotIndex}
      - ${obsidianProperties.reviewCanvas}
      - ${obsidianProperties.reviewNote}
      - ${modifiedTimeColumn}
  - type: table
    name: 执行就绪
    groupBy:
      property: ${obsidianProperties.executionStatus}
      direction: ASC
    order:
      - ${obsidianProperties.title}
      - ${obsidianProperties.shotTitle}
      - ${obsidianProperties.sourcePath}
      - ${obsidianProperties.sourceKind}
      - ${obsidianProperties.stepName}
      - ${obsidianProperties.executionStatus}
      - ${obsidianProperties.reviewStatus}
      - ${obsidianProperties.shotIndex}
      - ${obsidianProperties.reviewCanvas}
      - ${obsidianProperties.reviewNote}
      - ${modifiedTimeColumn}
`
    }
  ];
}
