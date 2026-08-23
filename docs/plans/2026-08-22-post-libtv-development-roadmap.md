# LibTV 落地后的下一步开发计划

- 制定日期：2026-08-22
- 状态：草案（待确认优先级后逐项实施；2026-08-22 已确认 `lib-image-2` = gpt-image-2、新增平台枚举 `gpt-image-2`、两步流程不限于 MJ 首版）
- 基线：master @ `3412352`（已含 LibTV 素材 Adapter 修复、LibTV 路线图更新、`impact` 命令 v1）
- 适用范围：`apps/cli`、官方 pack、文档站、测试基建；不含剧情/分镜设计能力

## 0. 总览与执行顺序

建议按以下顺序推进：

1. 完善 `impact` 影响面命令
2. MCP 增加 LibTV 只读状态
3. 补齐双语文档与路线图
4. LibTV 生成执行链路产品化
5. 两步出图流程专项设计：首版平台（MJ 或 GPT Image 2）+ GPT Image 2 精修（流程级，需谨慎设计）

其中 1、2、3 不触发生成、风险低，可先做。4、5 涉及真实生成与出图流程，而且 **5 会直接影响流程本身**：gpt-image-2 在 LibTV 中的模型身份已确认为 `lib-image-2`；还需先定稿两步执行模式和状态机，再在 4 中写生成执行代码，避免把“单模型单次生成”的路径写死。

红线保持不变：

- Step 文件是唯一创作事实源。
- LibTV 只做素材上传、引用、生成、回传；不做剧情/分镜设计；不实现 `script storyboard`。
- 任何生成都必须显式允许；不做隐式自动生成。
- 素材上传继续回退官方 `libtv` CLI，不改为纯 HTTP 上传。
- 机器检查只做辅助，不代替人工质量判断。

## 1. 完善 impact 影响面命令

当前 v1 已具备：

- 单关键词搜索 Step 0-7 Markdown 文件。
- 同镜头 Step 3 → Step 4/5 下游提示。
- 直接命中 / 待复核候选 / affected shots 输出。

后续增强方向：

- 支持多个关键词：`impact "荆轲" "雨中告别"`。
- 支持 `--json`，供 MCP、脚本和智能体消费。
- 支持 `--step <n>` 或 `--steps 1,3,4,5`，限制扫描范围。
- 支持 `--include-step6`，补上 Step 5 → Step 6 执行计划提示。
- 支持 `--output <file>`，生成 Markdown 影响面报告。
- 支持忽略模板占位、代码块和中文自检区，减少误命中。
- 增加“命中原因”说明（直接文本命中 / 同镜头下游 / Step 2 参考资产 token）。

验收：

- 单元测试覆盖多关键词、步骤过滤、JSON 输出、输出文件。
- 真实项目跑通后，`impact` 输出能被 MCP 只读工具复用。
- 不触发生成、不写任何 Step 源文件。

## 2. MCP 增加 LibTV 只读状态

当前 MCP 是只读上下文 adapter，但还没有暴露 LibTV 执行状态。下一步把以下内容以只读 resources 暴露：

- `.libtv/project.json`：画布绑定关系。
- `.libtv/state.json`：锚点上传、关键帧、视频节点状态。
- `.libtv/order-contracts.json`：Step 5 素材上传顺序合同。
- `libtv status` 与 `libtv verify-order` 的结果摘要。

用途：

- 智能体不开画布也能知道“已上传 / 已生成 / 缺失 / 顺序不一致”。
- 审阅对话可以直接引用执行状态，而不是把状态文件当作创作事实源。
- 为后续 LibTV 生成执行链路提供上下文基础。

边界：

- 只读，不新增任何生成或写工具。
- 不把执行状态冒充为 Step 文件事实源。
- 状态文件不存在、未绑定画布时给出可读提示，不报裸错误。

验收：

- `mcp-context` 或 MCP resources 能输出 LibTV 状态摘要。
- 未绑定画布 / 无状态文件的项目返回稳定、可读的降级结果。
- 不触发生成，不写入项目文件。

## 3. 补齐双语文档与路线图

中文文档目前较完整，英文文档存在缺口，路线图也没有完整反映最新事实。

需要补齐：

- 英文 `impact-analysis` 文档，与中文影响面排查手册对齐。
- 英文 `rewrite-handbook`，与中文重写手册对齐。
- 检查并同步 `docs/en/workflow/` 下缺失或过时的 Step 文档。
- 更新中英文 `roadmap-v0.2`：
  - 标记 LibTV 素材 Adapter 已完成。
  - 标记 `impact` 命令已完成 v1。
  - 把本计划五个方向作为下一阶段路线图。
  - 修正“暂不执行 LibTV 画布自动化”等过时表述。
