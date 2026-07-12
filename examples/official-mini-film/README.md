# Official Mini Film Example

This is a compact three-shot demo project for `ai-video-workflow`.

It demonstrates:

- the six-step AI video workflow structure
- three Step 3 storyboard cards
- three Step 4 image prompt files
- three Step 5 video prompt files
- Step 6 execution mapping back to Step 3, Step 4, and Step 5 for every shot
- Obsidian vault projection coverage with multiple shot records
- Codex runtime files generated from the official pack

## How to Verify

From the repo root:

```powershell
pnpm build
pnpm example:verify
pnpm example:obsidian:in-project
```

`pnpm example:obsidian:in-project` writes the generated Obsidian view layer to `_views/obsidian/`. `_views/` is ignored and generated. Open `_views/obsidian/` in Obsidian, not this project root. Source files remain Step 1 to Step 6.

## What This Example Does Not Demonstrate Yet

- LibTV canvas execution
- MCP server runtime
- direct image or video generation
