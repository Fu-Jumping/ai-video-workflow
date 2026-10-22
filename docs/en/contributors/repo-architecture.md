# Repo Architecture

This repo uses a workspace structure with CLI, docs, packs, scaffolds, examples, schemas, and tests.

- `packs/official-ai-video/` is the canonical workflow pack source (rules, templates, skills, quality gates, checks).
- `apps/cli/` is the TypeScript CLI (init / sync / verify / doctor / impact / deviation / research / obsidian / mcp / libtv).
- `docs/` contains the bilingual VitePress site; agent-facing context-engineering materials remain in the repository but are not published on the site.

For the full agent-facing structure, task routing, and verification gates, see `docs/context-engineering/00-project-context.md` (Chinese) in the repository; the human-oriented system map is available at [workflow-system-map.md](../../zh/contributors/workflow-system-map.md).
