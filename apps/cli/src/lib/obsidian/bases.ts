import type { ObsidianGeneratedFile } from "./types.js";

export function renderBaseFiles(): ObsidianGeneratedFile[] {
  return [
    {
      vaultPath: "Bases/Workflow Files.base",
      content: `filters:
  and:
    - file.hasTag("ai-video/project")
properties:
  stage_group:
    displayName: Stage
  review_status:
    displayName: Review
  execution_status:
    displayName: Execution
  needs_attention:
    displayName: Attention
  projection_generated:
    displayName: Generated
  step:
    displayName: Step
  source_kind:
    displayName: Type
  status:
    displayName: Status
  source_path:
    displayName: Source
views:
  - type: table
    name: Workflow Files
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
    name: Review List
    order:
      - file.name
      - status
  - type: table
    name: Review Queue
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
    name: Modified Generated Files
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
      vaultPath: "Bases/Shots.base",
      content: `filters:
  and:
    - file.hasTag("ai-video/shot")
properties:
  shot_id:
    displayName: Shot
  shot_order:
    displayName: Order
  review_mode:
    displayName: Review Mode
  review_canvas:
    displayName: Review Canvas
  review_note:
    displayName: Review Note
  has_storyboard:
    displayName: Storyboard
  has_image_prompt:
    displayName: Image Prompt
  has_video_prompt:
    displayName: Video Prompt
  review_status:
    displayName: Review
  execution_status:
    displayName: Execution
  needs_attention:
    displayName: Attention
  status:
    displayName: Status
  source_path:
    displayName: Source
views:
  - type: table
    name: Shot Table
    order:
      - file.name
      - shot_order
      - shot_id
      - review_status
      - execution_status
      - status
      - source_path
  - type: cards
    name: Shot Cards
    order:
      - file.name
      - status
  - type: table
    name: Shot Progress
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
    name: Immersive Review
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
`
    },
    {
      vaultPath: "Bases/Production Status.base",
      content: `filters:
  and:
    - file.hasTag("ai-video/status")
properties:
  status:
    displayName: Status
  step:
    displayName: Step
  stage_group:
    displayName: Stage
  review_status:
    displayName: Review
  execution_status:
    displayName: Execution
  shot_id:
    displayName: Shot
  source_path:
    displayName: Source
views:
  - type: table
    name: Production Status
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
    name: Execution Readiness
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
