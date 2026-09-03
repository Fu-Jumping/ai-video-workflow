# 01 上下文加载顺序

按任务类型给出读取顺序。原则：**先读稳定规则与路由，再按需加载专项文档；不确定时回到 `packs/official-ai-video/workflow/workflow-spec.md`。** `[通用规则]`

## 0. 所有任务的公共起点 `[AVW 专用]`

1. 仓库根 `AGENTS.md` —— 跨 Agent 稳定规则、对话引导行为与测试编排要求（引导话术的口径权威见 [09-conversation-guidance.md](./09-conversation-guidance.md)）。
2. `docs/context-engineering/00-project-context.md` —— 身份、边界、确认点。
3. [05-task-routing.md](./05-task-routing.md) —— 定位你的任务类型。

## 1. 母包规则 / 模板 / skill 维护

```
packs/official-ai-video/workflow/workflow-spec.md        ← 最高层正式规则
packs/official-ai-video/workflow/quality-gates.md        ← 质量门槛（含机器✅/人工👤归属）
packs/official-ai-video/workflow/indexes/capability-index.md  ← 增强流程横切能力
对应步骤 packs/official-ai-video/skills-longform/<skill>.md   ← 内容源
对应步骤 packs/official-ai-video/skills/<skill>/SKILL.md     ← 打包层（与内容源同步改）
对应步骤 packs/official-ai-video/templates/<步骤>/<模板>.md
WORKFLOW_OVERVIEW.md §9-§10                              ← 维护与链接规则
```

何时必须读专项：改 skill 打包接口 → quality-gates.md §1.1；改平台口径 → `packs/official-ai-video/workflow/indexes/platform-midjourney-v82.md`；新增 adapter → `docs/zh/contributors/agent-adapter-contract.md`。

## 2. CLI / 校验器开发

```
apps/cli/src/index.ts                ← 命令注册入口
apps/cli/src/lib/<模块>.ts            ← verify/sync/init/impact/deviations/obsidian/libtv/...
apps/cli/tests/<模块>.test.ts         ← 对应测试（vitest）
docs/zh/contributors/testing.md      ← 命令清单与串行约束
docs/zh/quickstart/verify-and-iterate.md  ← verify --step 分步校验语义
docs/zh/workflow/supported-deviations.md  ← deviations.yaml 行为
```

## 3. 文档维护（docs/ 站点）

```
docs/.vitepress/config.ts            ← 侧边栏与站点结构
对应语言目录 docs/zh/... 或 docs/en/...  ← 中英文成对维护
docs/context-engineering/README.md   ← 链接规范（docs 外部引用不用 Markdown 链接）
```

## 4. 测试 / 隔离复测

```
仓库根 AGENTS.md Testing 章节          ← 编排流程红线
机器全局 skill avw-isolated-e2e-testing ← 完整方法论（隔离红线/复测矩阵/报告模板）
FIX_PLAN.md                           ← 历史修复与回归测试基线
docs/context-engineering/06-verification-gates.md  ← 本仓库侧摘要
```

## 5. 创作项目支持（Agent 在创作项目内工作）

```
创作项目 AGENTS.md                     ← 阅读顺序与事实源声明
project.config.yaml                    ← pack、ide、默认平台、模式开关
文档/智能体工作区/                      ← 共享边界、交接、平台矩阵
packs/official-ai-video/workflow/step-map.yaml  ← 步骤 → 目录映射
当前步骤的 skills-longform/<skill>.md 与模板
docs/zh/workflow/step-0N-*.md         ← 分步用户文档
```

何时切换：跨步骤/跨边界请求 → 先读 `packs/official-ai-video/skills-longform/film-workflow.md`（总路由 skill）；修改已完成步骤 → `docs/zh/workflow/impact-analysis.md`；整体重写 → `docs/zh/workflow/rewrite-handbook.md`。

## 6. 必须停下请求确认的时机 `[通用规则]`

- 触发 [00-project-context.md](./00-project-context.md) §6 任一条件（额度、破坏性、改已完成步骤、登记偏离、commit/push）。
- 发现仓库现状与文档/规则不一致 → 登记 [07-decisions-and-open-questions.md](./07-decisions-and-open-questions.md) 并在对话中报告，**不擅自修改业务行为**。
- 任务超出路由表覆盖范围 → 回到用户确认任务性质，不自创流程。
