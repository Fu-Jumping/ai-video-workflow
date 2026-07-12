export const sharedAgentEntryPath = "AGENTS.md";

export const sharedAgentEntryMarkers = [
  "ai-video-workflow shared agent entry",
  "docs/ai-workspace",
  "project-step-files"
] as const;

export const sharedAgentDocMarkers = [
  "ai-video-workflow shared agent workspace",
  "project-step-files",
  "Platform memory is not project truth"
] as const;

export const sharedAgentDocPaths = [
  "docs/ai-workspace/README.md",
  "docs/ai-workspace/BOUNDARIES.md",
  "docs/ai-workspace/HANDOFFS.md",
  "docs/ai-workspace/SECURITY.md",
  "docs/ai-workspace/PLATFORM_MATRIX.md",
  "docs/ai-workspace/ENTRYPOINT_RECONCILIATION.md"
] as const;

export const cherryHostSurfaceFiles = ["SOUL.md", "USER.md", "soul.md", "user.md"] as const;
export const cherryHostSurfaceDirs = ["memory"] as const;

export const generatedLocalSurfaceIgnoreBlock = [
  "# ai-video-workflow generated and local surfaces",
  "_views/",
  ".obsidian/",
  ".codex/",
  ".cursor/",
  ".claude/",
  ".trae/",
  "SOUL.md",
  "USER.md",
  "soul.md",
  "user.md",
  "memory/"
].join("\n");

export type SharedAgentEntryClassification =
  | "missing"
  | "valid-ai-video-entry"
  | "custom-entry-needs-merge";

export function sharedAgentEntryMergeBlock(): string {
  return [
    "## ai-video-workflow",
    "",
    "Marker: ai-video-workflow shared agent entry.",
    "",
    "- Read `docs/ai-workspace/README.md` and `docs/ai-workspace/BOUNDARIES.md` before changing workflow files.",
    "- Treat `project-step-files` as the source of truth for Step 1 to Step 6.",
    "- Keep `.codex/`, `.cursor/`, `.claude/`, `.trae/`, `_views/obsidian/`, MCP resources, and platform memory outside project truth.",
    "- Keep Cherry Studio `SOUL.md`, `USER.md`, and `memory/` compatible, but do not treat them as project truth unless this project explicitly says so.",
    "- Use relative links only."
  ].join("\n");
}

