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

## 2. 待确认事项（上下文缺口，未擅自修改）

### Q1 ~~计划文档入库策略~~ → 已关闭

用户于 2026-08-23 裁定：上下文工程 AI 文档全部跟踪，本地开发计划文档永不跟踪。见 D6。

### Q2 workflow-system-map 叙事停留在"六步" `[待确认]`

`docs/zh/contributors/workflow-system-map.md` 多处按 Step 1-6 六步叙事（§用户使用过程、§六步产物关系、§适合继续开发的方向），而现行 pack 为 Step 0-7 八步。该文档文首已声明"不替代正式规范"，且其 SVG 资产同步成本较高，故本轮仅登记不改。

### Q3 repo-architecture 系列存根 `[待确认]`

`docs/zh|en/contributors/repo-architecture.md` 长期为 3 行存根（本轮已补链，见 D5）；`docs/en/contributors/repo-architecture.md` 同步补链。是否要写完整版仓库架构文档待定（内容大部分已由本目录 00 + workflow-system-map 覆盖，重复撰写的价值需权衡）。

### Q4 版本叙事漂移 `[待确认]`

package.json `0.1.0`；README 叙事 v0.2；docs 出现 v0.3-v0.7 批次编号。`docs/zh/contributors/onboarding-initialization-notes.md` 已记录为 P1 问题（"文档版本叙事过快且和 package version 不一致"），本轮不处理。

### Q5 隔离复测的"已发布模拟"实现 `[待确认]`

仓库根 `AGENTS.md` 要求测试准备"本地裸镜像链接模拟已发布远程"。本轮采用 git 快照提交（`git add -A` → `git write-tree` → `git commit-tree`，不移动 HEAD）构造裸镜像，为 skill 方法的一种具体实现。若用户偏好固定脚本化该步骤，可后续固化为仓库脚本。

### Q6 zh 独有文档无英文对应 `[待确认]`

`docs/zh/contributors/` 下 onboarding-initialization-notes.md、workflow-system-map.md 与 `docs/zh/workflow/` 下 impact-analysis.md、rewrite-handbook.md、supported-deviations.md 暂无 en 对应页（en/contributors 也缺 release-notes-v0.3 的部分对应关系以 testing.md 对齐为准）。双语对齐策略待定。

### Q7 pack 规范滞后于 gpt-image-2 校验实现 `[待确认]` 2026-08-23

最近提交（732694b、7a0c8d1）为 gpt-image-2 增加了 Step 4 平台参数强制校验（`apps/cli/src/lib/verify.ts` 错误码 `missing-step4-gpt-image-2-platform-setting` / `invalid-step4-gpt-image-2-copyable-language` / `invalid-step4-gpt-image-2-parameter`）并在 Step 4 模板写入 gpt-image-2 参数块与可选 `## 精修配置`；但 `packs/official-ai-video/workflow/quality-gates.md` §4.6 与 `workflow-spec.md` §5/§7 仍写"当前仅 midjourney"。packs/ 超出上下文工程轮次的修改边界，待用户确认后按 B1 路由同步规范正文。

### Q8 LibTV adapter 文档未覆盖审阅/精修流程 `[待确认]` 2026-08-23

最近提交（e9a613e、b6331d3、a25da56、23360c9、055eb56）落地了图片审阅（`libtv review`，direct/refine/regenerate）、两阶段精修（`libtv refine`，GPT Image 2 / `lib-image-2`，强制 `--allow-generation`）、精修版并入主链（`finalNodeId` / `final_approved`）、精修状态进 MCP 与 Obsidian、`impact --image` 节点追溯。但 `docs/zh/contributors/libtv-asset-adapter.md`、`docs/zh/contributors/adapter-boundaries.md`、README "LibTV Asset Execution" 节均未提及上述能力；当前精修语义的权威出处是 CLI 实现、测试（`apps/cli/tests/libtv-refine.test.ts`、`impact.test.ts`）与 Step 4 模板。adapter 文档补写待用户确认后进行。

## 3. 缺口登记规则 `[通用规则]`

发现"规则与实际代码/文档不一致"时：在本文件追加 Q 编号条目（现象 + 证据路径 + 影响），并在对话中报告；**不擅自修改业务行为**；修复需用户确认后按 [05-task-routing.md](./05-task-routing.md) 对应路由执行。
