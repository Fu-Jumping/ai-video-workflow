# ai-video-workflow

`ai-video-workflow` is an open-source product repo for AI video creation workflows.

It combines:

- an official workflow pack
- a TypeScript CLI
- a bilingual VitePress documentation site
- IDE integrations
- checks and validation rules

## Current Status

This repository is the first-stage refactor from the former internal mother package. The current default pack is `official-ai-video`.

## v0.2 Mainline

The current recommended focus is the mainline demo loop: non-interactive init, the official example project, verification and doctor guidance, adapter boundaries, and quickstart docs.

Future Obsidian, LibTV, MCP, and agent-platform work should attach as adapters, not as second workflow sources.

## v0.2 Verification

```powershell
pnpm verify:v0.2
```

This command builds the CLI and docs site, runs tests, and verifies the official example project.

## Obsidian Vault Projection

```powershell
pnpm build
pnpm example:obsidian
```

This command exports the official example into an Obsidian vault projection and verifies dashboards, Bases, Canvas, and source paths. The generated vault includes a project home, review queue, shot progress view, execution readiness view, Agent Handoff page, Workflow Map, Shot Pipeline, Review Map, immersive `Shots/<shotId>.md` review pages, and per-shot `Canvas/Shot Reviews/<shotId>.canvas` canvases. See `docs/en/contributors/obsidian-vault-projection.md` for the adapter boundary.

`export-obsidian` uses safe incremental export by default: repeated exports to the same vault update generated projection files while preserving user-authored Obsidian notes. Use `--force` for a clean rebuild, or `--dry-run` to print create/update/skip/keep operations without writing files. The generated `Projection Manifest.json` tracks projection-owned files, `Shots/` remains projection-owned, and `Notes/` is reserved for user-authored Obsidian notes.

Use `04_Agent_Handoff.md` and the `Agent Handoff` section in each shot page to copy source-file context into an agent conversation. The agent should edit source Step files, not generated Obsidian projection files.

By default the exporter does not write `.obsidian/`. Use `--include-obsidian-ui` only when you want optional suggested Bookmarks and Workspace for the open-vault path: Project Home, Agent Handoff, Shot Index, Review Map, and Shot Pipeline. Existing user `.obsidian` files are not overwritten; suggested copies are written under `.obsidian/ai-video-workflow-suggested/`.

## Quick Start

1. Install dependencies with `pnpm install`.
2. Build the CLI and docs with `pnpm build`.
3. Run `pnpm --filter ai-video-workflow test`.
4. Use `pnpm --filter ai-video-workflow build` to build the CLI.

## Product Shape

- `apps/cli` contains the CLI implementation.
- `packs/official-ai-video` contains the flagship workflow pack.
- `docs` contains the bilingual docs site.
- `scaffolds` contains workflow pack starter structures.
- `examples` contains public, non-proprietary examples.
