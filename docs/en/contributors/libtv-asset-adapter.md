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
- `seedance -> star-video2`

## Edge Order and Placeholders

- Video nodes write `imageListOrder` / `mixedListOrder` in `--left` order.
- `&#123;&#123;Node "name"&#125;&#125;` placeholders are rewritten to `&#123;&#123;Image n&#125;&#125;` (or `&#123;&#123;Mixed n&#125;&#125;`) based on reference order.
- The current implementation supports this mapping; Step 5 upload-order validation can be added later.

## Implemented Capabilities

- Upload: auto-installs the official CLI when missing, then uses it as a bridge.
- Phone login: `libtv login phone` supports send-code and code login.
- Download: direct single-file download; multi-file/watermark options use the official CLI for ZIP and watermark support.
- Pipe: `libtv node <downstream>` reads NDJSON from stdin and treats entries as left references.
- Order contracts: `libtv verify-order --write-contract` writes a contract; subsequent `verify-order` checks orderHash.
- Model availability: `apply` validates model existence before running.

## Known Limits

- Upload first tries HTTP direct upload, then falls back to the local official `libtv` CLI.
- `account info` `user.id` may not exactly match the official CLI.
- `login web` supports local callback.