export const sharedAiWorkspaceDocs: Record<string, string> = {
  "README.md": [
    "# AI Workspace",
    "",
    "Marker: ai-video-workflow shared agent workspace.",
    "",
    "`docs/ai-workspace/` is the shared AI documentation layer for this project. It gives Codex, Cursor, Claude Code, Trae, Cherry Studio, Obsidian projections, and MCP contexts the same starting point.",
    "",
    "Read order:",
    "",
    "1. `AGENTS.md`",
    "2. `docs/ai-workspace/BOUNDARIES.md`",
    "3. `docs/ai-workspace/HANDOFFS.md`",
    "4. `docs/ai-workspace/PLATFORM_MATRIX.md`",
    "5. Source Step files in `01_concept/` through `06_execution_plan/`",
    "6. `_views/obsidian/` only as a generated viewing layer, not a source layer",
    "",
    "Source of truth:",
    "",
    "- `project-step-files` means the project Step 1 to Step 6 Markdown files are the creative source of truth.",
    "- Runtime mirror files are adapter surfaces, not project truth.",
    "- `_views/obsidian/` is a generated Obsidian vault view layer, not project truth.",
    "- Obsidian projections, MCP resources, and platform memory are not project truth.",
    "- Platform memory is not project truth.",
    "",
    "Cherry Studio compatibility:",
    "",
    "- Cherry Studio may create `SOUL.md`, `USER.md`, and `memory/` in the project root.",
    "- Treat those files as host/user memory and persona surfaces unless the project explicitly adopts them as a versioned collaboration protocol.",
    "- Do not overwrite or delete them during cross-agent sync."
  ].join("\n"),
  "BOUNDARIES.md": [
    "# Boundaries",
    "",
    "Marker: ai-video-workflow shared agent workspace.",
    "",
    "The project uses `project-step-files` as its only creative source of truth.",
    "",
    "Editable source areas:",
    "",
    "- `01_concept/`",
    "- `02_setting/`",
    "- `03_storyboard/`",
    "- `04_image_prompts/`",
    "- `05_video_prompts/`",
    "- `06_execution_plan/`",
    "",
    "Generated or adapter-only areas:",
    "",
    "- `.codex/` runtime mirror",
    "- `.cursor/` runtime mirror",
    "- `.claude/` runtime mirror",
    "- `.trae/` runtime mirror",
    "- `SOUL.md`, `USER.md`, `soul.md`, `user.md`, and root `memory/` when created by Cherry Studio",
    "- `_views/obsidian/` generated Obsidian vault view layer",
    "- `_views/obsidian/Notes/` user-authored Obsidian notes, preserved by incremental export but not project truth",
    "- `_views/obsidian/.obsidian/` local Obsidian UI state",
    "- MCP resources and prompts",
    "",
    "Do not treat runtime mirror files, Obsidian projections, MCP resources, Cherry Studio host memory/persona files, or platform memory as project truth. Platform memory is not project truth."
  ].join("\n"),
  "HANDOFFS.md": [
    "# Agent Handoffs",
    "",
    "Marker: ai-video-workflow shared agent workspace.",
    "",
    "Use this handoff boundary whenever one AI agent hands work to another.",
    "",
    "Default prompt frame:",
    "",
    "```text",
    "Read AGENTS.md first, then read docs/ai-workspace/README.md and docs/ai-workspace/BOUNDARIES.md. Treat project-step-files as the source of truth. Edit Step files only when changing project truth. Do not edit runtime mirror files, Obsidian projections, MCP resources, Cherry Studio SOUL/USER/memory files, or platform memory as source files.",
    "```",
    "",
    "Change routing:",
    "",
    "- Story and narrative frame changes go to Step 3 storyboard files.",
    "- Visual consistency and image prompt changes go to Step 4 image prompt files.",
    "- Motion and camera behavior changes go to Step 5 video prompt files.",
    "- Execution organization changes go to Step 6 execution plan files.",
    "",
    "After edits, run:",
    "",
    "```text",
    "ai-video-workflow verify --project <path> --ide <id>",
    "ai-video-workflow export-obsidian --project <path> --in-project-view",
    "ai-video-workflow verify-obsidian --project <path> --in-project-view",
    "```",
    "",
    "Platform memory is not project truth. Cherry Studio `SOUL.md`, `USER.md`, and `memory/` are host/user surfaces unless the user explicitly asks to maintain them."
  ].join("\n"),
  "SECURITY.md": [
    "# Security",
    "",
    "Marker: ai-video-workflow shared agent workspace.",
    "",
    "The shared workspace must not collect secrets, account tokens, provider keys, platform caches, or private memory exports.",
    "",
    "Rules:",
    "",
    "- Keep links relative.",
    "- Do not write drive-letter paths, `file://` links, or IDE-specific URIs.",
    "- `_views/` and `.obsidian/` must not collect secrets, provider keys, platform caches, or private memory exports.",
    "- Do not copy Cherry Studio global memory, root `SOUL.md`, root `USER.md`, root `memory/`, `@cherry/memory`, `MEMORY_FILE_PATH`, Claude auto memory, Codex local memory, or Trae local cache into project truth.",
    "- Treat `project-step-files` as the only creative source of truth.",
    "- Platform memory is not project truth."
  ].join("\n"),
  "PLATFORM_MATRIX.md": [
    "# Platform Matrix",
    "",
    "Marker: ai-video-workflow shared agent workspace.",
    "",
    "| Platform | Shared entry | Runtime surface | Boundary |",
    "| --- | --- | --- | --- |",
    "| Codex | `AGENTS.md` | `.codex/` | Runtime mirror only |",
    "| Cursor | `AGENTS.md` | `.cursor/` | Runtime mirror only |",
    "| Claude Code | `AGENTS.md`, `CLAUDE.md` | `.claude/` | `CLAUDE.md` is Claude-specific and does not replace `AGENTS.md` |",
    "| Trae | `AGENTS.md` | `.trae/` | Trae rules live under `.trae/rules/` |",
    "| Cherry Studio | `AGENTS.md` | Working directory context plus possible root `SOUL.md`, `USER.md`, `memory/` | Host/user memory and persona surfaces; sync does not generate or overwrite them |",
    "| Obsidian | Generated vault pages | `_views/obsidian/` | Projection only |",
    "| MCP | Resources and prompts | MCP server context | Read-only context |",
    "",
    "`project-step-files` are the source of truth across every platform. Runtime mirror files and platform memory are not project truth. Platform memory is not project truth."
  ].join("\n"),
  "ENTRYPOINT_RECONCILIATION.md": [
    "# Entrypoint Reconciliation",
    "",
    "Marker: ai-video-workflow shared agent workspace.",
    "",
    "This project may be opened by Cherry Studio before or after Codex, Cursor, Claude Code, or Trae.",
    "",
    "Stable source layers:",
    "",
    "- `AGENTS.md` is the cross-agent root entry.",
    "- `docs/ai-workspace/` is the shared AI documentation layer.",
    "- `project-step-files` are the Step 1 to Step 6 creative source of truth.",
    "",
    "Local and adapter surfaces:",
    "",
    "- `SOUL.md` may describe Cherry Studio persona or project-specific agent identity.",
    "- `USER.md` may describe user preferences or profile.",
    "- `memory/` may contain host or user memory.",
    "- `_views/obsidian/` is a generated Obsidian view layer.",
    "- Cherry Studio host surfaces and Obsidian view layers are both local/adapter surfaces unless a project explicitly says otherwise.",
    "",
    "If `AGENTS.md` already exists without ai-video-workflow markers, keep the user's file and merge this block into it:",
    "",
    "```md",
    sharedAgentEntryMergeBlock(),
    "```",
    "",
    "Do not copy secrets, private memory exports, provider tokens, platform caches, or absolute local paths into shared project truth.",
    "",
    "Platform memory is not project truth."
  ].join("\n")
};

