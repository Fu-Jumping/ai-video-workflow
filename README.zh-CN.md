# ai-video-workflow

`ai-video-workflow` 是一个面向 AI 视频创作工作流的开源产品仓库。

它同时包含：

- 官方 workflow pack
- TypeScript CLI
- 双语 VitePress 文档站
- IDE 集成层
- checks 与校验规则

## 当前状态

这个仓库是从旧的内部母包重构出来的第一阶段产品仓库，当前默认官方 pack 是 `official-ai-video`。

## 快速开始

1. 运行 `pnpm install` 安装依赖。
2. 运行 `pnpm build` 构建 CLI 与文档站。
3. 运行 `pnpm --filter ai-video-workflow test` 执行 CLI 测试。
4. 使用 `ai-video-workflow init` 生成新项目骨架。

## 仓库结构

- `apps/cli`：CLI 实现
- `packs/official-ai-video`：官方 workflow pack
- `docs`：双语文档站
- `scaffolds`：workflow pack 脚手架
- `examples`：可公开的最小示例
