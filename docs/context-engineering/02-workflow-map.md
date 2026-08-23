# 02 工作流地图

创作项目的完整生命周期。职责正文以 `packs/official-ai-video/workflow/workflow-spec.md` §3-§5 为准；面向人类的系统级讲解见 `docs/zh/contributors/workflow-system-map.md`；分步用户文档见 [../zh/workflow/overview.md](../zh/workflow/overview.md)。

## 1. 两种模式 `[AVW 专用]`

- **研究模式（默认）**：Step 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7。真实题材/原型类项目从 Step 0 起步。
- **剧本模式**：已有完整剧本时，`init --start-from script` 或关闭 `workflow.research_step.enabled`，从 Step 1 开始（workflow-spec.md §3）。

## 2. 步骤总表

| Step | 名称 | 目录 | 上游输入 | 正式产出 | 关键审核点 |
| --- | --- | --- | --- | --- | --- |
| 0 | 前期研究 | `00_前期研究/` | 真实题材、新闻、采访、历史资料、评论样本、视觉依据 | 研究总览、资料索引、摘录卡片、主题归纳、创作简报 | 关键现实事实必须带 `SRC-xxxx` 来源 ID；事实/推断/改编三分 |
| 1 | 策划 | `01_概念策划/` | 用户意图 + （启用时）Step 0 创作简报 | 故事内核、原始剧本、约束条件 | 不越级写设定/分镜/提示词 |
| 2 | 设定 | `02_世界设定/` | Step 1 | 角色设定、场景设定（可复用视觉母本） | 主角色声明 `@角色名三视图`；特殊场景声明 `@场景名场景图`；不拆镜头不写最终 prompt |
| 3 | 分镜 | `03_分镜脚本/` | Step 1 + Step 2 | 镜头组说明、分镜卡（含帧级映射、参考资产要求） | 主描述立足可见事实；已拆帧镜头写帧级状态映射 |
| 4 | 图片提示词 | `04_图片提示词/` | Step 2 + Step 3 | `镜头-NNN-关键帧-NN.md`（三区块合同） | 纯画面事实、单画面稳定状态、自足可生图 |
| 5 | 视频提示词 | `05_视频提示词/` | Step 3 + Step 4（必要时回读 Step 2） | `镜头-NNN.md`（五区块合同） | 消费 Step 4 可复制提示词；单镜 ≤15 秒；显式"无配乐、无字幕" |
| 6 | 生产清单 | `06_执行计划/` | 已启用上游步骤的正式完成态 | 执行计划、图片执行单、视频执行单（+可选协同单） | 执行项可追溯 Step 3/4/5；不偷改上游正文 |
| 7 | 发布物料 | `07_发布物料/` | Step 1 + Step 3（只读消费） | 发布总表、标题、简介正文、话题标签、封面文案 | 不编造成片不存在的卖点；不宣传未锁版镜头 |

每步的详细契约（允许读取范围、回流方式、验证命令、失败模式、禁改项）见 [03-step-contracts.md](./03-step-contracts.md)。

## 3. 继承链 `[AVW 专用]`

固定链条（workflow-spec.md §3）：

```text
Step 0 (SRC 来源卡) → Step 1 故事内核 → Step 2 角色/场景设定 → Step 3 分镜
→ Step 4 图片提示词 → Step 5 视频提示词 → Step 6 执行计划
Step 7 ← Step 1 + Step 3（只读）
```

- Step 1 的资产清单（角色/场景/结构锚点/色彩纪律/防混淆判据）是下游"总开关"。
- Step 2 的 `@三视图` / `@场景图` 是 Step 3→4→5 的继承令牌。
- Step 3 镜头卡链接的 Step 4 关键帧是"下游已选事实"，Step 5 必须继续消费。
- **下游不得补造与上游冲突的新事实；上游错误回上游修。**

## 4. 修改传播（谁改了要查谁）