export function sharedAgentEntryContent(): string {
  return [
    "# AGENTS",
    "",
    "Marker: ai-video-workflow shared agent entry.",
    "",
    "Use the `official-ai-video` pack as the default workflow pack.",
    "",
    "Read order:",
    "",
    "1. `project.config.yaml`",
    "2. `docs/ai-workspace/README.md`",
    "3. `docs/ai-workspace/BOUNDARIES.md`",
    "4. `docs/ai-workspace/HANDOFFS.md`",
    "5. Source Step files in `01_concept/` through `06_execution_plan/`",
    "",
    "Source of truth:",
    "",
    "- `project-step-files` means Step 1 to Step 6 Markdown files are the creative source of truth.",
    "- `.codex/`, `.cursor/`, `.claude/`, and `.trae/` are runtime mirror surfaces.",
    "- `_views/obsidian/` is the generated Obsidian vault view layer; Obsidian vault files, MCP resources, platform cache, and platform memory are not project truth.",
    "- Cherry Studio may create `SOUL.md`, `USER.md`, and `memory/`; keep them compatible but do not treat them as project truth by default.",
    "",
    "Global rules:",
    "",
    "- Keep Step 3 and Step 4 frame-aligned.",
    "- Keep Step 4 file contracts intact.",
    "- Default to enhanced flow unless a project explicitly disables it.",
    "- Use relative links only.",
    "- Do not overwrite Cherry Studio `SOUL.md`, `USER.md`, or `memory/` host surfaces.",
    "- Platform memory is not project truth."
  ].join("\n");
}

export function classifySharedAgentEntry(content: string): SharedAgentEntryClassification {
  if (sharedAgentEntryMarkers.every((marker) => content.includes(marker))) {
    return "valid-ai-video-entry";
  }
  return "custom-entry-needs-merge";
}
