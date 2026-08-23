# 两步出图流程设计 v0.1：首版平台 + GPT Image 2 精修

- 制定日期：2026-08-22
- 状态：流程设计草案（已进入设计阶段，未实现）
- 基线：master @ `bed965e`
- 已确认前提：LibTV 中的 gpt-image-2 映射键为 `lib-image-2`
- 设计约束：不触发生成；Step 文件是唯一创作事实源；生成必须显式允许；决策由人工做出

## 0. 平台枚举是什么

`platforms` 是 `project.config.yaml` 里记录“这个项目默认用哪个生图平台、哪个生视频平台”的字段，例如：

```yaml
platforms:
  image:
    default: midjourney
  video:
    default: seedance
```

CLI 的 `init --image <平台>` 也是从同一个固定列表取值。校验器根据这个值决定 Step 4 套用哪套平台规则。

当前允许的取值是：

```text
openai / veo / runway / luma / minimax / seedance / midjourney
```

GPT Image 2 现在不在列表里，所以有两个方案：

- 方案 A：新增平台值 `gpt-image-2`。
  - 优点：它有独立的提示词合同和校验规则，和 midjourney 一样单独治理。
  - 代价：需要同步改 CLI、zod、文档；如果不做“图片平台/视频平台分开枚举”，它也会出现在视频平台选择里。
- 方案 B：沿用现有 `openai`，把 GPT Image 2 当作 openai 下的具体模型。
  - 优点：改动小。
  - 代价：以后 openai 图片模型不止一个时，`openai` 无法表达“到底用哪个”，只能靠 `libtv.image_model` 兜底。

**已确认：方案 A，新增 `gpt-image-2`。**

命名约定：

- 配置层 enum 键：`gpt-image-2`
- 对外显示名：`GPT Image 2（LibTV）`（后缀式；也可按产品需要改成 `LibTV GPT Image 2` 前缀式）
- LibTV 模型映射：`gpt-image-2 -> lib-image-2`

说明：enum 保持平台本体名 `gpt-image-2`，让校验器和模板稳定；`LibTV` 只出现在显示名里，表示该平台当前通过 LibTV 执行。

## 1. 已确认决策

| # | 问题 | 决策 |
| --- | --- | --- |
| 1 | GPT Image 2 提示词语言 | 中文。不照搬 Midjourney 的英文七要素 + 参数行合同 |
| 2 | 精修提示词是否预写 | 动态生成：首版图（平台可配置，MJ 或 GPT Image 2 均可）生成后，用户反馈“哪张图、哪里有问题、要怎样调整”，再由反馈生成精修指令 |
| 3 | 精修节点前置条件 | 必须先有一个已经生成出来的图片节点；精修节点直接引用该原图节点作为参考 |
| 4 | 精修节点引用方式 | 用画布引用边（left 边）引用原图节点，不再重新上传 |
| 5 | 首版与精修负面约束 | 分开维护：首版平台自己的负面约束与精修 GPT Image 2 负面约束各自独立 |
| 6 | `template` 风格模板 | 默认不做；v1 不生成该字段、不作为 Step 4 合同，LibTV 侧使用默认值 |
| 7 | 平台枚举 | 新增 `gpt-image-2`；对外显示 `GPT Image 2（LibTV）`；LibTV 模型映射 `lib-image-2` |

## 2. 流程设计

### 2.1 源层：Step 4 文件

Step 4 的首版提示词合同由**首版平台**决定，不再限定 Midjourney。

**首版平台 = midjourney：**

- `## 快速导读`
- `## 中文完整版本`
- `## 可复制提示词`（英文，供 Midjourney）
- `## 平台执行参数`（Midjourney 参数）
- `## 中文自检`

**首版平台 = gpt-image-2：**

- `## 快速导读`
- `## 中文完整版本`
- `## 可复制提示词`（中文，供 GPT Image 2）
- `## 平台执行参数`（gpt-image-2 版本，不写 MJ 参数）：

```markdown
## 平台执行参数

- 平台：gpt-image-2
- 显示名：GPT Image 2（LibTV）
- LibTV 模型：lib-image-2
- 出图质量：medium（可选 low / medium / high）
- 清晰度：2K（可选 1K / 2K / 4K）
- 比例：继承项目目标画幅
- 风格模板：默认不做，不生成 template 字段
```

无论首版平台是什么，两步精修能力启用后，Step 4 增加静态配置，但**不预写精修指令**：

```markdown
## 精修配置

- 精修平台：gpt-image-2
- LibTV 模型：lib-image-2
- 精修触发：人工反馈后进入；不自动精修
- 精修判定：直接可用 / 需要精修 / 需要重生成
- 精修原则：只修改用户反馈的问题点，不改变整体构图、主体身份与色调

## 精修负面约束

- 不得改变首版已确认的整体构图。
- 不得改变角色身份、服装、发型和场景空间关系。
- 不得引入新的现代物件。
- 不得把局部修改扩大成整张重画。
- 每条精修指令都必须对应一个明确可见的问题点。
```

精修指令本身不写死在 Step 4 里；它由使用者看到首版图后反馈生成，写入执行层状态。

### 2.2 执行层：状态机

一个关键帧的状态从当前单线扩展为两步状态：

```text
planned
  -> first_generated（首版图已生成，等待人工审阅）
  -> direct_approved（直接可用，作为最终采用图）
  -> needs_refine（用户反馈问题，等待精修）
  -> refined_generated（GPT Image 2 精修完成，等待复核）
  -> final_approved（最终采用图）
```

首版平台可以是 `midjourney` 或 `gpt-image-2`，后续也可扩展其它图片平台；精修平台固定为 `gpt-image-2`。

重生成路径：

```text
first_generated -> regenerate（用首版平台重新生成首版）
```

