# 快速开始

1. 运行 `pnpm install`。
2. 运行 `pnpm build`。
3. 运行 `node apps/cli/dist/index.js init`。
4. 选择 IDE、默认生图平台和默认生视频平台。
5. 运行 `node apps/cli/dist/index.js verify --project <project-path> --ide <ide>`。
6. 如果校验失败，运行 `node apps/cli/dist/index.js doctor --project <project-path> --ide <ide>`。
7. 如果缺少 IDE 运行文件，运行 `node apps/cli/dist/index.js sync --project <project-path> --ide <ide>`。
8. 从 `01_concept/` 开始推进项目。

默认 pack 是 `official-ai-video`。除非项目显式关闭，否则默认启用增强流程。
