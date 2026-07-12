# 测试

- `pnpm build`
- `pnpm test`
- `pnpm example:verify`
- `pnpm example:obsidian`
- `pnpm example:obsidian:ui`
- `pnpm example:obsidian:in-project`
- `pnpm example:mcp-context`
- `pnpm verify:v0.2`
- `git diff --check`

涉及 `apps/cli/dist` 的命令需要串行执行。built CLI 测试和示例脚本会重建或读取同一个 `dist` 目录，并行跑容易造成误报。

Obsidian 人工 QA 时，打开 `examples/official-mini-film/_views/obsidian/`，不要打开 `examples/official-mini-film/`。
