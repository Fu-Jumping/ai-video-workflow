# Repo Architecture

This repo uses a workspace structure with CLI, docs, packs, scaffolds, examples, schemas, and tests.

- `packs/official-ai-video/` is the canonical workflow pack source (rules, templates, skills, quality gates, checks).
- `apps/cli/` is the TypeScript CLI (init / sync / verify / doctor / impact / deviation / research / obsidian / mcp / libtv).
- `docs/` is the bilingual VitePress docs site, including the agent-facing context-engineering directory (Chinese).

For the full agent-facing structure, task routing, and verification gates, see [../../context-engineering/00-project-context.md](../../context-engineering/00-project-context.md) (Chinese) and the human-oriented system map at [../../zh/contributors/workflow-system-map.md](../../zh/contributors/workflow-system-map.md).