- 同步 README、`WORKFLOW_OVERVIEW.md` 与贡献者文档中的命令示例。

验收：

- `pnpm docs:build` 通过。
- 中英文导航和链接无断链。
- 路线图能回答“现在已经完成什么、下一步做什么”。

## 4. LibTV 生成执行链路产品化

当前 LibTV adapter 已能完成上传、节点/边引用、顺序校验；生成链路还是下一步。目标是形成安全、可恢复、可观测的执行闭环。

> 依赖说明：本节的生成代码实现应在第 5 节两步出图流程关键决策定稿后进行；本节只先列出能力目标与安全边界。

需要设计：

- 显式生成开关，例如 `--allow-generation`，默认只 dry-run。
- `apply --only keyframes` / `apply --only videos` 的完整执行。
- 关键帧人工审核通过后才允许对应视频生成。
- 生成进度轮询、超时、失败原因汇总。
- 断点恢复：已成功节点不重复生成，失败节点可单独重试。
- 结果下载与本地落位，写回 `.libtv/state.json`，不自动改写 Step 源文件。
- 与第 2 项 MCP 只读状态打通，让智能体可查询执行进度。
- 与第 1 项 `impact` 打通，生成前可先看影响面。

安全边界：

- 未经显式允许不得调用任何 generation API。
- 不得把生成结果自动当作“已通过审核”。
- 每次真实生成必须走专项测试，先低分辨率、单镜头冒烟。
- 继续遵守 LibTV 只做素材上传/引用/生成/回传的边界。

验收：

- mock 测试覆盖进度、失败、重试、审核阻断、断点恢复。
- 真实环境单镜头冒烟一次，且必须有用户显式允许生成。
- 生成前、生成中、生成后的状态都能在 CLI 与 MCP 中一致可读。

## 5. 两步出图流程专项设计：首版平台 + GPT Image 2 精修

> 本项是流程级设计，不是简单模板补字段。第 4 项“LibTV 生成执行链路产品化”的代码实现应在本项关键决策定稿后进行。
>
> 流程设计初稿见 [两步出图流程设计 v0.1](./2026-08-22-two-stage-image-refine-flow-design.md)。

### 5.1 问题描述

很多创作者（包括项目使用者）生成参考图时采用两步模式：

1. 先用 Midjourney 生成整体风格稿。
   - 优势：风格化、艺术性强，氛围和审美表现好。
   - 弱点：细节准确度和角色一致性较差。
2. 再用 GPT Image 2 对细节进行调整。
   - 优势：细节、文字、道具、人物一致性非常好。
   - 弱点：风格化艺术性相对稍弱。

当前流程没有回答以下关键问题：

- 哪些图 Midjourney 生成后可以直接使用？
- 哪些图必须进入 GPT Image 2 二次精修？
- 二次精修的判定标准、执行入口、产物落位和后续引用链如何定义？

### 5.2 关键事实：LibTV 本身也有 gpt-image-2

- LibTV 的模型列表中存在 gpt-image-2 类模型；实际 `modelKey` / `modelName` 不是字面 `gpt-image-2`，而是经过改名/伪装。
- 精修步骤可以直接在 LibTV 内执行，不依赖外部平台。
- 当前代码只映射了 `midjourney -> mj-v8.2`，没有 gpt-image-2 相关映射；`getModelSchema` 已经支持按 `modelKey` 或 `modelName` 查 LibTV 模型 schema。
- 两步出图流程可以设计成 LibTV 画布中的“首版 image 节点 → 精修 image 节点 → 最终采用节点/版本”链路，与现有素材 adapter 边界一致。

**2026-08-22 模型身份确认（已由使用者确认，无需再生成冒烟验证）：**

- `libtv model search gpt`：无 `gpt` 字面命中，确认名称经过伪装。
- **`lib-image-2` 就是 LibTV 中的 gpt-image-2**（`modelName: Lib Image`，`modelVendor: lib-image`）。
  - 官方 CLI 搜索描述为“最新图片模型、长文本能力突出”；
  - `prompt.placeholder` 明确支持“可直接文字生图，或上传图片输入文字指令对图片进行编辑，如：将背景改为雪夜”；
  - `modeType.items.image2image = [0, 10]`，`rules` 允许 `prompt` 或 `media`；
  - `generateTypes.image = 92`。
- 后续设计统一使用 `lib-image-2` 作为 LibTV gpt-image-2 的模型映射键；工作流平台枚举新增 `gpt-image-2`，对外显示名采用 `GPT Image 2（LibTV）`。
- 其他模型（`nebula-ultra`、`nebula-2-flash`、`nebula-core`、`orbit-2-image` 等）不再作为本流程候选。

