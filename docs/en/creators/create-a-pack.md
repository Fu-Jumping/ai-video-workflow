# Create a Pack

Use `ai-video-workflow new-pack --name my-pack` (equivalent: `node apps/cli/dist/index.js new-pack --name my-pack`) to create a workflow pack scaffold in the **current directory**, for example `my-pack/`.

## Generated structure

```
my-pack/
├── pack.yaml                      # name / version / displayName (name and displayName take the pack name)
├── checks/
│   ├── required-files.yaml        # requiredFiles: [] placeholder
│   ├── link-rules.yaml            # allowAbsolutePaths: false placeholder
│   ├── sync-rules.yaml            # syncTargets: [] placeholder
│   └── project-structure.yaml     # steps: [] placeholder
└── templates/
    └── 06_execution_plan/
        ├── 00_execution_plan.md
        ├── 01_image_execution_plan.md
        └── 02_video_execution_plan.md
```

`new-pack` validates the pack name with the same safe directory-name check as `init --name`, and refuses a non-empty existing target directory.

## Relationship to existing structures

- `scaffolds/workflow-pack/` is the in-repo pack starting structure with the same layout as the `new-pack` output (`pack.yaml`, four `checks/` files, and three `templates/06_execution_plan/` templates); `new-pack` generates the same layout under the user-provided name in the current directory.
- `packs/official-ai-video/` is the flagship pack with the same structure but complete content (workflow/, populated checks/ rules, templates/, skills/), and is the reference for filling in checks and templates.

## Making a custom pack usable

The generated `checks/` and `templates/` are placeholders. Fill in real rules and templates following the official pack format, place the pack under the repository `packs/` directory (or alongside the official pack), and point the `pack` field in `project.config.yaml` to it. The CLI `init` / `sync` / `verify` currently hardcode the default pack `official-ai-video` (`DEFAULT_PACK`); the full integration path for custom packs is described in `docs/en/creators/write-rules.md`, `write-templates.md`, and `write-skills.md`.
