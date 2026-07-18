export const sharedAgentEntryPath = "AGENTS.md";
export const sharedAgentDocsDir = "文档/智能体工作区";
export const sharedAgentDocsReadmePath = `${sharedAgentDocsDir}/入口说明.md`;
export const sharedAgentDocsBoundaryPath = `${sharedAgentDocsDir}/边界说明.md`;
export const sharedAgentDocsHandoffPath = `${sharedAgentDocsDir}/智能体交接.md`;

export const sharedAgentEntryMarkers = [
  "ai-video-workflow 共享智能体入口",
  sharedAgentDocsDir,
  "project-step-files"
] as const;

export const sharedAgentDocMarkers = [
  "ai-video-workflow 共享智能体工作区",
  "project-step-files",
  "平台记忆不是项目事实源"
] as const;

export const sharedAgentDocPaths = [
  sharedAgentDocsReadmePath,
  sharedAgentDocsBoundaryPath,
  sharedAgentDocsHandoffPath,
  `${sharedAgentDocsDir}/安全边界.md`,
  `${sharedAgentDocsDir}/平台矩阵.md`,
  `${sharedAgentDocsDir}/入口协调.md`
] as const;

export const cherryHostSurfaceFiles = ["SOUL.md", "USER.md", "soul.md", "user.md"] as const;
export const cherryHostSurfaceDirs = ["memory"] as const;

export const generatedLocalSurfaceIgnoreBlock = [
  "# ai-video-workflow generated and local surfaces",
  "_views/",
  ".obsidian/",
  ".codex/",
  ".cursor/",
  ".claude/",
  ".trae/",
  "SOUL.md",
  "USER.md",
  "soul.md",
  "user.md",
  "memory/"
].join("\n");

export type SharedAgentEntryClassification =
  | "missing"
  | "valid-ai-video-entry"
  | "custom-entry-needs-merge";

export function sharedAgentEntryMergeBlock(): string {
  return [
    "## ai-video-workflow",
    "",
    "标记：ai-video-workflow 共享智能体入口。",
    "",
    `- 修改工作流文件前，先读取 \`${sharedAgentDocsReadmePath}\` 和 \`${sharedAgentDocsBoundaryPath}\`。`,
    "- 将 `project-step-files` 理解为步骤一到步骤六的创作事实源。",
    "- `.codex/`、`.cursor/`、`.claude/`、`.trae/`、`_views/obsidian/`、MCP 资源和平台记忆都不是项目事实源。",
    "- Cherry Studio 的 `SOUL.md`、`USER.md` 和 `memory/` 可以保持兼容，但除非项目明确采用，否则不要把它们当作项目事实源。",
    "- 只使用相对链接。"
  ].join("\n");
}

