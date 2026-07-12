# Security

Marker: ai-video-workflow shared agent workspace.

The shared workspace must not collect secrets, account tokens, provider keys, platform caches, or private memory exports.

Rules:

- Keep links relative.
- Do not write drive-letter paths, `file://` links, or IDE-specific URIs.
- Do not copy Cherry Studio global memory, root `SOUL.md`, root `USER.md`, root `memory/`, `@cherry/memory`, `MEMORY_FILE_PATH`, Claude auto memory, Codex local memory, or Trae local cache into project truth.
- Treat `project-step-files` as the only creative source of truth.
- Platform memory is not project truth.