关键帧状态记录建议扩展：

- `firstNodeId` / `firstCdnUrl` / `firstOutput`
- `reviewDecision`：`direct` / `refine` / `regenerate`
- `feedback`：用户反馈的问题点与调整指令
- `refineInstruction`：根据反馈生成的 GPT Image 2 中文精修指令
- `refineNodeId` / `refineCdnUrl` / `refineOutput`
- `finalNodeId`：视频生成引用哪一个节点
- `finalStatus`：`direct_approved` / `refined_generated` / `final_approved`

视频生成前置条件从“关键帧 approved”改为：

> 必须存在 `finalNodeId`，且 `finalStatus` 为 `direct_approved` 或 `final_approved`。

### 2.3 执行层：CLI 交互

建议新增或扩展命令：

```text
libtv review <keyframe-id>
  --decision direct|refine|regenerate
  --feedback "左手手指多了一根；服装纹理和 Step 2 不一致"

libtv refine <keyframe-id>
  --instruction "只修左手手指和服装纹理，其他保持不变"
  --allow-generation
```

`review` 只写执行状态，不生成。

`refine` 必须显式 `--allow-generation`，执行：

1. 找到该关键帧的首版节点（不管首版是 MJ 还是 GPT Image 2）。
2. 校验首版节点确实存在且已有生成结果。
3. 创建新的 image 精修节点：
   - 展示名：`group-001 shot-001 keyframe-01 精修`
   - 模型：`lib-image-2`
   - 模式：`image2image`
   - 参考：left 边指向首版节点
   - 提示词：中文精修指令 + 精修负面约束
4. 等待生成完成，下载结果。
5. 状态写入 `.libtv/state.json`，等待人工复核。

`approve` 语义调整为批准最终采用图；旧行为兼容。

**两种典型路径：**

- 路径 A：`midjourney` 首版 → 审阅 → `gpt-image-2` 精修。
- 路径 B：`gpt-image-2` 首版 → 审阅 → `gpt-image-2` 精修（同一模型，首版是完整创作提示词，精修是针对性编辑指令）。

### 2.4 执行层：节点与边

- 首版节点名保持不变：`group-001 shot-001 keyframe-01`（首版平台不影响命名）
- 精修节点名建议：`group-001 shot-001 keyframe-01 精修`
- 精修节点 left 边 = 首版节点
- 精修节点的 `imageList` / 顺序字段中，首版图排第一，作为待编辑输入图
- 视频节点的 left 边引用 `finalNodeId`，而不是固定引用首版节点
- `verify-order` 合同需要知道“最终采用图”对应哪个节点，避免首版/精修版本歧义

### 2.5 GPT Image 2 中文提示词适配层

与 Midjourney 参数行不同，GPT Image 2 使用自然语言指令。建议精修提示词采用以下结构：

```text
参考图：已上传的首版图（MJ 或 GPT Image 2 首版均可）。

修改范围：只修改以下问题点：
1. <用户反馈的问题点 1>
2. <用户反馈的问题点 2>

保持不变：整体构图、主体身份、服装、发型、场景空间、光线方向。

负面约束：
- <精修负面约束 1>
- <精修负面约束 2>

输出：一张与参考图相同比例和清晰度的最终图片。
```

设计原则：

- 提示词用中文。
- 精修指令由用户反馈动态生成，默认不自动创作新内容。
- 不写 Midjourney 参数。
- 如果用户没有写“保持不变”，系统补上默认的“保持构图/身份/色调”保护句。
- 负面约束从 Step 4 的 `## 精修负面约束` 读取；用户反馈中也可以临时追加一条本次精修的额外约束。

首版平台 = gpt-image-2 时：

- 首版提示词是完整的中文画面描述。
- 精修提示词是针对性编辑指令。
- 两者都走中文自然语言合同，但用途不同：首版负责“生成完整画面”，精修负责“只改反馈中的问题点”。

### 2.6 校验、状态与审阅表面

- `verify`：
  - 启用两步模式时，Step 4 必须有 `## 精修配置` 和 `## 精修负面约束`。
  - 精修负面约束不得是模板原句照抄，至少一条镜头/画面专属项。
  - Step 4 的 MJ 参数不得混入精修指令。
- `libtv status`：
  - 显示每个关键帧是 `direct_approved`、`needs_refine`、`refined_generated` 还是 `final_approved`。
- MCP 只读状态：
  - 暴露首版图、精修图、最终采用图和用户反馈。
- Obsidian 观看层：
  - 关键帧页增加“出图决策卡”：直接可用 / 待精修 / 已精修 / 最终采用。
- `impact`：
  - 当用户修改了某个关键帧的精修状态或最终采用图，提示下游视频提示词需要复核。

## 3. 已确认 / 待澄清

1. 平台枚举：已确认新增 `gpt-image-2`，显示名 `GPT Image 2（LibTV）`。
2. 用户反馈记录在 `.libtv/state.json`，还是单独 `outputs/images/<group>/<shot>/review.md`？
   - 建议先放 `.libtv/state.json`，保持执行层单点。
3. 精修节点是否需要独立分组，还是放在原 keyframe 节点旁边（无分组）？
4. `template` 风格模板：已确认 v1 默认不做。
5. 首版图若已经足够好，是否允许把 `direct_approved` 作为常态，避免强制两步？
   - 建议允许，因为不是所有图都需要精修。

## 4. 边界

- 不自动判断图片好坏，不自动决定精修。
- 不自动触发 GPT Image 2 生成；必须 `--allow-generation`。
- 精修只做执行层编辑指令，不创作新的剧情或分镜内容。
- Step 4 源文件仍是唯一创作事实源；反馈与精修状态是执行层数据。
- LibTV 仍只承担素材上传、引用、生成、回传。