export const sharedAiWorkspaceDocs: Record<string, string> = {
  "入口说明.md": [
    "# 共享智能体工作区",
    "",
    "标记：ai-video-workflow 共享智能体工作区。",
    "",
    `\`${sharedAgentDocsDir}/\` 是本项目的共享 AI 文档层。Codex、Cursor、Claude Code、Trae、Cherry Studio、Obsidian 观看层和 MCP 上下文都从这里获得同一个起点。`,
    "",
    "## 阅读顺序",
    "",
    "1. `AGENTS.md`",
    `2. \`${sharedAgentDocsBoundaryPath}\``,
    `3. \`${sharedAgentDocsHandoffPath}\``,
    `4. \`${sharedAgentDocsDir}/平台矩阵.md\``,
    "5. 源文件目录：`01_概念策划/` 到 `06_执行计划/`",
    "6. `_views/obsidian/` 只作为生成的观看层，不作为源文件层",
    "",
    "## 事实源",
    "",
    "- `project-step-files` 表示步骤一到步骤六的 Markdown 文件是创作事实源。",
    "- IDE 运行镜像文件只是适配器表面，不是项目事实源。",
    "- `_views/obsidian/` 是生成的 Obsidian 观看层，不是项目事实源。",
    "- Obsidian 投影、MCP 资源和平台记忆都不是项目事实源。",
    "- 平台记忆不是项目事实源。",
    "",
    "## Cherry Studio 兼容",
    "",
    "- Cherry Studio 可能在项目根目录创建 `SOUL.md`、`USER.md` 和 `memory/`。",
    "- 除非项目明确把它们纳入版本化协作协议，否则它们只代表宿主或用户记忆。",
    "- 跨智能体同步时不要覆盖或删除这些文件。"
  ].join("\n"),
  "边界说明.md": [
    "# 边界说明",
    "",
    "标记：ai-video-workflow 共享智能体工作区。",
    "",
    "本项目只把 `project-step-files` 作为创作事实源。",
    "",
    "## 可编辑源文件区",
    "",
    "- `01_概念策划/`",
    "- `02_世界设定/`",
    "- `03_分镜脚本/`",
    "- `04_图片提示词/`",
    "- `05_视频提示词/`",
    "- `06_执行计划/`",
    "",
    "## 生成区或适配器区",
    "",
    "- `.codex/` 运行镜像",
    "- `.cursor/` 运行镜像",
    "- `.claude/` 运行镜像",
    "- `.trae/` 运行镜像",
    "- Cherry Studio 创建的 `SOUL.md`、`USER.md`、`soul.md`、`user.md` 和根目录 `memory/`",
    "- `_views/obsidian/` 生成的 Obsidian 观看层",
    "- `_views/obsidian/笔记/` 用户手写 Obsidian 笔记，增量导出会保留，但它不是项目事实源",
    "- `_views/obsidian/.obsidian/` 本地 Obsidian UI 状态",
    "- MCP 资源和提示词",
    "",
    "不要把运行镜像、Obsidian 投影、MCP 资源、Cherry Studio 宿主记忆或平台记忆当作项目事实源。平台记忆不是项目事实源。"
  ].join("\n"),
  "智能体交接.md": [
    "# 智能体交接",
    "",
    "标记：ai-video-workflow 共享智能体工作区。",
    "",
    "一个 AI 智能体把工作交给另一个智能体时，使用这个边界。",
    "",
    "## 默认交接提示",
    "",
    "```text",
    `请先读取 AGENTS.md，再读取 ${sharedAgentDocsReadmePath} 和 ${sharedAgentDocsBoundaryPath}。将 project-step-files 作为事实源。只有在改变项目事实时才编辑步骤源文件。不要把运行镜像文件、Obsidian 投影、MCP 资源、Cherry Studio 的 SOUL/USER/memory 文件或平台记忆当作源文件。`,
    "```",
    "",
    "## 修改路由",
    "",
    "- 故事和叙事框架修改写入步骤三分镜脚本文件。",
    "- 视觉一致性和图片提示词修改写入步骤四图片提示词文件。",
    "- 运动和镜头行为修改写入步骤五视频提示词文件。",
    "- 执行组织和生产排期修改写入步骤六执行计划文件。",
    "",
    "## 修改后验证",
    "",
    "```text",
    "ai-video-workflow verify --project <path> --ide <id>",
    "ai-video-workflow export-obsidian --project <path> --in-project-view",
    "ai-video-workflow verify-obsidian --project <path> --in-project-view",
    "```",
    "",
    "平台记忆不是项目事实源。Cherry Studio 的 `SOUL.md`、`USER.md` 和 `memory/` 默认只是宿主或用户表面，除非用户明确要求维护它们。"
  ].join("\n"),
  "安全边界.md": [
    "# 安全边界",
    "",
    "标记：ai-video-workflow 共享智能体工作区。",
    "",
    "共享工作区不得收集密钥、账号令牌、供应商 key、平台缓存或私有记忆导出。",
    "",
    "## 规则",
    "",
    "- 只使用相对链接。",
    "- 不写入盘符路径、`file://` 链接或 IDE 专属 URI。",
    "- `_views/` 和 `.obsidian/` 不得收集密钥、供应商 key、平台缓存或私有记忆导出。",
    "- 不要把 Cherry Studio 全局记忆、根目录 `SOUL.md`、根目录 `USER.md`、根目录 `memory/`、`@cherry/memory`、`MEMORY_FILE_PATH`、Claude 自动记忆、Codex 本地记忆或 Trae 本地缓存复制进项目事实源。",
    "- 只把 `project-step-files` 当作创作事实源。",
    "- 平台记忆不是项目事实源。"
  ].join("\n"),
  "平台矩阵.md": [
    "# 平台矩阵",
    "",
    "标记：ai-video-workflow 共享智能体工作区。",
    "",
    "| 平台 | 共享入口 | 运行表面 | 边界 |",
    "| --- | --- | --- | --- |",
    "| Codex | `AGENTS.md` | `.codex/` | 只作为运行镜像 |",
    "| Cursor | `AGENTS.md` | `.cursor/` | 只作为运行镜像 |",
    "| Claude Code | `AGENTS.md`、`CLAUDE.md` | `.claude/` | `CLAUDE.md` 是 Claude 专属入口，不替代 `AGENTS.md` |",
    "| Trae | `AGENTS.md` | `.trae/` | Trae 规则位于 `.trae/rules/` |",
    "| Cherry Studio | `AGENTS.md` | 工作目录上下文，以及可能出现的根目录 `SOUL.md`、`USER.md`、`memory/` | 宿主或用户记忆与人设表面；sync 不生成也不覆盖它们 |",
    "| Obsidian | 生成的 vault 页面 | `_views/obsidian/` | 只作为投影观看层 |",
    "| MCP | 资源和提示词 | MCP server context | 只读上下文 |",
    "",
    "`project-step-files` 在所有平台上都是事实源。运行镜像文件和平台记忆不是项目事实源。平台记忆不是项目事实源。"
  ].join("\n"),
  "入口协调.md": [
    "# 入口协调",
    "",
    "标记：ai-video-workflow 共享智能体工作区。",
    "",
    "这个项目可能先被 Cherry Studio 打开，也可能先被 Codex、Cursor、Claude Code 或 Trae 打开。",
    "",
    "## 稳定源层",
    "",
    "- `AGENTS.md` 是跨智能体根入口。",
    `- \`${sharedAgentDocsDir}/\` 是共享 AI 文档层。`,
    "- `project-step-files` 是步骤一到步骤六的创作事实源。",
    "",
    "## 本地和适配器表面",
    "",
    "- `SOUL.md` 可能描述 Cherry Studio 人设或项目专属智能体身份。",
    "- `USER.md` 可能描述用户偏好或画像。",
    "- `memory/` 可能包含宿主或用户记忆。",
    "- `_views/obsidian/` 是生成的 Obsidian 观看层。",
    "- 除非项目明确说明，否则 Cherry Studio 宿主表面和 Obsidian 观看层都只是本地或适配器表面。",
    "",
    "如果 `AGENTS.md` 已存在但没有 ai-video-workflow 标记，请保留用户文件，并把下面这段合入：",
    "",
    "```md",
    sharedAgentEntryMergeBlock(),
    "```",
    "",
    "不要把密钥、私有记忆导出、供应商令牌、平台缓存或本地绝对路径复制进共享项目事实源。",
    "",
    "平台记忆不是项目事实源。"
  ].join("\n")
};

