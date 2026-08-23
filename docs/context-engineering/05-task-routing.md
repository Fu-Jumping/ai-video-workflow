# 05 任务路由

任务类型 → 应读文档 → 可改文件 → 必须验证。加载顺序的前提见 [01-context-loading-order.md](./01-context-loading-order.md)。

路径约定：反引号路径为仓库根相对路径；docs/ 内链接可点击。**"可改文件"是默认授权范围，超出即停并请求确认**（[00-project-context.md](./00-project-context.md) §6）。

## A. 创作项目侧任务（Agent 在创作项目内工作）

### A1 新创作项目初始化

| 项 | 内容 |
| --- | --- |
| 应读 | `docs/zh/quickstart/beginner-agent-init.md`、`docs/zh/quickstart/index.md`、[02-workflow-map.md](./02-workflow-map.md) |
| 可改 | 工具仓库之外的新建创作项目目录（先确认父目录，禁止在工具仓库内 init） |
| 验证 | `init` 输出的 next steps；项目内 `verify --step 0`（研究模式）或相应起始步；`doctor` |

### A2 从构想开始（无研究资料，轻量起步）

| 项 | 内容 |
| --- | --- |
| 应读 | `packs/official-ai-video/skills-longform/film-planner.md`、对应模板、[03-step-contracts.md](./03-step-contracts.md) Step 1 |
| 可改 | 创作项目 `01_概念策划/`；确认后逐级下游 |
| 验证 | `verify --step 1`；人审故事内核后再进 Step 2 |

### A3 从研究资料开始（研究模式默认路径）

| 项 | 内容 |
| --- | --- |
| 应读 | `docs/zh/workflow/step-00-research.md`、`packs/official-ai-video/skills-longform/film-researcher.md`、[03-step-contracts.md](./03-step-contracts.md) Step 0 |
| 可改 | 创作项目 `00_前期研究/`；`research ingest/inbox` 归档 |
| 验证 | `verify --step 0`；创作简报事实/推断/改编三分通过人审 |

### A4 剧本或脚本修改（Step 1 层）

| 项 | 内容 |
| --- | --- |
| 应读 | [02-workflow-map.md](./02-workflow-map.md) §3-4、`docs/zh/workflow/impact-analysis.md` |
| 可改 | `01_概念策划/`；受影响下游文件（联动修改） |
| 验证 | 影响分析先回报 → 修改 → 全量 `verify`；有观看层则 `export-obsidian` + `verify-obsidian` |

### A5 分镜修改（Step 3 层）

| 项 | 内容 |
| --- | --- |
| 应读 | `packs/official-ai-video/skills-longform/film-storyboarder.md`、`docs/zh/workflow/step-03-storyboard.md`、[03-step-contracts.md](./03-step-contracts.md) Step 3 |
| 可改 | `03_分镜脚本/`；受影响 Step 4/5 文件；镜头编号重排时注意观看层 orphaned 残留（`docs/zh/workflow/rewrite-handbook.md`） |
| 验证 | `verify --step 3`（Step 4 未建时）或全量；`clean-view --dry-run` 预览再重建观看层 |

### A6 关键帧或参考图处理（Step 2/4 层）

| 项 | 内容 |
| --- | --- |
| 应读 | `packs/official-ai-video/skills-longform/film-setter.md`、`film-image-prompter.md`、quality-gates.md §1.2/§4、[04-domain-glossary.md](./04-domain-glossary.md) LibTV 精修节 |
| 可改 | `02_世界设定/`（锚点声明）、`04_图片提示词/`（关键帧文件，gpt-image-2 项目含可选 `## 精修配置`）；Step 3 参考资产要求联动 |
| 验证 | `verify --step 2` / `--step 4`（含 gpt-image-2 平台参数检查）；LibTV 执行链：首版生成后 `libtv review`（direct/refine/regenerate）→ 需要精修时 `libtv refine`（真实生成，须用户确认并显式 `--allow-generation`）→ `libtv approve`；改动执行面图片后用 `impact --image <节点>` 反查受影响 Step 4/5 文件 |

### A7 视频提示词编写（Step 5 层）

| 项 | 内容 |
| --- | --- |
| 应读 | `packs/official-ai-video/skills-longform/film-video-prompter.md`、workflow-spec.md §3.2、[03-step-contracts.md](./03-step-contracts.md) Step 5 |
| 可改 | `05_视频提示词/` |
| 验证 | `verify --step 5`；`libtv verify-order`（LibTV 场景）；人审连续性重述 |

### A8 平台执行参数调整

