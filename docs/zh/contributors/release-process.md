# 发布流程

第一阶段先聚焦本地构建、校验与 pack 完整性。

## 发布说明

- [v0.3 Obsidian vault 投影](./release-notes-v0.3.md)

## v0.3 验证门槛

构建、测试和示例命令都会使用 `apps/cli/dist`，因此发版检查需要串行运行。

```bash
pnpm build
pnpm test
pnpm example:verify
pnpm example:obsidian
pnpm example:obsidian:ui
pnpm verify:v0.2
git diff --check
```

Obsidian 相关发版还需要运行 v0.3 发布说明中记录的绝对链接扫描。
