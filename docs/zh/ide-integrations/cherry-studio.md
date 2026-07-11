# Cherry Studio

Cherry Studio 在 v0.6 中被视为工作目录型智能体 adapter，不是 `sync --ide` 目标。

## 推荐设置

把 Cherry Studio Agent 的工作目录指向项目根目录。在 Agent prompt 中要求它先读：

1. `AGENTS.md`
2. `docs/ai-workspace/README.md`
3. `docs/ai-workspace/BOUNDARIES.md`
4. 源 Step 文件

当需要修改项目事实时，只编辑 Step 文件。

Cherry Studio 可能会在工作目录根部自动创建 `SOUL.md`、`USER.md` 和 `memory/`。这些文件允许存在，但默认不改变 ai-video-workflow 的事实源模型：`AGENTS.md` 和 `docs/ai-workspace/` 仍是跨智能体入口，Step 文件仍是创作事实源。

## 初始化顺序

当 Cherry Studio 先进入项目时，可以让 `sync` 添加 ai-video-workflow 共享层；它不会替换 Cherry Studio 已生成的宿主文件。

当 Cherry Studio 后接入项目时，继续保留已有的 `AGENTS.md` 和 Step 文件作为项目协作事实源。

当 `AGENTS.md` 已经存在但不含 ai-video-workflow marker 时，运行 `verify` 或 `doctor`，然后手动合并建议 block。不要把 Cherry Studio 的私有记忆、token、本机路径或平台缓存复制进项目事实源。

## 边界

不要把 Cherry Studio 的记忆或 persona 文件当成项目事实源。

`ai-video-workflow` 不生成也不覆盖：

- `soul.md`
- `user.md`
- `USER.md`
- `SOUL.md`
- `memory/`
- `MEMORY_FILE_PATH`
- Cherry Studio global memory
- `@cherry/memory`

Cherry Studio 可以与项目共用工作目录，但宿主级记忆仍然在工作流事实源之外。

其他智能体看到这些文件时，应把它们当作 Cherry Studio 宿主/用户上下文，不应自动同步、整理或覆盖。是否把它们纳入 Git，由项目自己决定；CLI 默认只保证共存兼容。

`verify` 会跳过根目录的 `SOUL.md`、`USER.md`、大小写变体和 `memory/`，所以这些宿主文件中的本机路径或平台记忆不会触发项目 Markdown 链接错误。

## Adapter Contract

- 读取：`AGENTS.md`、`docs/ai-workspace/`、项目 Step 文件。
- 写入：v0.6 不生成 Cherry Studio runtime 文件。
- 同步方向：`read-only-context`。
- 事实源：`project-step-files`。
- 验证可使用已有 IDE 目标，例如 `ai-video-workflow verify --project <path> --ide codex`。
