import type { ObsidianGeneratedFile } from "./types.js";

export function renderBaseFiles(): ObsidianGeneratedFile[] {
  return [
    {
      vaultPath: "数据表/流程文件.base",
      content: `filters:
  and:
    - file.hasTag("ai-video/project")
properties:
  stage_group:
    displayName: 阶段
  review_status:
    displayName: 审阅
  execution_status:
    displayName: 执行
  needs_attention:
    displayName: 关注
  projection_generated:
    displayName: 生成文件
  step:
    displayName: 步骤
  source_kind:
    displayName: 类型
  status:
    displayName: 状态
  source_path:
    displayName: 源路径
views:
  - type: table
    name: 流程文件
    order:
      - file.name
      - step
      - source_kind
      - stage_group
      - review_status
      - execution_status
      - status
      - source_path
  - type: list
    name: 审阅列表
    order:
      - file.name
      - status
  - type: table
    name: 审阅队列
    groupBy:
      property: review_status
      direction: ASC
    order:
      - file.name
      - needs_attention
      - review_status
      - stage_group
      - source_kind
      - source_path
  - type: table
    name: 已改动生成文件
    filters:
      and:
        - 'projection_generated == true'
    order:
      - file.name
      - file.mtime
      - source_path
      - status
`
    },
    {
      vaultPath: "数据表/镜头.base",
      content: `filters:
  and:
    - file.hasTag("ai-video/shot")
properties:
  shot_id:
    displayName: 镜头
  shot_order:
    displayName: 顺序
  review_mode:
    displayName: 审阅模式
  review_canvas:
    displayName: 审阅画布
  review_note:
    displayName: 审阅笔记
  agent_handoff:
    displayName: 智能体交接
  has_storyboard:
    displayName: 分镜脚本
  has_image_prompt:
    displayName: 图片提示词
  has_video_prompt:
    displayName: 视频提示词
  review_status:
    displayName: 审阅
  execution_status:
    displayName: 执行
  needs_attention:
    displayName: 关注
  status:
    displayName: 状态
  source_path:
    displayName: 源路径
views:
  - type: table
    name: 镜头表
    order:
      - file.name
      - shot_order
      - shot_id
      - review_status
      - execution_status
      - status
      - source_path
  - type: cards
    name: 镜头卡片
    order:
      - file.name
      - status
  - type: table
    name: 镜头进度
    groupBy:
      property: shot_id
      direction: ASC
    order:
      - shot_order
      - file.name
      - review_status
      - execution_status
      - needs_attention
      - source_path
  - type: table
    name: 沉浸式审阅
    order:
      - shot_order
      - file.name
      - review_mode
      - review_canvas
      - review_note
      - has_storyboard
      - has_image_prompt
      - has_video_prompt
      - execution_status
  - type: table
    name: 智能体交接
    order:
      - shot_order
      - file.name
      - agent_handoff
      - review_canvas
      - source_path
      - execution_status
`
    },
    {
      vaultPath: "数据表/制作状态.base",
      content: `filters:
  and:
    - file.hasTag("ai-video/status")
properties:
  status:
    displayName: 状态
  step:
    displayName: 步骤
  stage_group:
    displayName: 阶段
  review_status:
    displayName: 审阅
  execution_status:
    displayName: 执行
  shot_id:
    displayName: 镜头
  source_path:
    displayName: 源路径
views:
  - type: table
    name: 制作状态
    groupBy:
      property: status
      direction: ASC
    order:
      - file.name
      - status
      - step
      - shot_id
      - source_path
  - type: table
    name: 执行就绪
    groupBy:
      property: execution_status
      direction: ASC
    order:
      - file.name
      - execution_status
      - review_status
      - stage_group
      - shot_id
      - source_path
`
    }
  ];
}