| 项 | 内容 |
| --- | --- |
| 应读 | [04-domain-glossary.md](./04-domain-glossary.md) 平台节、quality-gates.md §4.6（midjourney）、§5.3（Step 5 平台执行设置） |
| 可改 | 对应 Step 4/5 文件的 `## 平台执行参数` / `平台执行设置` 区块 |
| 验证 | 全量 `verify`（平台参数是机器✅检查项）；不写入密钥/账号/绝对路径 |

### A9 审核意见回流

| 项 | 内容 |
| --- | --- |
| 应读 | [02-workflow-map.md](./02-workflow-map.md) §4-5、[templates/step-review-record.md](./templates/step-review-record.md)、[templates/change-request.md](./templates/change-request.md) |
| 可改 | 意见指向的步骤文件及其下游受影响文件 |
| 验证 | 每条意见记录原文/处理/理由/修改文件 → 复核 → `verify`；跨步修改先做影响分析并回报 |

## B. 工具仓库侧任务（Agent 在本仓库工作）

### B1 母包规则 / 模板 / skill 维护

| 项 | 内容 |
| --- | --- |
| 应读 | [01-context-loading-order.md](./01-context-loading-order.md) §1 全部文件 |
| 可改 | `packs/official-ai-video/` 对应文件（长文源与技能包同改）；同步镜像 |
| 验证 | `pnpm build`、`pnpm test`、`pnpm example:verify`（合称 `pnpm verify:v0.2`）；模板类改动确认"照抄即合规"（template-compliance 测试） |

### B2 CLI / 校验器开发

| 项 | 内容 |
| --- | --- |
| 应读 | [01-context-loading-order.md](./01-context-loading-order.md) §2；拟改模块的 src 与 tests |
| 可改 | `apps/cli/src/`、`apps/cli/tests/`（每个修复带回归测试，`FIX_PLAN.md` 修复原则） |
| 验证 | `pnpm build` → `pnpm test`（串行）；相关专项（如 libtv mock 测试）；`pnpm verify:v0.2` |

### B3 平台执行参数/枚举调整（工具侧）

| 项 | 内容 |
| --- | --- |
| 应读 | `apps/cli/src/lib/constants.ts`、`apps/cli/src/lib/types.ts`、README.md 平台清单 |
| 可改 | 平台枚举、平台口径索引（如 `packs/official-ai-video/workflow/indexes/platform-midjourney-v82.md`） |
| 验证 | `pnpm test` + example:verify；确认 CLI 口径与文档口径一致 |

### B4 测试 / 隔离复测

| 项 | 内容 |
| --- | --- |
| 应读 | 仓库根 `AGENTS.md` Testing 章节、机器全局 skill `avw-isolated-e2e-testing`、[06-verification-gates.md](./06-verification-gates.md)、[templates/isolated-test-report.md](./templates/isolated-test-report.md) |
| 可改 | `G:\develop-G\tests\` 下本轮测试目录（新建子文件夹） |
| 验证 | 隔离红线全程遵守；不消耗生成额度；主对话做比对与终审 |

### B5 文档维护（docs/ 站点）

| 项 | 内容 |
| --- | --- |
| 应读 | [01-context-loading-order.md](./01-context-loading-order.md) §3；本目录 README 链接规范 |
| 可改 | `docs/` 内文件（zh/en 成对维护）；侧边栏 `docs/.vitepress/config.ts` |
| 验证 | `pnpm docs:build`（死链检查）；中英文一致性人审 |

### B6 缺陷诊断

| 项 | 内容 |
| --- | --- |
| 应读 | 症状相关模块 src/tests；`FIX_PLAN.md`（已知问题与历史决策）；[07-decisions-and-open-questions.md](./07-decisions-and-open-questions.md) |
| 可改 | 诊断阶段**只读**；修复方案经确认后进入 B2 流程 |
| 验证 | 先复现（最小路径）再定位根因（文件+函数级）；修复带回归测试 |

### B7 adapter 新增 / 扩展（Obsidian/LibTV/MCP/IDE）

| 项 | 内容 |
| --- | --- |
| 应读 | `docs/zh/contributors/adapter-boundaries.md`、`docs/zh/contributors/agent-adapter-contract.md`、对应 adapter 文档（libtv-asset-adapter.md / mcp-adapter.md / obsidian-vault-projection.md） |
| 可改 | 对应 adapter 模块与文档；必须说明输入、输出、同步方向、失败回滚、验证命令 |
| 验证 | 对应 adapter 测试 + `pnpm verify:v0.2`；不得破坏 Step 3/4 对齐与 Step 4 合同 |

## 路由不命中时 `[通用规则]`

1. 判断任务是否真的在本仓库/创作项目范围内；不确定 → 询问用户。
2. 跨多种任务 → 拆分后分别路由。
3. 仍不命中 → 按 [00-project-context.md](./00-project-context.md) §6 停止并确认，不发明流程。
