# 项目上下文工程（Context Engineering）

本目录是 `ai-video-workflow` 工具仓库的 AI 上下文系统：帮助任何新加入的 Agent 在几分钟内理解项目结构、找到正确入口、知道边界在哪、改完该跑什么验证。

## 与权威规范的关系

本目录只做**地图、路由、边界和门禁**，不复写规则正文。冲突时按以下优先级解释：

1. `packs/official-ai-video/workflow/workflow-spec.md`（工作流主规范）
2. `packs/official-ai-video/workflow/quality-gates.md`（质量门槛）
3. 各步骤 `packs/official-ai-video/skills-longform/*.md`
4. 本目录文档
5. docs/zh、docs/en 下的站点说明文档

`[通用规则]` `[AVW 专用]` `[临时决策]` `[待确认]` 四类标注的含义见 [08-portability-guide.md](./08-portability-guide.md)。

## 路径约定

- Markdown 链接（可点击）：仅指向 `docs/` 内部文件。
- 反引号包裹的路径（如 `packs/official-ai-video/workflow/workflow-spec.md`）：指 docs/ 外部文件，**一律为仓库根相对路径**。不使用 Markdown 链接指向 docs 外部的原因：`pnpm docs:build` 的 VitePress 死链检查会判其失败。`[临时决策]`

## 三分钟上手路径（新 Agent 必读）

1. [00-project-context.md](./00-project-context.md) —— 这是什么仓库、我能改什么、哪里绝对不能碰。
2. [05-task-routing.md](./05-task-routing.md) —— 按你的任务类型找到：应读文档、可改文件、必须运行的验证。
3. [06-verification-gates.md](./06-verification-gates.md) —— 改完之后怎么证明没改坏。

只做创作项目支持（不在本仓库写代码/文档）的 Agent，读完 00 后直接看 [02-workflow-map.md](./02-workflow-map.md) 即可。

## 文件清单

| 文件 | 层 | 内容 |
| --- | --- | --- |
| [00-project-context.md](./00-project-context.md) | L1 项目上下文 | 项目身份、双仓模型、目录速览、修改边界、确认点 |
| [01-context-loading-order.md](./01-context-loading-order.md) | L1 加载顺序 | 按任务/角色给出上下文读取顺序 |
| [02-workflow-map.md](./02-workflow-map.md) | L2 工作流地图 | Step 0-7 全景、继承链、修改传播 |
| [03-step-contracts.md](./03-step-contracts.md) | L2 分步契约 | 每步的输入/产出/审核/回流/验证/禁改项 |
| [04-domain-glossary.md](./04-domain-glossary.md) | L3 领域术语 | 项目特有概念速查 |
| [05-task-routing.md](./05-task-routing.md) | L2 任务路由 | 任务类型 → 应读 → 可改 → 验证 |
| [06-verification-gates.md](./06-verification-gates.md) | L4 验证门禁 | 变更类型 × 验证矩阵 + 隔离 E2E 方法论 |
| [07-decisions-and-open-questions.md](./07-decisions-and-open-questions.md) | L4 决策与缺口 | 决策记录、上下文缺口、待确认事项 |
| [08-portability-guide.md](./08-portability-guide.md) | L5 可迁移层 | 标注体系、最小迁移骨架、不可迁移清单 |
| [09-conversation-guidance.md](./09-conversation-guidance.md) | L4 行为门禁 | 对话引导口径权威：首触引导、每轮状态脚注、初始化护航、载体登记 |
| [10-manual-testing-guide.md](./10-manual-testing-guide.md) | L4 测试指南 | 人工真实对话手动测试：从零克隆、全局安装、场景清单、评级与问题处置 |
| [implementation-plan-2026-08-23.md](./implementation-plan-2026-08-23.md) | 计划存档 | 本目录的建立计划与勘察结论 |
| templates/ | L5 模板 | 任务简报、来源卡、审核记录、变更请求、隔离测试报告 |

## 与既有文档的分工

- `docs/zh/contributors/workflow-system-map.md`：面向"想理解这个系统的人"。
- 本目录：面向"要动手干活的 Agent"——路由、边界、门禁。
- `WORKFLOW_OVERVIEW.md`、`README.md`（仓库根）：面向人类用户与贡献者的总览，是被本目录索引的对象。
- 机器全局 skill `avw-isolated-e2e-testing`：隔离端到端测试的完整方法论；[06-verification-gates.md](./06-verification-gates.md) 只沉淀与本仓库直接相关的部分并指向该 skill。

## 维护规则 `[通用规则]`

1. 上游规范（pack、CLI 行为、CI 命令）变更后，同步更新本目录的对应指针与摘要，防止漂移。
2. 每条新增规则须能追溯到真实文件、测试、模板或历史决策；禁止臆造步骤、目录、工具或模型。
3. 发现本目录与 pack 规范冲突时：以 pack 为准，并到 [07-decisions-and-open-questions.md](./07-decisions-and-open-questions.md) 登记缺口。
4. 模板文件保持轻量、可直接复制填写；不要把模板扩成规范。
