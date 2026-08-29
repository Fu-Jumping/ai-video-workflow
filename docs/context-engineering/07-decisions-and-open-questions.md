# 07 决策记录与待确认事项

本文件登记上下文工程层的**工程决策**与勘察发现的**上下文缺口**。业务规则变更不在此登记（那属于 pack 规范与 `docs/plans/` 计划体系）。标注含义见 [08-portability-guide.md](./08-portability-guide.md)。

## 1. 决策记录

### D1 计划文档放置位置 `[临时决策]` 2026-08-23

新建 `docs/plans/*.md` 被 `.gitignore` 第 17 行忽略（仅 22 份历史计划已被跟踪），放那里无法入库。本轮实施计划因此放 `docs/context-engineering/implementation-plan-2026-08-23.md`。入库策略已由用户裁定，见 D6。

### D2 docs 外部引用不用 Markdown 链接 `[临时决策]` 2026-08-23

实证：docs/ 内 md 文件用 Markdown 链接指向 docs/ 外部（如 `../../packs/...`）时，`pnpm docs:build` 报 dead link 并失败。决策：docs 内目标用 Markdown 相对链接；docs 外目标用反引号包裹的**仓库根相对路径**文本。若未来 VitePress 配置 srcExclude 或 ignoreDeadLinks，可复审。

### D3 上下文工程与权威规范的优先级 `[临时决策]` 2026-08-23

冲突解释顺序：workflow-spec.md > quality-gates.md > skills-longform > 本目录 > docs/zh|en 站点文档。本目录不做第二份规范。

### D4 根级 AGENTS.md 只追加入口节 `[临时决策]` 2026-08-23

根 `AGENTS.md` 保持"短而稳定"：既有内容（默认 pack、Step3/4 对齐、Step4 合同、增强流程、相对链接、Testing 编排）全部保留，只追加上下文工程入口节（阅读顺序、路由入口、停止确认点）。详细知识全部下沉到本目录。

### D5 仓库架构存根补链 `[临时决策]` 2026-08-23

`docs/zh|en/contributors/repo-architecture.md` 原为 3 行存根。按最小改动补为"一句话架构 + 指向本目录与 workflow-system-map 的链接"，不复制正文（与其余 5 行存根文档保持轻量一致）。

### D6 文档跟踪策略（用户裁定） `[通用规则]` 2026-08-23

