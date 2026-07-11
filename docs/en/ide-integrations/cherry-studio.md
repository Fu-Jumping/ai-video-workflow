# Cherry Studio

Cherry Studio is treated as a working-directory agent adapter in v0.6. It is not a `sync --ide` target.

## Recommended Setup

Point the Cherry Studio Agent working directory at the project root. In the agent prompt, tell it to read:

1. `AGENTS.md`
2. `docs/ai-workspace/README.md`
3. `docs/ai-workspace/BOUNDARIES.md`
4. Source Step files

The agent should edit Step files only when changing project truth.

Cherry Studio may automatically create root `SOUL.md`, `USER.md`, and `memory/` files in the working directory. These files are allowed to exist, but they do not change the default ai-video-workflow source model: `AGENTS.md` and `docs/ai-workspace/` remain the cross-agent entry, and Step files remain the creative source of truth.

## Initialization Order

When Cherry Studio is first, let `sync` add the shared ai-video-workflow layer without replacing Cherry host files.

When Cherry Studio is added later, keep the existing `AGENTS.md` and Step files as project coordination truth.

When `AGENTS.md` already exists and does not contain the ai-video-workflow marker, run `verify` or `doctor` and merge the suggested block by hand. Do not copy Cherry Studio private memory, tokens, local paths, or platform caches into project truth.

## Boundaries

Do not make Cherry Studio memory or persona files project truth.

`ai-video-workflow` does not generate or overwrite:

- `soul.md`
- `user.md`
- `USER.md`
- `SOUL.md`
- `memory/`
- `MEMORY_FILE_PATH`
- Cherry Studio global memory
- `@cherry/memory`

Cherry Studio can coexist with the project, but host-level memory remains outside the workflow source model.

Other agents should treat these files as Cherry Studio host/user context, not as generated project outputs to sync, clean up, or overwrite. Whether they are versioned is a project policy decision; the CLI only guarantees coexistence by default.

`verify` skips root `SOUL.md`, `USER.md`, case variants, and `memory/`, so local host paths or platform memory inside those files do not trigger project Markdown link errors.

## Adapter Contract

- Read: `AGENTS.md`, `docs/ai-workspace/`, project Step files.
- Write: no generated Cherry Studio runtime files in v0.6.
- Sync direction: `read-only-context`.
- Source of truth: `project-step-files`.
- Verify with an existing IDE target, for example `ai-video-workflow verify --project <path> --ide codex`.
