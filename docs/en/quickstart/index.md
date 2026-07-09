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
node apps/cli/dist/index.js export-obsidian --project examples/official-mini-film --out .tmp/official-mini-film-obsidian --force
node apps/cli/dist/index.js verify-obsidian --project examples/official-mini-film --vault .tmp/official-mini-film-obsidian
```

The projection is a one-way reading and review view. Do not treat projected files as source Step files. See [Obsidian vault projection](../contributors/obsidian-vault-projection.md) for the boundary.
