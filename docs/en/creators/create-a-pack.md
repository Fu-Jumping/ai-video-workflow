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
    └── 06_执行计划/
        ├── 00_执行计划.md
        ├── 01_图片执行计划.md
        └── 02_视频执行计划.md
```

`new-pack` validates the pack name with the same safe directory-name check as `init --name`, and refuses a non-empty existing target directory. Template directory and file names match what the workflow consumes (`06_执行计划/00_执行计划.md` etc.).

## Relationship to existing structures

- `scaffolds/workflow-pack/` is the in-repo pack starting structure with the same layout as the `new-pack` output (`pack.yaml`, four `checks/` files, and three `templates/06_执行计划/` templates); `new-pack` generates the same layout under the user-provided name in the current directory.
- `packs/official-ai-video/` is the flagship pack with the same structure but complete content (workflow/, populated checks/ rules, templates/, skills/, starters/), and is the reference for filling in checks and templates.

## Making a custom pack usable

Place the pack under the repository `packs/<name>/` directory (with `pack.yaml`), then:

- `init --pack <name>` seeds a project from that pack (default `official-ai-video`); templates the custom pack does not provide fall back to the official pack, and so does `starters/`, so a partial custom pack still produces a runnable skeleton.
- The `pack` field in `project.config.yaml` accepts any safe directory name; `verify` / `mcp-context` / `mcp-server` read it, and `sync` mirrors the IDE runtime from it (missing runtime directories also fall back to the official pack).
- If the referenced pack directory does not exist (during `init --pack` or `sync`), a clear error is reported.
- See `docs/en/creators/write-rules.md`, `write-templates.md`, and `write-skills.md` for the full rule/template/skill authoring guides.
