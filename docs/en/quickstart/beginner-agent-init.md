# Beginner Start With An Agent

If you are starting your first AI video project, do not write scripts inside the `ai-video-workflow` tool repository. Use this repository to create a separate creative project directory, then open that creative project in your agent. Default projects run Step 0 through Step 6; complete-script projects can skip Step 0.

Copy this prompt to Codex, Cursor, Claude Code, Trae, or another agent that can run local commands:

```text
I want to create a new AI video creative project with the current ai-video-workflow tool.
Please first check whether this tool repository has dependencies installed and the CLI built. If not, help me run the required setup.
Then ask me for the project name, parent folder, AI IDE target, default image platform, default video platform, and whether I should start from research or already have a complete script.
Use my answers to run the initialization command. After the project is created, tell me which directory to open. By default, guide me from Step 0 research; if I clearly already have a complete script, add --start-from script and guide me from Step 1 planning.
I do not have programming experience. Do not ask me to assemble complex commands myself; ask me only for the choices you need.
```

The agent should run the CLI for you. The CLI remains the authoritative initializer because it creates `AGENTS.md`, `文档/智能体工作区/`, Step folders, templates, config, and IDE runtime files consistently.

After initialization, open the generated creative project directory, not this tool repository. By default, start from `00_前期研究/00_研究总览.md`; complete-script projects start from `01_概念策划/故事内核.md`.

For Obsidian, open only `_views/obsidian/` as the vault. Do not open the project root itself as an Obsidian vault. External vault mode is still available for advanced use with `--out <path>`.

Manual CLI remains available for advanced or scripted use:

```powershell
node apps/cli/dist/index.js init --name my-ai-video-project --ide codex --image openai --video runway
```

For a project that already has a complete script:

```powershell
node apps/cli/dist/index.js init --name my-script-project --ide codex --image openai --video runway --start-from script
```

Then verify:

```powershell
ai-video-workflow verify --project <project-path> --ide <ide>
```
