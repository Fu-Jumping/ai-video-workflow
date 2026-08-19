# Generation Platforms by Task

- Image generation: OpenAI, MiniMax, Midjourney
- Image-to-video: Runway, Veo, Luma, Seedance
- Character consistency: OpenAI, Runway
- Camera extension: Veo, Runway

The CLI records the default image platform and default video platform during `init`. `SUPPORTED_PLATFORMS` is currently `openai / veo / runway / luma / minimax / seedance / midjourney`; any platform may be set as `platforms.image.default` or `platforms.video.default` (the config layer does not restrict by task). The table above is the recommended per-task mapping; `verify` does not enforce it.

## Step 4 Image Prompt Contract and Platform Differences

For projects whose default image platform is midjourney, Step 4 deliverables must include `## 平台执行参数` (platform, `--v 8.2`, `--ar`, `--style raw`, style direction, stylize, reference asset upload method, and negative constraint execution method) in addition to `快速导读 / 中文完整版本 / 可复制提示词`. The copyable prompt must be written in English (seven elements + parameter line) and its body must be ≤1024 characters. The default style direction is a photorealistic film look, but it is not fixed; projects may switch to illustration, ink wash, pixel art, etc. based on the visual style. The Chinese full version remains in Chinese and must be ≥180 characters. V8 does not support `--cref` / `--cw` / `--q` / `::`; negative constraints should prefer positive descriptions, and `--no` accepts word-level exclusions only. Platform facts are in the pack at `packs/official-ai-video/workflow/indexes/platform-midjourney-v82.md`.
