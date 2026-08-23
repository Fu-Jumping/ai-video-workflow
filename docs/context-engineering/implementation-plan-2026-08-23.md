# 上下文工程实施计划（2026-08-23）

本计划是"项目上下文工程"四个阶段（勘察 → 设计 → 计划 → 实施）中的第三阶段产物。实施范围受用户明确约束：**只允许新增/修改 `docs/` 内文件与根级 `AGENTS.md`、`CLAUDE.md`，不改动任何业务代码、模板或工作流契约。**

## 1. 目标与非目标

### 目标

1. 为 ai-video-workflow 工具仓库建立一套分层的、可长期维护的 AI 项目上下文系统，使任何新 Agent 能在几分钟内找到正确入口。
2. 把散落在根级规则、pack 规范、docs 站点、测试 skill 中的稳定知识接入统一索引，不复制第二份正文。
3. 建立任务路由（任务类型 → 应读文档 → 可改文件 → 必须验证）与验证门禁（变更类型 → 验证命令）。
4. 建立可迁移层：明确标注每类规则属于通用规则、AVW 专用规则、当前阶段临时决策还是待确认事项。
5. 测试方法与机器全局 skill `avw-isolated-e2e-testing` 及仓库 `AGENTS.md` Testing 章节对齐，不另造一套。

### 非目标

1. 不重构业务代码、不修改视频生成逻辑、不改变既有工作流契约（Step 0-7 职责、文件合同、质量门槛全部保持原样）。
2. 不把源代码或规范正文复制进 AI 文档；文档只解释结构、边界、决策和入口，并指向真实文件。
3. 不修改 `packs/`、`apps/`、`examples/`、`schemas/`、`scaffolds/`、`.github/` 下的任何文件。
4. 不修复勘察中发现的既有缺口（只登记为待确认事项，见 §11）。
5. 不运行消耗生成额度（图片/视频生成、LibTV 真实执行）的操作。

## 2. 当前项目勘察结论

### 2.1 项目身份：工具仓库，不是创作项目

ai-video-workflow 是一个开源**产品仓库**，包含：官方工作流包（packs/）、TypeScript CLI（apps/cli）、双语 VitePress 文档站（docs/）、示例项目（examples/）、pack 脚手架（scaffolds/）。创作项目由 CLI `init` 在工具仓库**之外**生成（README.md "Beginner Start"、docs/zh/contributors/onboarding-initialization-notes.md "当前入口状态"）。新 Agent 最常见的误判就是把工具仓库当成创作项目、直接在仓库根写创作内容。

### 2.2 双层来源与镜像模型

- 母版源：`packs/official-ai-video/`（规则、模板、skill、质量门槛、checks 的唯一权威来源）。
- 运行镜像：创作项目内 `.codex/ .cursor/ .claude/ .trae/` 由 `sync` 按 `WORKFLOW_OVERVIEW.md` §2.4 固定映射同步；镜像不是第二套规则（workflow-spec.md §2）。
- skill 双层：`skills-longform/*.md` 是内容源，`skills/<skill>/SKILL.md` 是打包层；长文源优先（workflow-spec.md §2.1）。

### 2.3 创作生命周期（研究模式全链）

Step 0 前期研究（SRC-xxxx 来源卡）→ Step 1 策划 → Step 2 设定（@角色名三视图 / @场景名场景图）→ Step 3 分镜（镜头组-001/，1 镜 = 15 秒 = 1-4 分镜）→ Step 4 图片提示词（镜头-001-关键帧-01.md，三区块合同）→ Step 5 视频提示词（五区块合同、Seedance 2.0 全能参考、无配乐无字幕）→ Step 6 生产清单（执行计划系统）→ Step 7 发布物料。剧本模式可关闭 Step 0（project.config.yaml `workflow.research_step.enabled: false`）。

关键合同出处：

