# Quickstart

1. Run `pnpm install`.
2. Run `pnpm build`.
3. Run `node apps/cli/dist/index.js init`.
4. Choose the IDE, default image platform, and default video platform.
5. Run `node apps/cli/dist/index.js verify --project <project-path> --ide <ide>`.
6. If verification fails, run `node apps/cli/dist/index.js doctor --project <project-path> --ide <ide>`.
7. If IDE runtime files are missing, run `node apps/cli/dist/index.js sync --project <project-path> --ide <ide>`.
8. Start working from `01_concept/`.

The default pack is `official-ai-video`, and enhanced flow is enabled unless the project explicitly disables it.
