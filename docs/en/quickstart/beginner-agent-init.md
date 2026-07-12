# Beginner Start With An Agent

If you are starting your first AI video project, do not write scripts inside the `ai-video-workflow` tool repository. Use this repository to create a separate creative project directory, then open that creative project in your agent.

Copy this prompt to Codex, Cursor, Claude Code, Trae, or another agent that can run local commands:

```text
I want to create a new AI video creative project with the current ai-video-workflow tool.
Please first check whether this tool repository has dependencies installed and the CLI built. If not, help me run the required setup.
Then ask me for the project name, parent folder, AI IDE target, default image platform, and default video platform.
Use my answers to run the initialization command. After the project is created, tell me which directory to open and guide me from Step 1 planning.
I do not have programming experience. Do not ask me to assemble complex commands myself; ask me only for the choices you need.
```

The agent should run the CLI for you. The CLI remains the authoritative initializer because it creates `AGENTS.md`, `docs/ai-workspace/`, Step folders, templates, config, and IDE runtime files consistently.

After initialization, open the generated creative project directory, not this tool repository. Start from `01_concept/story-kernel.md`.

For Obsidian, open only `_views/obsidian/` as the vault. Do not open the project root itself as an Obsidian vault. External vault mode is still available for advanced use with `--out <path>`.

Manual CLI remains available for advanced or scripted use:

```powershell
node apps/cli/dist/index.js init --name my-ai-video-project --ide codex --image openai --video runway
```

Then verify:

```powershell
ai-video-workflow verify --project <project-path> --ide <ide>
```