### 5.3 为什么这会影响流程本身

当前实现假设一个关键帧只有一个 `modelKey`、一次生成、一个 `status`。两步模式会改变以下结构：

- `LibTvKeyframeRef` 需要从单模型变为“首版模型 + 精修模型 + 精修判定策略”。
- `apply` 需要区分“生成首版”和“执行精修”两个阶段，且默认不自动连续执行。
- 首版生成后必须有人工审阅关卡，产生 `直接可用 / 需要精修 / 需要重生成` 决策。
- 视频生成必须明确引用“最终采用图”，而不是任意首版图。
- `verify-order`、`status`、`order-contracts`、MCP 状态都要知道最终采用版本。
- 如果精修在 LibTV 内进行，还需要确认它接受“参考图 + 文本”的精修输入方式，以及节点/边的表达。

因此必须先做设计，再写生成执行代码；否则第 4 项实现会固化错误的单模型单次流程。

### 5.4 设计阶段（建议顺序，全部在写生成代码之前）

**阶段 A：确认 LibTV 的 gpt-image-2 模型身份（已完成）**

- 已确认映射键：`lib-image-2`（`Lib Image` / `lib-image`）。
- 已确认 schema 支持：
  - 纯文字生图；
  - 上传图片 + 文字指令编辑（参考图 + 文本精修）；
  - `image2image` 模态，范围 `[0, 10]`；
  - 参数：`quality`、`resolution`、`ratio`、`template`（风格）等。
- 产出待补：LibTV 模型合同文档 + `assets.ts` 模型映射方案（后续实现时落地）。

**阶段 B：流程模型设计**

- 项目默认策略：首版平台可配置为 `midjourney` 或 `gpt-image-2`（后续可扩展），精修平台固定 `gpt-image-2`；支持单镜头/单关键帧覆盖。
- 关键帧状态机：
  - `planned -> first_draft_generated -> review(直接可用 | 需要精修 | 需要重生成) -> refined -> final_approved`
- 精修在 LibTV 中的表达：
  - 单独新建精修节点；
  - 还是更新原节点并保留版本历史；
  - 精修节点如何引用首版图（left 边 / imageList / 上传资源）。
- 产物与状态落位：
  - 源层 Step 4 只写“出图策略与判定标准”等静态意图；
  - 执行层 `.libtv/state.json` 或专门 review 文件记录每张图的动态决策，不自动改写 Step 源文件。
- 视频生成前置条件：必须引用 `final_approved` 的图。

**阶段 C：Step 4 模板与校验合同**

- Step 4 增加：
  - 首版平台；
  - 精修平台；
  - 精修触发条件；
  - 精修原因枚举；
  - 精修提示词字段或区块。
- `verify` 在两步出图模式启用时检查：
  - 字段是否填写；
  - 精修原因是否具体；
  - 是否误把精修平台参数写进 Step 5 视频提示词。
- 模板合规测试同步更新。

**阶段 D：Adapter 与审阅表面**

- `libtv plan/apply/status/verify-order` 表达两步状态。
- MCP 只读状态暴露每个关键帧的首版/精修/最终采用状态。
- Obsidian 观看层增加“图片出图决策”卡片或状态列。
- `impact` 影响面命令能把“改了首版图/精修图”关联到下游视频。

**阶段 E：验证**

- 全部 mock 测试覆盖状态机、审核阻断、重试、版本选择。
- 真实冒烟必须显式允许生成：先用 1 张低分辨率图验证“首版（MJ 或 GPT Image 2）→ 人工决策 → GPT Image 2 精修 → 最终采用”完整闭环。
- 验证 LibTV 中 gpt-image-2 节点的参考图输入方式和生成结果字段。

### 5.5 建议的流程草案（待阶段 A/B 验证后定稿）

```text
Step 4 源文件：写明“首版平台 / 精修平台 / 精修判定标准 / 精修原因候选”

libtv plan：为每个关键帧生成两阶段出图计划，但默认不连续执行

libtv apply --only keyframes --allow-generation
  -> 用首版平台生成首版（midjourney 或 gpt-image-2）

人工审阅：
  -> 直接可用：标记 final_approved，进入视频引用链
  -> 需要精修：标记 needs_refine，进入 GPT Image 2 精修
  -> 需要重生成：标记 regenerate，重新生成首版

libtv apply --only keyframes --allow-generation
  -> 对 needs_refine 项调用 LibTV gpt-image-2 精修

人工复核精修结果：
  -> final_approved，后续 Step 5 视频只引用最终采用图
```

### 5.6 待确认问题

