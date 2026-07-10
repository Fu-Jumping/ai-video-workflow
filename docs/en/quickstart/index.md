# Quickstart

1. Run `pnpm install`.
2. Run `pnpm build`.
3. Choose either interactive or scripted initialization.
4. Run `node apps/cli/dist/index.js verify --project <project-path> --ide <ide>`.
5. If verification fails, run `node apps/cli/dist/index.js doctor --project <project-path> --ide <ide>`.
6. If IDE runtime files are missing, run `node apps/cli/dist/index.js sync --project <project-path> --ide <ide>`.
7. Start working from `01_concept/`.

Interactive initialization:

```powershell
node apps/cli/dist/index.js init
```

Scripted initialization:

```powershell
node apps/cli/dist/index.js init --name my-ai-video-project --ide codex --image openai --video runway
```

The default pack is `official-ai-video`, and enhanced flow is enabled unless the project explicitly disables it.

## Export an Obsidian Vault Projection

After building, export the official example into an Obsidian-readable vault projection:

```powershell
pnpm build
pnpm example:obsidian
```

You can also specify the project and output directory directly:

```powershell
node apps/cli/dist/index.js export-obsidian --project examples/official-mini-film --out .tmp/official-mini-film-obsidian
node apps/cli/dist/index.js verify-obsidian --project examples/official-mini-film --vault .tmp/official-mini-film-obsidian
```

Default export is safe and incremental. When exporting to the same vault again, the CLI reads `Projection Manifest.json`, updates generated files that have not been user-edited, and preserves user notes created under `Notes/`.

The generated vault includes a Project Home, Review Dashboard, Shot Index, Production Board, Agent Handoff page, Review Queue, Shot Progress, Execution Readiness, Workflow Map, Shot Pipeline, Review Map, immersive `Shots/<shotId>.md` review pages, and per-shot `Canvas/Shot Reviews/<shotId>.canvas` canvases. Open `00_Project_Home.md`, follow `Open Vault Workflow`, inspect a shot, use `04_Agent_Handoff.md` to copy source-file context into an agent conversation, then rerun verification after source Step edits. These are generated views over the Step files, not a second source of truth.

Common options:

```powershell
node apps/cli/dist/index.js export-obsidian --project examples/official-mini-film --out .tmp/official-mini-film-obsidian --dry-run
node apps/cli/dist/index.js export-obsidian --project examples/official-mini-film --out .tmp/official-mini-film-obsidian --force
node apps/cli/dist/index.js export-obsidian --project examples/official-mini-film --out .tmp/official-mini-film-obsidian --include-obsidian-ui
```

`--dry-run` prints planned operations without writing files. `--force` clears and rebuilds the output directory. By default, export does not write `.obsidian/`; `--include-obsidian-ui` adds optional suggested Bookmarks and Workspace for Project Home, Agent Handoff, Shot Index, Review Map, and Shot Pipeline without overwriting existing user config. The projection is a one-way reading and review view. Do not treat projected files as source Step files. See [Obsidian vault projection](../contributors/obsidian-vault-projection.md) for the boundary.
