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