| 修改位置 | 默认影响范围 | 典型处理 |
| --- | --- | --- |
| Step 1 | Step 2-6（7 只读消费） | 重查设定、分镜目标、提示词基线、执行清单 |
| Step 2 | Step 3-6 | 重查角色/场景/锚点、画面连续性 |
| Step 3 | Step 4-6 | 重查关键帧、视频动作链、执行映射 |
| Step 4 | Step 5-6 | 重查视频提示词、图片执行单 |
| Step 5 | Step 6 | 重查视频执行单、阻塞与放行状态 |
| Step 6 | 通常不反写上游 | 只更新执行状态；创作问题回报上游 |

规则：修改已完成步骤默认必须补影响分析，并先把检查结果回报对话（quality-gates.md §1）。结构层由 `verify` 机器检查；语义层（人物取舍、色彩纪律、动作指纹、视线落点、时长一致性、母题口径）按 `docs/zh/workflow/impact-analysis.md` 人工排查；`impact` CLI 命令提供文本命中辅助。

## 5. 审核闭环 `[AVW 专用]`

- 增强流程默认开启：审核与通过机制、影响分析与变更传播、修复与回链、交付总控（`packs/official-ai-video/workflow/indexes/capability-index.md`）。只有项目显式关闭增强流程才可不按其执行。
- 审核两类：人审（叙事、画面、可执行性）+ 工具审（`verify` / `doctor`，结构、合同、链接、镜像同步）。
- 审核记录字段建议：意见原文 / 处理 / 理由 / 修改文件（见 [templates/step-review-record.md](./templates/step-review-record.md)）。

## 6. 偏离与例外 `[AVW 专用]`

真实项目确需不走标准流程时，用项目级 `deviations.yaml` 显式登记（`docs/zh/workflow/supported-deviations.md`）：mode（standard/scene-basis/minimal-video/hybrid）、逐条 deviations、按镜头 shots。只有登记在案的偏离被 `verify` 接受；未登记的照常失败。禁止静默跳过或手工绕过校验。

## 7. 执行与投放表面（Step 6 之后） `[AVW 专用]`

- LibTV adapter：Step 2 锚点上传、Step 4 关键帧节点、Step 5 视频节点与引用边；关键帧须 `libtv approve` 人工通过后才能执行视频生成；结果写 `.libtv/state.json` 并下载到 `outputs/`。边界见 `docs/zh/contributors/libtv-asset-adapter.md` 与 `docs/zh/contributors/adapter-boundaries.md`。
- **图片审阅与两阶段精修（gpt-image-2 执行链）**：关键帧/锚点首版生成后进入人工审阅——`libtv review <id> --decision direct|refine|regenerate [--feedback]`（直接可用 / 需要精修 / 需要重生成）；决策为 refine 时 `libtv refine <id> --instruction <中文修改指令> [--base first|current]` 基于 GPT Image 2（LibTV 模型 `lib-image-2`）创建精修节点，精修提示词由 CLI 按"只改指定问题点、其余保持不变"模板动态生成；`libtv approve` 通过时 `finalNodeId` 指向最近精修节点（无精修轮则指回首版），关键帧状态置 `final_approved`——精修版由此进入主链，供 Step 5 视频生成引用。`libtv refine` 触发真实生成，CLI 强制显式 `--allow-generation`（对应 [00-project-context.md](./00-project-context.md) §6 额度确认点）。
- **图片节点影响追溯**：`impact --image <node> --project <path>` 从 `.libtv/state.json` 把某个 LibTV 图片节点（首版 / finalNodeId / 任一精修轮节点）反查到对应关键帧/锚点，列出会受影响的 Step 4/5 源文件作为待复核清单（`reviewCandidates`）；关键词模式 `impact <keyword>` 也输出同镜头下游链待复核候选。
- Obsidian 观看层：`export-obsidian`（增量）/ `verify-obsidian` / `clean-view` / `rebuild-view`；只打开 `_views/obsidian/`；仪表盘展示关键帧/锚点的精修轮数与最近精修节点。
- MCP：`mcp-context`（只读 JSON，含关键帧/锚点精修轮数）/ `mcp-server`（单项目 stdio 只读）。
- 这些都是**执行与观看表面**，不反向成为创作事实源。
