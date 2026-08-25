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

> 2026-08-23 第二轮：Q2-Q8 已全部处理关闭（处理方式见各条"关闭"说明与 D7-D9）。以下条目保留为历史记录；新缺口按 §3 规则新增编号。

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

## 3. 缺口登记规则 `[通用规则]`

发现"规则与实际代码/文档不一致"时：在本文件追加 Q 编号条目（现象 + 证据路径 + 影响），并在对话中报告；**不擅自修改业务行为**；修复需用户确认后按 [05-task-routing.md](./05-task-routing.md) 对应路由执行。