- LibTV 中 gpt-image-2 的映射键已确认：`lib-image-2`。
- 工作流平台枚举已确认：新增 `gpt-image-2`，对外显示 `GPT Image 2（LibTV）`。
- 精修流程已确认不限于 MJ 首版：首版为 `gpt-image-2` 时，同一流程仍适用。
- `template` 风格模板：v1 默认不做。
- 精修节点应新建节点，还是更新原节点并保留版本？（设计初稿建议新建精修节点）
- 两步模式是项目级默认、镜头级覆盖，还是每个关键帧独立选择？
- 精修提示词动态生成，用户反馈记录在 `.libtv/state.json` 还是独立 review 文件？（初稿建议 `.libtv/state.json`）
- Step 2 锚点图是否也需要“首版 + 精修”流程？
- LibTV 中 gpt-image-2 精修节点与首版节点之间的参考边/`imageListOrder` 应如何表达？

### 5.7 边界

- 这是图像执行与质量决策流程，不是剧情/分镜设计能力。
- 生成仍必须显式允许；决策由创作者人工做出。
- 不改变“Step 文件是唯一事实源”的原则；生成产物与执行状态只是执行层数据。

## 6. GPT Image 2 提示词适配层：现状结论与设计基线

### 6.1 现状结论

**目前没有像 Midjourney 那样的 GPT Image 2 专属提示词适配部分。**

具体证据：

- Step 4 模板中的 `## 平台执行参数` 是 Midjourney 专属内容：
  - `--v 8.2`、`--ar`、`--style raw`、`stylize`、`--oref`、`--no` 等都是 MJ 参数。
- 平台事实索引只有 `packs/official-ai-video/workflow/indexes/platform-midjourney-v82.md`，没有 gpt-image-2 / `lib-image-2` 平台索引。
- `docs/zh/generation-platforms/by-task.md` 只写了 Step 4 的 midjourney 平台差异，没有 gpt-image-2 段落。
- 校验器 `verifyStep4PlatformExecutionSettings` 对非 midjourney 项目直接 `return`，不存在 gpt-image-2 的平台参数检查。
- `SUPPORTED_PLATFORMS` 没有 `gpt-image-2`；`assets.ts` 也只有 `midjourney -> mj-v8.2`，没有 `gpt-image-2 -> lib-image-2`。

### 6.2 需要新增的平行适配层

GPT Image 2 需要一套与 Midjourney 平行的专用适配层，而不是复用 MJ 参数：

- 新增 `packs/official-ai-video/workflow/indexes/platform-gpt-image-2.md`：
  - 固化的平台事实：`lib-image-2` 映射、文生图与图生图编辑能力、`quality/resolution/ratio/template`、`image2image [0,10]`、prompt/media 规则。
- Step 4 模板增加 gpt-image-2 专用块：
  - `## 平台执行参数`（gpt-image-2 项目变体）：不写 MJ 参数，写 `平台：gpt-image-2`、`显示名：GPT Image 2（LibTV）`、`LibTV 模型：lib-image-2`、出图质量、清晰度、比例；`template` 风格模板默认不做。
  - `## 精修配置` + `## 精修负面约束`（两步模式）：静态合同；精修指令本身动态生成。
- `docs/zh/generation-platforms/by-task.md` 与英文版增加 GPT Image 2 段落。
- `verify.ts` 增加 gpt-image-2 专属检查：
  - 项目启用 gpt-image-2 时必须有平台执行参数块；
  - 不得照抄 MJ 参数；
  - 两步模式启用时必须有 `## 精修配置` 和 `## 精修负面约束`；
  - 精修负面约束必须具体、不得用“同上/保持一致”。
- `constants/types` 平台枚举：
  - 新增 `gpt-image-2`（已确认），对外显示 `GPT Image 2（LibTV）`。
- `assets.ts` 增加模型映射：`gpt-image-2 -> lib-image-2`。

### 6.3 设计决策状态

1. 工作流平台枚举：已确认新增 `gpt-image-2`；对外显示 `GPT Image 2（LibTV）`；LibTV 模型映射 `gpt-image-2 -> lib-image-2`。
2. GPT Image 2 提示词语言：已确认用中文。
3. 精修指令：已确认动态生成，由用户生成首版后反馈问题，再进入精修；不预写。
4. 精修节点引用方式：已确认用画布引用边引用已生成的原图节点。
5. `template` 风格模板：已确认 v1 默认不做。
6. 首版与精修负面约束：已确认分开维护。
7. 流程适用范围：已确认不限于 MJ 首版；首版为 gpt-image-2 时，同一套“生成 → 反馈 → 精修 → 最终采用”流程仍适用。

详细流程见 [两步出图流程设计 v0.1](./2026-08-22-two-stage-image-refine-flow-design.md)。
