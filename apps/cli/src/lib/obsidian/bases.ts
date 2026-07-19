import type { ObsidianGeneratedFile } from "./types.js";
import { obsidianProperties, obsidianPropertyValues } from "./properties.js";

export function renderBaseFiles(): ObsidianGeneratedFile[] {
  return [
    {
      vaultPath: "数据表/流程文件.base",
      content: `filters:
  and:
    - file.hasTag("ai-video/project")
properties:
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
  ${obsidianProperties.sourceKind}:
    displayName: ${obsidianProperties.sourceKind}
  ${obsidianProperties.status}:
    displayName: ${obsidianProperties.status}
  ${obsidianProperties.sourcePath}:
    displayName: ${obsidianProperties.sourcePath}
views:
  - type: table
    name: 流程文件
    order:
      - file.name
      - ${obsidianProperties.step}
      - ${obsidianProperties.sourceKind}
      - ${obsidianProperties.stageGroup}
      - ${obsidianProperties.reviewStatus}
      - ${obsidianProperties.executionStatus}
      - ${obsidianProperties.status}
      - ${obsidianProperties.sourcePath}
  - type: list
    name: 审阅列表
    order:
      - file.name
      - ${obsidianProperties.status}
  - type: table
    name: 审阅队列
    groupBy:
      property: ${obsidianProperties.reviewStatus}
      direction: ASC
    order:
      - file.name
      - ${obsidianProperties.needsAttention}
      - ${obsidianProperties.reviewStatus}
      - ${obsidianProperties.stageGroup}
      - ${obsidianProperties.sourceKind}
      - ${obsidianProperties.sourcePath}
  - type: table
    name: 已改动生成文件
    filters:
      and:
        - '${obsidianProperties.projectionGenerated} == "${obsidianPropertyValues.yes}"'
    order:
      - file.name
      - file.mtime
      - ${obsidianProperties.sourcePath}
      - ${obsidianProperties.status}
`
    },
    {
      vaultPath: "数据表/镜头.base",
      content: `filters:
  and:
    - file.hasTag("ai-video/shot")
properties:
  ${obsidianProperties.shotId}:
    displayName: ${obsidianProperties.shotId}
  ${obsidianProperties.shotOrder}:
    displayName: ${obsidianProperties.shotOrder}
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
views:
  - type: table
    name: 镜头表
    order:
      - file.name
      - ${obsidianProperties.shotOrder}
      - ${obsidianProperties.shotId}
      - ${obsidianProperties.reviewStatus}
      - ${obsidianProperties.executionStatus}
      - ${obsidianProperties.status}
      - ${obsidianProperties.sourcePath}
  - type: cards
    name: 镜头卡片
    order:
      - file.name
      - ${obsidianProperties.status}
  - type: table
    name: 镜头进度
    groupBy:
      property: ${obsidianProperties.shotId}
      direction: ASC
    order:
      - ${obsidianProperties.shotOrder}
      - file.name
      - ${obsidianProperties.reviewStatus}
      - ${obsidianProperties.executionStatus}
      - ${obsidianProperties.needsAttention}
      - ${obsidianProperties.sourcePath}
  - type: table
    name: 沉浸式审阅
    order:
      - ${obsidianProperties.shotOrder}
      - file.name
      - ${obsidianProperties.reviewMode}
      - ${obsidianProperties.reviewCanvas}
      - ${obsidianProperties.reviewNote}
      - ${obsidianProperties.hasStoryboard}
      - ${obsidianProperties.hasImagePrompt}
      - ${obsidianProperties.hasVideoPrompt}
      - ${obsidianProperties.executionStatus}
  - type: table
    name: 智能体交接
    order:
      - ${obsidianProperties.shotOrder}
      - file.name
      - ${obsidianProperties.agentHandoff}
      - ${obsidianProperties.reviewCanvas}
      - ${obsidianProperties.sourcePath}
      - ${obsidianProperties.executionStatus}
`
    },
    {
      vaultPath: "数据表/制作状态.base",
      content: `filters:
  and:
    - file.hasTag("ai-video/status")
properties:
  ${obsidianProperties.status}:
    displayName: ${obsidianProperties.status}
  ${obsidianProperties.step}:
    displayName: ${obsidianProperties.step}
  ${obsidianProperties.stageGroup}:
    displayName: ${obsidianProperties.stageGroup}
  ${obsidianProperties.reviewStatus}:
    displayName: ${obsidianProperties.reviewStatus}
  ${obsidianProperties.executionStatus}:
    displayName: ${obsidianProperties.executionStatus}
  ${obsidianProperties.shotId}:
    displayName: ${obsidianProperties.shotId}
  ${obsidianProperties.sourcePath}:
    displayName: ${obsidianProperties.sourcePath}
views:
  - type: table
    name: 制作状态
    groupBy:
      property: ${obsidianProperties.status}
      direction: ASC
    order:
      - file.name
      - ${obsidianProperties.status}
      - ${obsidianProperties.step}
      - ${obsidianProperties.shotId}
      - ${obsidianProperties.sourcePath}
  - type: table
    name: 执行就绪
    groupBy:
      property: ${obsidianProperties.executionStatus}
      direction: ASC
    order:
      - file.name
      - ${obsidianProperties.executionStatus}
      - ${obsidianProperties.reviewStatus}
      - ${obsidianProperties.stageGroup}
      - ${obsidianProperties.shotId}
      - ${obsidianProperties.sourcePath}
`
    }
  ];
}
