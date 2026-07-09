import type { ObsidianGeneratedFile } from "./types.js";

export function renderBaseFiles(): ObsidianGeneratedFile[] {
  return [
    {
      vaultPath: "Bases/Workflow Files.base",
      content: `filters:
  and:
    - file.hasTag("ai-video/project")
properties:
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
      - status
      - source_path
  - type: list
    name: Review List
    order:
      - file.name
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
  status:
    displayName: Status
  source_path:
    displayName: Source
views:
  - type: table
    name: Shot Table
    order:
      - file.name
      - shot_id
      - status
      - source_path
  - type: cards
    name: Shot Cards
    order:
      - file.name
      - status
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
  shot_id:
    displayName: Shot
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
`
    }
  ];
}
