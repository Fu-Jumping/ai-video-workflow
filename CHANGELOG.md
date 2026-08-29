# Changelog

## Unreleased

- Added a confirmation gate for `libtv project delete`: non-interactive runs require an explicit `--yes`, TTY runs get a confirm prompt (default false).
- Added a stderr credential-source notice (environment variable or credentials file path with a masked account identity) before any real LibTV backend call; `--mock` stays silent.
- Added a `--allow-generation` hard gate to `libtv node create --run` and `libtv group create --run`, matching the refine gate.
- Added a tool-repository guard to `new-pack` with an explicit `--allow-in-tool-repo` escape hatch for official pack development.
- Moved init static target checks (name safety, nested project, existing target, `.git`, non-empty) before any interactive prompt; closed or non-TTY prompts now exit with a single readable error instead of leaking internal warnings.
- Added the resolved absolute target directory to init success output and a doctor/deviation-add hint to non-interactive verify failures.

## 0.3.0

- Added Obsidian vault projection for the official AI video workflow.
- Added safe incremental export with `Projection Manifest.json` and generated-file hash protection.
- Added Graph-friendly internal links, Obsidian Bases, and JSON Canvas navigation.
- Added immersive single-shot review pages and per-shot review canvases.
- Added project-level and shot-level Agent Handoff pages for copy-ready source editing context.
- Added optional `--include-obsidian-ui` Bookmarks and Workspace suggestions without overwriting user `.obsidian` files.
- Added `verify-obsidian` checks for dashboards, Bases, Canvas, manifest consistency, source paths, and optional UI suggestions.
- Added `pnpm example:obsidian:ui` for real-vault QA of the optional opening experience.

## 0.1.0

- First-stage refactor from the internal mother package to `ai-video-workflow`
- Added official pack, CLI scaffold, docs site scaffold, and validation rules