- 步骤职责与继承链：`packs/official-ai-video/workflow/workflow-spec.md` §3-§5
- 分镜/关键帧粒度：workflow-spec.md §3.1（镜头组/镜头/分镜/关键帧定义）
- Step 5 Seedance 合同：workflow-spec.md §3.2
- Step 4 三区块：workflow-spec.md §5
- 硬门槛：`packs/official-ai-video/workflow/quality-gates.md`（含机器✅/人工👤归属说明 §1.3）
- 步骤目录映射：`packs/official-ai-video/workflow/step-map.yaml`

### 2.4 修改回流与审核链路

- 继承链固定（workflow-spec.md §3），下游不得补造与上游冲突的事实，上游错误回上游修。
- 修改已完成步骤默认必须补影响分析并先回报对话（quality-gates.md §1；docs/zh/workflow/impact-analysis.md 提供人工排查流程；CLI `impact` 命令做文本命中辅助）。
- 整体重写流程：docs/zh/workflow/rewrite-handbook.md（clean-view/rebuild-view 只管观看层，源层靠 git 兜底）。
- 受支持偏离：项目级 `deviations.yaml`（docs/zh/workflow/supported-deviations.md），显式登记才被 `verify` 接受。
- 增强流程默认开启：审核与通过机制、影响分析、修复回链、交付总控（packs/official-ai-video/workflow/indexes/capability-index.md）。

### 2.5 验证体系（分层）

