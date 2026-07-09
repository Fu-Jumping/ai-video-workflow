# 快速开始

1. 运行 `pnpm install`。
2. 运行 `pnpm build`。
3. 选择交互式或脚本化初始化。
4. 运行 `node apps/cli/dist/index.js verify --project <project-path> --ide <ide>`。
5. 如果校验失败，运行 `node apps/cli/dist/index.js doctor --project <project-path> --ide <ide>`。
6. 如果缺少 IDE 运行文件，运行 `node apps/cli/dist/index.js sync --project <project-path> --ide <ide>`。
7. 从 `01_concept/` 开始推进项目。

交互式初始化：

```powershell
node apps/cli/dist/index.js init
```

脚本化初始化：

```powershell
node apps/cli/dist/index.js init --name my-ai-video-project --ide codex --image openai --video runway
```

默认 pack 是 `official-ai-video`。除非项目显式关闭，否则默认启用增强流程。
