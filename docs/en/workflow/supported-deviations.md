# Supported Deviations: deviations.yaml

By default, `verify` strictly enforces the current contracts. But real projects sometimes legitimately need to deviate (e.g. lightweight shots without keyframes, a scene image doubling as the character baseline, temporarily skipping a deliverable type).

To keep deviations from becoming invisible silent behavior, the CLI supports an optional project-level declaration file **`deviations.yaml`**. Only explicitly registered issues are accepted by `verify`; unregistered occurrences of the same kind still fail as usual.

## File format

`deviations.yaml` lives in the project root. The recommended object format:

```yaml
mode: hybrid
deviations:
  - rule: missing-character-triview
    scope: 02_世界设定/角色设定.md
    reason: 场景图已包含人物形象描述，本镜头走 scene-basis 轻量流程
    confirmed_by: creator
    confirmed_at: "2026-08-20T10:30:00.000Z"

  - rule: broken-step3-step4-link
    scope: 03_分镜脚本/镜头组-001/镜头-002.md
    reason: 镜头 002 明确不生成 Step 4 关键帧
shots:
  - id: shot-002
    mode: scene-basis
    reason: 该镜头以场景图兼任形象基准，不建三视图和关键帧
```

Field reference:

- `mode`: project-level flow mode, one of:
  - `standard`: the full standard flow (default).
  - `scene-basis`: globally allow "scene image doubles as the character baseline; no tri-view/keyframes".
  - `minimal-video`: globally allow skipping Step 4 keyframes and going straight to video prompts.
  - `hybrid`: no global relaxation; use `deviations` and `shots` for per-file/per-shot declarations.
- `deviations`: individually registered deviations.
  - `rule`: the `verify` error code to accept.
  - `scope`: optional. Limits the acceptance to a file, a directory prefix, or `file#anchor`; omitting it accepts every occurrence of that error code in the project.
  - `reason`: recommended; explain why the deviation is accepted.
  - `confirmed_by` / `confirmed_at`: optional owner and confirmation time.
- `shots`: per-shot flow modes.
  - `id`: the shot id, e.g. `shot-002`.
  - `mode`: the flow mode for that shot.
  - `reason`: optional explanation.

Legacy format: a top-level array is treated as `mode: standard` + `deviations: [...]`.

## CLI commands

```powershell
# Show current mode, registered deviations, and shot modes
ai-video-workflow deviation list --project <path>

# Set the project-level flow mode
ai-video-workflow deviation set-mode --project <path> --mode scene-basis

# Set a per-shot flow mode
ai-video-workflow deviation set-shot-mode --project <path> --shot shot-002 --mode minimal-video --reason "no keyframes"

# Remove a per-shot flow mode
ai-video-workflow deviation remove-shot-mode --project <path> --shot shot-002

# Register a deviation
ai-video-workflow deviation add --project <path> --rule missing-character-triview --scope 02_世界设定/角色设定.md --reason "scene image doubles as baseline" --by creator

# Remove a deviation
ai-video-workflow deviation remove --project <path> --rule missing-character-triview --scope 02_世界设定/角色设定.md
```

## Interactive confirmation

When `verify` runs in an interactive terminal and unregistered issues exist, the CLI asks one by one whether to register each as an accepted deviation:

```text
? 将以下问题登记为已接受偏离？
  missing-character-triview: Main character ... (02_世界设定\角色设定.md) (y/N)
```

- Answering "yes" writes `deviations.yaml` and re-verifies; registered issues then show as `Accepted deviations`.
- Non-interactive environments (CI, scripts, subagents) get no prompt and still fail with a non-zero exit.
- `--strict` skips interactive confirmation and ignores all registered deviations.

## verify behavior

- By default `verify` reads `deviations.yaml`, waives matching issues per the project mode, shot modes, and registered deviations, and prints `Accepted deviations (...)` in the output.
- `--strict` ignores `deviations.yaml` and mode relaxations, reporting all matching issues as failures again — useful to see "what strict mode would say".
- `export-obsidian` still requires `verify` to pass; after registering deviations or enabling a lightweight mode, the project can verify and therefore export the view layer.
- The Obsidian view layer shows "accepted deviations and flow modes" on the project home page and the affected shot pages, keeping deviations visible during review.

## Design boundaries

- Deviation registration is only for "the user explicitly chose not to follow the standard flow". It must not replace hard-contract fixes (missing files, broken links, undeclared references).
- Commit `deviations.yaml` to version control so that collaborators and agents can all see the accepted deviations.
- If a deviation no longer applies, run `deviation remove` / `remove-shot-mode` or delete the entry; the project returns to strict verification.