| 层 | 手段 | 出处 |
| --- | --- | --- |
| 单元/集成测试 | `pnpm test`（apps/cli/tests/*.test.ts，vitest） | package.json、docs/zh/contributors/testing.md |
| 官方示例验证 | `pnpm example:verify`（sync + verify 官方示例） | package.json |
| 文档站构建 | `pnpm docs:build`（VitePress，含死链检查） | package.json |
| 全量门禁 | `pnpm verify:v0.2` = build + test + example:verify | package.json |
| Obsidian 投影 | example:obsidian / :ui / :in-project | package.json |
| MCP 只读上下文 | example:mcp-context | package.json |
| 结构校验 | `verify [--step N] [--strict]`、`doctor`、`deviation` | apps/cli/src/index.ts、docs/zh/quickstart/verify-and-iterate.md |
| 隔离端到端测试 | 机器全局 skill `avw-isolated-e2e-testing`（主对话编排 + 隔离子代理 + 裸仓库镜像） | AGENTS.md Testing 章节、FIX_PLAN.md |
| CI | .github/workflows/ci.yml（verify:v0.2 + LibTV mock 测试） | .github/workflows/ci.yml |

约束：涉及 `apps/cli/dist` 的命令必须串行执行（testing.md）；`verify` 通过 ≠ 内容达标（quality-gates.md §1.3）；隔离测试不得消耗生成额度、子代理任务书不得包含参考项目信息（AGENTS.md）。

### 2.6 平台与产物边界

- 支持的图片/视频平台清单：README.md "v0.2 Verification"（openai、gpt-image-2、veo、runway、luma、minimax、seedance、midjourney）。
- LibTV adapter 只做素材执行（上传/引用/生成/下载），不设计故事和分镜；`.libtv/`、`outputs/` 是 gitignored 本地执行面；关键帧须 `libtv approve` 人工通过后才执行视频生成（docs/zh/contributors/adapter-boundaries.md "LibTV 素材 Adapter"）。
- Obsidian：只打开生成观看层 `_views/obsidian/`，不是项目根；观看层不是事实源（README.md "Obsidian Vault Projection"）。
- 生成产物/本地表面（.gitignore）：`_views/`、`.obsidian/`、`.libtv/`、`outputs/`、`SOUL.md`、`USER.md`、`memory/`、`dist/`、`tmp/`、`.tmp/`、`docs/.vitepress/` 缓存等。

### 2.7 用户确认点（Agent 必须停下询问）

1. 消耗生成额度的任何操作（图片/视频生成、LibTV 真实执行）——AGENTS.md Testing 第 8 条。
2. 破坏性操作：`export-obsidian --force`、`clean-view` 非 dry-run、删除文件、重置工作区。
3. 登记偏离（deviations.yaml）改变校验语义前；放宽 Step 5 单镜默认（需显式授权，quality-gates.md §5.1）。
4. 修改已完成步骤的内容（先做影响分析并回报，等确认再动）。
5. 修复方向选择：模板/文档服从校验器合同（FIX_PLAN.md 修复原则），反向调整需用户确认。

### 2.8 新 Agent 最易误判的点（勘察归纳）

1. 把工具仓库当创作项目，在仓库根建 Step 目录或跑 init。
2. 以为 `.codex/` 等镜像是规则来源，直接改镜像不同步母包（或反之）。
3. `verify` 通过就当作内容达标（忽视人工门槛）。
4. Step 3 刚完成、Step 4 未建时，把全量 verify 的 `invalid-keyframe-mapping` 误判为错误（应使用 `--step 3`，verify-and-iterate.md）。
5. 修改下游文件来"绕过"上游错误，而不是回上游修。
6. 对外交付层使用项目内部代号、写"同上/参考前文"式偷继承。
7. 把阶段性统计数字或项目专属编号写进母包规则。
8. VitePress 死链：docs 内文件用 Markdown 链接指向 docs 外部（如 ../../packs/...）会导致 `pnpm docs:build` 失败（本计划 §9 已实证）。
9. 新建 `docs/plans/*.md` 不会入库（.gitignore 第 17 行忽略，仅 22 份历史文件已被跟踪）。

## 3. 上下文工程分层架构

六层结构，全部位于 `docs/context-engineering/`（docs 内、VitePress 可达但非用户侧边栏内容；与面向用户的 docs/zh、docs/en 分开）：

| 层 | 文件 | 职责 |
| --- | --- | --- |
| L0 索引 | README.md | 入口、阅读顺序、文件清单、维护规则 |
| L1 项目上下文 | 00-project-context.md | 项目身份、双仓模型、生命周期、修改边界、确认点 |
| L1 加载顺序 | 01-context-loading-order.md | 按任务/角色给出读取顺序与深浅 |
| L2 工作流地图 | 02-workflow-map.md | Step 0-7 全景：输入/产出/审核/回流一览表 + 链路图 |
| L2 分步契约 | 03-step-contracts.md | 每步详细契约（10 项要素） |
| L2 任务路由 | 05-task-routing.md | 任务类型 → 应读文档 → 可改文件 → 必须验证 |
| L3 领域术语 | 04-domain-glossary.md | AVW 特有概念表（只收实际存在的概念） |
| L4 验证门禁 | 06-verification-gates.md | 变更类型 → 验证矩阵 + 测试方法论（含隔离 E2E） |
| L4 决策与缺口 | 07-decisions-and-open-questions.md | 决策记录、上下文缺口、待确认事项 |
| L5 可迁移层 | 08-portability-guide.md | 通用/专用/临时/待确认标注体系 + 最小迁移骨架 |
| L5 模板 | templates/*.md × 5 | 任务简报、来源卡、审核记录、变更请求、隔离测试报告 |
| 计划 | implementation-plan-2026-08-23.md | 本文件 |

规则分层去重原则：**规范正文只有一个权威出处**（pack 或 CLI），上下文工程文档只做"地图 + 路由 + 边界说明 + 相对路径指针"，引用而不复制。若上下文工程文档与 pack 规范冲突，以 pack 规范为准（在 README.md 声明）。

## 4. 计划新增或修改的文件

### 新增（13 个，全部在 docs/context-engineering/ 下）

| 文件 | 内容要点 |
| --- | --- |
| README.md | 索引 + 三分钟上手路径 + 阅读顺序 + 与权威规范的关系声明 + 维护规则 |
| 00-project-context.md | §2.1/2.2/2.6/2.7 的展开：身份、范围、双仓模型、目录速览、生成产物与本地表面、修改边界、必须确认的操作 |
| 01-context-loading-order.md | 按任务类型（母包维护/CLI 开发/文档/测试/创作项目支持）给出加载顺序，含"何时必须读专项文档、何时必须停下确认" |
| 02-workflow-map.md | Step 0-7 每步一行式总表（目标/输入/产出/审核点/验证）+ 继承链 + 修改传播表（引用 workflow-system-map.md 与 impact-analysis.md，不复制） |
| 03-step-contracts.md | Step 0-7 每步 10 要素：目标/上游输入/允许读取/产出文件/结构约束/审核点/回流方式/下游依赖/验证命令/常见失败与禁改项（正文压缩为指针 + 关键约束摘录） |
| 04-domain-glossary.md | 术语：Step/研究模式/剧本模式、镜头组/镜头/分镜/关键帧、@三视图/@场景图/锚点、SRC-xxxx/来源卡、平台执行设置、deviations、事实源/运行镜像/观看层、增強流程、影响分析、LibTV 执行面等 |
| 05-task-routing.md | ≥12 类任务路由表（新项目初始化、从构想开始、从研究资料开始、剧本修改、分镜修改、关键帧/参考图、视频提示词、平台执行参数、审核回流、测试/隔离复测、文档维护、缺陷诊断、母包维护、镜像同步） |
| 06-verification-gates.md | 变更类型 × 验证矩阵；命令清单与串行约束；"verify≠内容达标"边界；隔离 E2E 方法论摘要（对齐 avw-isolated-e2e-testing skill 与 AGENTS.md，含红线、目录命名、报告模板指针）；不可执行验证的如实标注要求 |
| 07-decisions-and-open-questions.md | 本轮决策记录（含链接规范、计划文档位置）+ 勘察发现的缺口登记（repo-architecture 双语存根、docs/plans gitignore、workflow-system-map 叙事停留在六步、版本叙事漂移等） |
| 08-portability-guide.md | 标注体系说明 + 可迁移最小骨架（六层结构 + 根规则瘦身原则 + 验证门禁思路）+ 不建议迁移清单 |
| templates/project-brief.md | 任务/项目简报模板（用于在工具仓库启动一项工作包） |
| templates/research-source-card.md | 研究来源卡模板（对齐 SRC-xxxx 口径，用于影响工具决策的研究材料） |
| templates/step-review-record.md | 步骤审核记录模板（对齐 R2 审核链路字段：意见原文/处理/理由/修改文件） |
| templates/change-request.md | 变更请求模板（对齐影响分析流程：改动面/继承链影响/校验计划/回报要求） |
| templates/isolated-test-report.md | 隔离测试报告模板（对齐 avw skill REPORT.md 结构） |
| implementation-plan-2026-08-23.md | 本计划（已先行创建） |

### 修改（4 个）

| 文件 | 改动 |
| --- | --- |
| AGENTS.md（根） | 新增一节"项目上下文工程"：入口指针、加载顺序、路由入口、必须停下的确认点；保留既有全部内容不删改 |
| CLAUDE.md（根） | 在开头加一行指向 docs/context-engineering/README.md；保留 Testing 章节原样 |
| docs/zh/contributors/repo-architecture.md | 从 3 行存根扩为：一句话架构 + 指向上下文工程文档与 workflow-system-map 的链接（不复制正文） |
| docs/en/contributors/repo-architecture.md | 同上的英文版 |

## 5. 每个文件的具体内容

见 §4 表格"内容要点"列。实施时遵循统一写作规范：

1. 简体中文；每个重要规则可追溯到真实文件（相对路径 + 必要时节号）。
2. 链接规范（实证得出）：**docs/ 内部目标用 Markdown 相对链接；指向 docs/ 外部（packs/、apps/、根文件等）一律用反引号包裹的相对路径文本，不用 Markdown 链接**（否则 `pnpm docs:build` 死链失败）。
3. 规则标注：重要规则行尾标注 `[通用规则]` / `[AVW 专用]` / `[临时决策]` / `[待确认]` 四类之一（08-portability-guide.md 汇总）。
4. 不复制 pack 规范正文；引用格式统一为"路径 + 节号"。
5. 模板文件保持轻量、可直接复制填写。

## 6. 如何处理已有 AGENTS.md / 类似规则文件

- 根 `AGENTS.md`：是全 Agent 稳定规则层，现有内容（默认 pack、Step3/4 对齐、Step4 合同、增强流程、相对链接、Testing 编排）全部保留；只**追加**上下文工程入口节，使根文件保持"短而稳定"。
- 根 `CLAUDE.md`：与 AGENTS.md 平行的入口，只加指针不复制正文。
- `WORKFLOW_OVERVIEW.md`、`FIX_PLAN.md`、`README*.md`：不改动（在允许范围外），作为被索引对象。
- 项目级 `AGENTS.md`（examples/官方示例-云上早市/AGENTS.md 等）：属于生成产物表面，不改动。

## 7. 如何避免规则重复和互相冲突

1. 单一权威出处：工作流规则以 workflow-spec.md/quality-gates.md 为准，上下文工程文档只做地图与路由；README.md 顶部声明冲突时的优先级（workflow-spec > quality-gates > 上下文工程文档）。
2. 交叉引用代替复制：02/03 文档大量链接 docs/zh/workflow/step-*.md 既有分步文档，不重写其内容。
3. 新增内容与既有文档的分工：workflow-system-map.md 面向"想理解系统的人"，context-engineering 面向"要动手干活的 Agent"（路由 + 门禁 + 边界），在 README.md 写明这一分工。

## 8. 如何区分稳定知识与临时决策

- 稳定知识：指向 pack 规范、CLI 实际行为、CI 实际命令的内容——变更需跟随上游同步。
- 临时决策：本轮做出的工程选择（如计划文档放 context-engineering 而非 plans、链接规范），登记在 07-decisions-and-open-questions.md 并标 `[临时决策]`。
- 待确认：勘察发现的疑似不一致（§11），标 `[待确认]`，不由 Agent 擅自修改。

## 9. 测试与验证命令

实施完成后执行（全部不消耗生成额度）：

1. `pnpm docs:build` —— 验证新增 Markdown 可构建、无死链（已实证：外部链接会导致失败，故采用 §5.2 链接规范）。
2. `pnpm test` —— 既有 CLI 测试套件（验证未破坏任何行为；dist 相关命令串行执行）。
3. `pnpm example:verify` —— 官方示例 sync + verify。
4. 隔离复测（AGENTS.md Testing 要求的最小一项）：在 `G:\develop-G\tests\` 下新建本轮测试目录；用 git 临时快照提交（`git add -A` → `git write-tree` → `git commit-tree`，不移动 HEAD、不污染分支）构造裸仓库镜像，模拟"已发布远端"；从镜像克隆出隔离副本，执行文档类复测项：确认 context-engineering 文档存在可读、AGENTS.md 能找到入口、抽样相对路径引用真实存在。全程不使用本地工作树作为源，不接触参考素材。
5. `git diff --check`、`git status --short` —— 确认无计划外修改、无临时文件残留。
6. 无法执行的验证如实标注（如完整隔离 E2E 创作循环不在本轮运行，理由：本轮为纯文档变更，且完整循环耗时长；方法论已在 06 文档中沉淀）。

## 10. 提交切片建议

1. 切片一：docs/context-engineering/ 全部新增文档 + templates/（一次性或按 L0-L5 分两个提交）。
2. 切片二：AGENTS.md、CLAUDE.md 根级入口追加。
3. 切片三：docs/{zh,en}/contributors/repo-architecture.md 存根补链。
（是否提交、何时提交由用户决定；本轮不主动 commit。）

## 11. 风险、假设和待确认事项

### 上下文缺口（勘察发现，登记不顺手修改）

1. `[待确认]` docs/zh 与 docs/en 的 contributors/repo-architecture.md 仅 3 行存根，与仓库实际丰富架构不符（本轮按允许范围补为"存根 + 链接"）。
2. `[待确认]` .gitignore 第 17 行忽略 `docs/plans/*.md`：新建计划文档不会入库，但 22 份历史计划已被跟踪——"计划文档是否应入库"需要用户决策（本轮计划文档因此改放 docs/context-engineering/）。
3. `[待确认]` docs/zh/contributors/workflow-system-map.md 多处仍按"六步流程/Step 1-6"叙事（如 §用户使用过程、§六步产物关系），而现行 pack 是 Step 0-7 八步；其文首已声明"不替代正式规范"，故未修改，仅登记。
4. `[待确认]` 版本叙事漂移：package.json 为 0.1.0，README 叙事 v0.2，docs 出现 v0.3-v0.7——onboarding-initialization-notes.md 已记录为 P1 问题，本轮不处理。
5. `[待确认]` 根 AGENTS.md 的 Testing 章节要求测试时"准备一个本地裸镜像链接模拟已发布远程"；本轮采用 git 快照提交方式实现同等语义，属于对 skill 方法的具体实现选择。

### 风险与假设

1. 假设 VitePress 对 docs/ 内 md 一律纳入构建（已实证：临时外部链接文件触发死链报错后清理，无残留）。
2. 风险：上下文工程文档与 pack 规范未来漂移——通过 §7 的单一出处原则与 07 文档的维护提醒缓解。
3. 风险：文档数量多导致维护成本——README.md 提供最小阅读集（3 分钟路径），其余按需加载。
4. 假设：本轮不改任何被 CI 覆盖的代码，`pnpm test` 应保持全绿；若失败需回查是否为环境性偶发（FIX_PLAN.md F13 曾记录偶发进程崩溃）。

## 12. 验收清单

- [x] 新增文件全部存在、可读、无互相重复正文。
- [x] 根 AGENTS.md 能在 3 跳内找到 context-engineering 入口。
- [x] 每个 Step（0-7）都有输入/输出/审核点/验证说明（03 文档）。
- [x] 任务路由表覆盖 §4 所列 ≥12 类任务。
- [x] 通用/专用/临时/待确认四类标注清晰（08 文档 + 行内标注）。
- [x] `pnpm docs:build` 通过。
- [x] `pnpm test` 通过（29 套件 / 323 用例全绿）。
- [x] `pnpm example:verify` 通过。
- [x] 隔离复测（文档类）完成并留痕（`G:\develop-G\tests\avw-retest-context-engineering-20260823\REPORT.md`，45 项检查通过）。
- [x] `git diff --check` 干净；`git status --short` 仅含计划内文件。

## 计划自检

- 覆盖完整工作流？是——Step 0-7 全部入 02/03。
- 遗漏 Step 5 平台执行与提示词契约？否——03 文档含 Step 5 五区块、Seedance 合同、平台差异门槛指针。
- 遗漏 Step 0 研究优先路径？否——Step 0 为研究模式默认起点，05 路由含"从研究资料开始"。
- 审核修改链路明确？是——02 修改传播表 + 03 各步回流 + 05"审核意见回流"路由 + templates/change-request。
- 隔离测试边界明确？是——06 文档专节 + templates/isolated-test-report + §9 本轮复测方案。
- 项目特例误写为通用规则？否——四类标注 + 08 文档区分。
- 根规则文件过长？否——AGENTS.md 只追加一节入口，正文仍在 docs。
- 新 Agent 几分钟内找到入口？是——README 3 分钟路径 + 05 路由表。