用户明确裁定：**上下文工程相关的 AI 文档（docs/context-engineering/ 全部、AGENTS.md、CLAUDE.md 及为其补链的 docs 页面）全部纳入 git 跟踪；本地开发计划文档（docs/plans/ 下新增文件）永远不跟踪**。执行含义：docs/context-engineering/ 不得加入 .gitignore；后续新增 AI 文档一律入库；docs/plans/*.md 维持忽略现状，历史已跟踪的 22 份不追溯移除。原 Q1 待确认事项据此关闭。

### D7 版本叙事口径 `[临时决策]` 2026-08-23

双语 README "Current Status/当前状态" 节新增版本口径说明：`package.json` 包版本（0.1.0）与文档中 v0.2~v0.7 为两套编号，后者是内部功能批次/计划文档编号，不是对外发布版本。不追改历史批次编号，后续新功能批次继续沿用计划文档编号并避免抬高对外版本叙事。原 Q4 据此关闭。

### D8 隔离复测"已发布模拟"标准序列 `[临时决策]` 2026-08-23

将 2026-08-23 首次使用的 git 快照 + 裸镜像方法固化为标准命令序列，写入 [06-verification-gates.md](./06-verification-gates.md) §4.4（快照提交不移动 HEAD、测试方只接触克隆）。暂不产品化为仓库脚本；若复用频次上升再考虑固化为命令。原 Q5 据此关闭。

### D9 双语对齐策略 `[临时决策]` 2026-08-23

用户侧工作流手册补齐英文版：en/workflow/impact-analysis.md、rewrite-handbook.md、supported-deviations.md 与 en/quickstart/verify-and-iterate.md（翻译自中文正典），并加入双语侧边栏（中文侧同步补齐手册入口）。`docs/zh/contributors/workflow-system-map.md` 与 `onboarding-initialization-notes.md` 声明为**中文正典**（前者配 SVG 为中文、后者为审计记录），暂不做英文版；需要时再立项。原 Q6 据此关闭。

## 2. 待确认事项（上下文缺口，未擅自修改）

> 2026-08-23 第二轮：Q2-Q8 已全部处理关闭（处理方式见各条"关闭"说明与 D7-D9）。2026-08-28 防呆专项：Q10-Q13 已修复关闭（分支 `fix/foolproof-guards-20260828`，修复计划见 `FIX_PLAN.md` H1-H6，复测证据见该轮修复对话记录）。以下条目保留为历史记录；新缺口按 §3 规则新增编号。

### Q1 ~~计划文档入库策略~~ → 已关闭

用户于 2026-08-23 裁定：上下文工程 AI 文档全部跟踪，本地开发计划文档永不跟踪。见 D6。

### Q2 ~~workflow-system-map 叙事停留在"六步"~~ → 已关闭

2026-08-23 已将 docs/zh/contributors/workflow-system-map.md 全文更新为 Step 0-7 八步叙事（分层说明、使用过程、产物关系表补 Step 0/Step 7 行、开发方向）；SVG 图片仍为六步时期绘制，已在图下加注说明并以 workflow/overview.md 为准。

### Q3 ~~repo-architecture 系列存根~~ → 已关闭

维持"一句话架构 + 链接"的轻量存根形态：完整架构说明由本目录 00-project-context.md 与 workflow-system-map.md 承担，重复撰写完整版违反单一出处原则。双语存根已补链（D5）。

### Q4 ~~版本叙事漂移~~ → 已关闭

处理方式见 D7：双语 README 增加版本口径说明，不追改历史批次编号。

### Q5 ~~隔离复测的"已发布模拟"实现~~ → 已关闭

处理方式见 D8：标准命令序列固化于 06-verification-gates.md §4.4。

### Q6 ~~zh 独有文档无英文对应~~ → 已关闭

处理方式见 D9：四个用户侧手册补英文版并入双语侧边栏；workflow-system-map 与 onboarding-initialization-notes 声明为中文正典。

### Q7 ~~pack 规范滞后于 gpt-image-2 校验实现~~ → 已关闭

2026-08-23 已同步 pack 规范：workflow-spec.md §5/§7 增补 gpt-image-2 平台差异条目；quality-gates.md §1.3/§4.6 补 gpt-image-2 门槛（含三个 verify 错误码与机器✅归属）；skills-longform/film-image-prompter.md 与 skills/film-image-prompter/SKILL.md 增补 GPT Image 2 平台适配节；workflow/indexes/skill-index.md 平台差异行更新（该项随 sync 镜像进示例项目）。

### Q8 ~~LibTV adapter 文档未覆盖审阅/精修流程~~ → 已关闭

2026-08-23 已补齐：libtv-asset-adapter.md（zh/en）新增"审阅与两阶段精修"节、命令清单补 review/refine、内置映射补 gpt-image-2 -> lib-image-2；adapter-boundaries.md（zh/en）LibTV 节补精修范围、`--allow-generation` 硬闸与主链规则，并修正陈旧的"边序搁置"口径（实为已实现 verify-order 合同）；双语 README LibTV 节补命令示例与流程摘要；mcp-adapter.md 修正步骤范围（Step 0-7）、资源清单补 step/7、目的清单补精修状态、修改边界与禁止写入补 Step 7。

### Q9 LibTV apply 缺少 `--allow-generation` 生成硬闸 `[已处理]` 2026-08-23

- 现象：`ai-video-workflow libtv apply` 目前没有 `--allow-generation` 选项；`applyPlan` 在非 `--dry-run` 时直接以 `backend.createNode({ run: true })` 创建关键帧/视频节点，`HttpLibTvBackend.createNode` 随即调用真实生成 API 并轮询。
- 证据：`apps/cli/src/lib/libtv/register.ts`（apply 子命令定义）、`apps/cli/src/lib/libtv/apply.ts`（run: true）、`apps/cli/src/lib/libtv/http-backend.ts`（`runNode`）。
- 影响：与 `00-project-context.md` §6、仓库根 `AGENTS.md`、`2026-08-22-post-libtv-development-roadmap.md` §4 的安全边界“任何生成必须显式 `--allow-generation`，默认 dry-run”不一致；用户仅运行 `libtv apply --only keyframes` 就可能消耗真实生成额度。
- 处置：本轮实施计划已把该硬闸列为必改项；当前任务分支已实现 `apply --allow-generation` 默认不生成，并补充 mock 测试；待全量验证通过后关闭。

### Q10 ~~`libtv project delete` 无二次确认（`--yes` 为占位）~~ → 已处理 2026-08-28

- 现象：`libtv project delete <uuid>` 一行即执行远端画布项目删除，无任何确认层；帮助文案 `-y, --yes` 自述"跳过二次确认（占位）"，确认机制从未实现，带不带 `-y` 行为相同。本轮防呆专项在 `--mock` 下验证（未触真实删除）。
- 证据：`apps/cli/src/lib/libtv/register.ts`（delete 子命令定义，action 直接调用 `backend.deleteProject`，无确认逻辑）；行为验证见 `G:\develop-G\tests\avw-foolproof-20260828\REPORT.md` D6。
- 影响：与"破坏性操作必须先经用户确认"的安全边界不一致；`-y` 名义存在会让用户误以为有确认层。本轮测试定级：严重。
- 处置：已修复（commit 623e5a6，分支 `fix/foolproof-guards-20260828`；修复计划 FIX_PLAN.md H1）。非交互无 `--yes` 一律拒绝（单行错误、exit 1）；TTY 走 inquirer confirm（默认 false），拒绝干净退出；`--yes` 直接执行；帮助文案移除"占位"字样。回归测试 `libtv-cli.test.ts`（--mock 三条路径）+ 手工复测 D6（拒绝/放行两路径）；`pnpm verify:v0.2` 全绿。

### Q11 ~~`libtv node/group create --run` 无 `--allow-generation` 生成闸~~ → 已处理 2026-08-28

- 现象：`libtv node create -r`（"创建成功后触发生成一次"）与 `libtv group create -r`（"创建成功后整组生成一次"）没有任何生成开关或门禁提示；对照 apply 与 refine 均有显式 `--allow-generation` 硬闸。mock 下创建后无门禁提示且 mock 状态不持久，真实模式行为不可行为学验证；源码层面 `-r` 直通无检查。
- 证据：`apps/cli/src/lib/libtv/register.ts`（node create / group create 的 `-r, --run` 选项，action 无 allowGeneration 检查；对照 apply 约 :892-908、refine 约 :1015-1024）；行为验证见 REPORT.md D5（行为存疑：结构缺闸成立，真实模式不可证）。
- 影响：与"任何消耗生成额度的操作必须显式开关/确认"的安全边界不一致；真实模式下一行 `node create ... -r` 即可能直接消耗额度。本轮测试定级：提示（存疑）。
- 处置：已修复（commit 87fa190，node 默认用法追加纳入见后续提交；FIX_PLAN.md H5）。`node create`、`node` 默认用法（`node [node]`）与 `group create` 三处各增加 `--allow-generation`，`-r` 且无开关时在任何后端调用前抛单行错误（与 refine 同型硬闸，`--mock` 下同样拦截）；不带 `-r` 的路径不受影响。实现要点：`node` 父命令与子命令存在同名 `-r/--allow-generation` 选项（commander 父层先消费），闸统一走 `getOption` 祖先冒泡语义。回归测试 `libtv-cli.test.ts`（node create/默认用法/group 各路径）+ 手工复测 D5。

### Q12 ~~`new-pack` 缺"工具仓库本体"守卫~~ → 已处理 2026-08-28

- 现象：在工具仓库 `packs/` 目录内执行 `new-pack --name <x>` 成功创建脚手架（EXIT=0），无任何警告或拒绝；对照 init（嵌套项目拒绝）与 sync（工具仓库本体/源码树拒绝）均有专属守卫。
- 证据：`apps/cli/src/index.ts`（new-pack 命令定义，`targetRoot: process.cwd()` 直接使用、无仓库检查）；行为验证见 REPORT.md G3（记录后已删除产物，克隆现场 `git status` 0 变更还原）。本轮测试定级：一般。
- 影响：易在工具仓库内误建包脚手架；与 init/sync 的防护水平不一致。
- 处置：已修复（commit fa34129；FIX_PLAN.md H3）。复用 `project-root.ts` 的 `isToolRepositoryRoot`/`isSourceSubtree`：工具仓库根一律拒绝；源码子树内默认拒绝，新增显式逃生旗标 `--allow-in-tool-repo`（"在仓库内新增官方 pack"的合法开发流）。回归测试 `new-pack.test.ts`（假仓库根夹具四条路径）+ 手工复测 G3 拒绝路径（`git status` 零残留）；放行路径由回归测试覆盖，未在本仓库真实执行以避免污染工作树。

### Q13 ~~机器全局 LibTV 凭据被裸调用静默使用~~ → 已处理 2026-08-28

- 现象：本机存在 `~/.libtv/credentials.json` 时，任意目录裸调用 libtv 命令静默携带全局真实凭据，无"正在使用账户 X"的调用级提示；以 `LIBTV_TOKEN 为空` 判断"无凭据"不成立（环境变量与文件凭据是两条独立通道）。测试实测：裸 `libtv project list` 静默返回（EXIT=0）；裸 `libtv workspace list` 实际发起真实只读 API 请求后返回"用户未授权"（凭据疑似过期）。全程仅只读调用，零额度消耗。
- 证据：`apps/cli/src/lib/libtv/credentials.ts`（凭据解析作用域为机器全局）；行为验证见 REPORT.md D1（2026-08-28 发现本机 `~/.libtv/credentials.json`，生成于 2026-08-23；子代理发现后全程改用 `--mock` 与假 HOME，未读取/未修改该凭据文件）。本轮测试定级：一般（环境因素放大）。
- 影响：共享机器/自动化场景下放大误操作面；测试与审计时"无凭据"判据易失效。
- 处置：已按最小方案（可见性，不做闸门）修复（commit b431cfa；FIX_PLAN.md H2）。`backendWithCredentials` 在创建 HTTP 后端前向 stderr 打印一行凭据来源提示（环境变量 `LIBTV_TOKEN` 或凭据文件路径 + 脱敏账户标识），每命令最多一次；`--mock` 与无凭据路径行为不变；`00-project-context.md` §6 已补说明。回归测试 `libtv-credentials.test.ts`（假凭据目录 + 三个 API base URL 指向本机不可达端口，验证提示先于网络错误、env 通道、--mock 无提示）+ 手工复测 D1。

## 3. 缺口登记规则 `[通用规则]`

发现"规则与实际代码/文档不一致"时：在本文件追加 Q 编号条目（现象 + 证据路径 + 影响），并在对话中报告；**不擅自修改业务行为**；修复需用户确认后按 [05-task-routing.md](./05-task-routing.md) 对应路由执行。
