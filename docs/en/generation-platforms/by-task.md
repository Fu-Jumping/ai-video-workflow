# Generation Platforms by Task

- Image generation: OpenAI, MiniMax, Midjourney
- Image-to-video: Runway, Veo, Luma, Seedance
- Character consistency: OpenAI, Runway
- Camera extension: Veo, Runway

The CLI records the default image platform and default video platform during `init`. `SUPPORTED_PLATFORMS` is currently `openai / veo / runway / luma / minimax / seedance / midjourney`; any platform may be set as `platforms.image.default` or `platforms.video.default` (the config layer does not restrict by task). The table above is the recommended per-task mapping; `verify` does not enforce it.