export function sharedAgentEntryContent(): string {
  return [
    "# AGENTS",
    "",
    "标记：ai-video-workflow 共享智能体入口。",
    "",
    "默认使用 `official-ai-video` 工作流包。",
    "",
    "## 阅读顺序",
    "",
    "1. `project.config.yaml`",
    `2. \`${sharedAgentDocsReadmePath}\``,
    `3. \`${sharedAgentDocsBoundaryPath}\``,
    `4. \`${sharedAgentDocsHandoffPath}\``,
    "5. 源文件目录：`01_概念策划/` 到 `06_执行计划/`",
    "",
    "## 事实源",
    "",
    "- `project-step-files` 表示步骤一到步骤六的 Markdown 文件是创作事实源。",
    "- `.codex/`、`.cursor/`、`.claude/` 和 `.trae/` 是运行镜像表面。",
    "- `_views/obsidian/` 是生成的 Obsidian vault 观看层；Obsidian vault 文件、MCP 资源、平台缓存和平台记忆都不是项目事实源。",
    "- Cherry Studio 可能创建 `SOUL.md`、`USER.md` 和 `memory/`；保持兼容，但默认不要把它们当作项目事实源。",
    "",
    "## 全局规则",
    "",
    "- 保持步骤三和步骤四逐镜头对齐。",
    "- 保持步骤四文件合同完整。",
    "- 除非项目明确关闭，否则默认使用增强流程。",
    "- 只使用相对链接。",
    "- 不要覆盖 Cherry Studio 的 `SOUL.md`、`USER.md` 或 `memory/` 宿主表面。",
    "- 平台记忆不是项目事实源。"
  ].join("\n");
}

export function classifySharedAgentEntry(content: string): SharedAgentEntryClassification {
  if (sharedAgentEntryMarkers.every((marker) => content.includes(marker))) {
    return "valid-ai-video-entry";
  }
  return "custom-entry-needs-merge";
}
