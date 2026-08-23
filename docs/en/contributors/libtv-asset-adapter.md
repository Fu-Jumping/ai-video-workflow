# LibTV Asset Adapter

`ai-video-workflow libtv ...` is the LibTV asset execution adapter. It only handles asset upload, references, image/video generation, and result download.

## Boundary

- Source of truth: Step 0-7 Markdown + `project.config.yaml`
- LibTV responsibilities: anchor upload, node/reference edges, image/video generation, result download
- Not responsible: story/plot, storyboard design, `script storyboard`
- Never rewrites Step source files

## Commands

```text
ai-video-workflow libtv workspace ...
ai-video-workflow libtv project ...
ai-video-workflow libtv node ...
ai-video-workflow libtv group ...
ai-video-workflow libtv upload ...
ai-video-workflow libtv download ...
ai-video-workflow libtv model ...
ai-video-workflow libtv plan
ai-video-workflow libtv apply
ai-video-workflow libtv status
ai-video-workflow libtv verify
ai-video-workflow libtv approve
ai-video-workflow libtv review
ai-video-workflow libtv refine
```

## Asset Chain

```text
Step2 anchors -> Step4 keyframes -> Step5 videos
     upload          generate/download      generate/download
```

Local layout:

```text
assets/anchors/characters/<character>三视图.png
assets/anchors/scenes/<scene>场景图.png
outputs/images/<group>/<shot>/
outputs/video/<group>/<shot>/
.libtv/project.json
.libtv/state.json
```

## Model Mapping

Configure in `project.config.yaml`:

```yaml
libtv:
  image_model: mj-v8.2
  video_model: star-video2
```

Built-in defaults when not configured:

- `midjourney -> mj-v8.2`
- `gpt-image-2 -> lib-image-2`
- `seedance -> star-video2`

## Review and Two-Stage Refine

After a keyframe/anchor first version is generated, it enters a human review loop:

1. `libtv review <id> --decision direct|refine|regenerate [--feedback <text>]`: record the review decision (usable as-is / needs refine / needs regeneration). `id` looks like `group-001/shot-001/keyframe-01` or `@角色名三视图`.
2. `libtv refine <id> --instruction <Chinese fix instruction> [--base first|current]`: create a refine node with GPT Image 2 (LibTV model `lib-image-2`) based on human feedback. The refine prompt is generated dynamically by the CLI from a "fix only the listed issues, keep everything else unchanged" template; `--base first` returns to the first version, `--base current` builds on the latest round. **Refining triggers real generation: the CLI requires an explicit `--allow-generation` flag and refuses to run without it.**
3. `libtv approve <id>`: human approval. If refine rounds exist, `finalNodeId` points to the latest refine node and the keyframe status becomes `final_approved`, so the refined image joins the main chain referenced by Step 5 video generation; without refine rounds it points to the first version (status `approved`).

Status: `libtv status` prints each keyframe/anchor with `review` (decision), `final` (main-chain node), and `rounds` (refine rounds); MCP `mcp-context` exposes refine round counts, and the Obsidian dashboard shows refine rounds and the latest refine node. For impact tracing, `impact --image <node> --project <path>` maps a LibTV image node back to affected Step 4/5 files.

## Edge Order and Placeholders

- Video nodes write `imageListOrder` / `mixedListOrder` in `--left` order.
- `&#123;&#123;Node "name"&#125;&#125;` placeholders are rewritten to `&#123;&#123;Image n&#125;&#125;` (or `&#123;&#123;Mixed n&#125;&#125;`) based on reference order.
- Step 5 `素材上传顺序` is already checked by `libtv verify-order` via `orderTokens` against the actual node order.

## Implemented Capabilities

- Upload: auto-installs the official CLI when missing, then uses it as a bridge.
- Phone login: `libtv login phone` supports send-code and code login.
- Download: direct single-file download; multi-file/watermark options use the official CLI for ZIP and watermark support.
- Pipe: `libtv node <downstream>` reads NDJSON from stdin and treats entries as left references.
- Order contracts: `libtv verify-order --write-contract` writes a contract; subsequent `verify-order` checks orderHash.
- Model availability: `apply` validates model existence before running.
- Review and refine: `libtv review` records direct/refine/regenerate decisions; `libtv refine` creates refine nodes via `lib-image-2` and merges them into the main chain (see "Review and Two-Stage Refine" above).

## Known Limits

- Upload first tries HTTP direct upload, then falls back to the local official `libtv` CLI.
- `account info` `user.id` may not exactly match the official CLI.
- `login web` supports local callback.
