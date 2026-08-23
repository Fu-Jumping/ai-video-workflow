# 04 领域术语表

只收录 ai-video-workflow 中**实际存在**的概念。定义出处以括注路径为准；本表是速查，不是第二份规范。

## 项目与模式

| 术语 | 含义 | 出处 |
| --- | --- | --- |
| 工具仓库 / 创作项目 | 本仓库是产品（工具）；创作项目由 `init` 在别处生成 | `README.md` Beginner Start |
| 研究模式 / 剧本模式 | 研究模式 Step 0 起步；剧本模式已有完整剧本，关闭 `workflow.research_step.enabled` 从 Step 1 起步 | `packs/official-ai-video/workflow/workflow-spec.md` §3 |
| project.config.yaml | 创作项目配置：pack、ide、platforms.image/video.default、workflow 开关 | `examples/官方示例-云上早市/project.config.yaml` |
| 增强流程 | 默认启用的横切能力：审核与通过、影响分析、修复回链、交付总控 | `packs/official-ai-video/workflow/indexes/capability-index.md` |
| 母版源 / 运行镜像 | 母版源=`packs/official-ai-video/`；运行镜像=IDE 目录内由 sync 同步的表面 | `WORKFLOW_OVERVIEW.md` §2 |
| 事实源（project-step-files） | 创作项目 Step 目录的 Markdown 是唯一创作事实；镜像、观看层、平台缓存、宿主记忆都不是 | 项目级 `AGENTS.md` |

## 创作结构

| 术语 | 含义 | 出处 |
| --- | --- | --- |
| Step 0-7 | 前期研究 / 策划 / 设定 / 分镜 / 图片提示词 / 视频提示词 / 生产清单 / 发布物料 | `packs/official-ai-video/workflow/step-map.yaml` |
| 镜头组 | 同一场景或事件的一组 15 秒镜头，目录 `镜头组-001/` | workflow-spec.md §3.1 |
| 镜头（shot） | 一次视频生成任务；编号项目内全局唯一；默认 15 秒，可缩短不可超 | workflow-spec.md §3.1 |
| 分镜 | 镜头内部的画面段，默认 1-2 个、最多 4 个；Step 3 写"分镜 N"，Step 5 写"镜头N：" | workflow-spec.md §3.1 |
| 关键帧 | Step 4 的图片提示词对象，默认 1 张、不多于分镜数且 ≤4；不绑定首帧/尾帧；文件名 `镜头-001-关键帧-01.md` | workflow-spec.md §3.1 |
| 稳定状态 | 单一可见画面状态；一个 Step 4 文件只服务一个稳定状态 | quality-gates.md §4.3 |
| 帧级映射 | 已拆帧镜头在 Step 3 镜头卡内显式写出分镜 ↔ 关键帧对应关系 | quality-gates.md §3.2 |
| 三区块合同 | Step 4 文件固定包含 `快速导读` / `中文完整版本` / `可复制提示词` | workflow-spec.md §5 |
| 五区块合同 | Step 5 文件固定包含 `元信息` / `平台执行设置` / `参考素材映射` / `可复制提示词` / `负面约束` | workflow-spec.md §3.2 |

## 一致性与参考资产

| 术语 | 含义 | 出处 |
| --- | --- | --- |
| `@角色名三视图` | 主角色必配的三视图锚点引用口径；Step 2 声明，Step 3 要求，Step 4 携带，Step 5 延续 | workflow-spec.md §8 |
| `@场景名场景图` | 强视觉一致性场景（建筑、特殊区域、特殊布景）的锚点引用口径 | workflow-spec.md §8 |
| 锚点体系 | 通用一致性能力：主人物/主空间锚点、三视图标准板、二级一致性锚点、器物手部锚点、实拍标准图优先对象 | workflow-spec.md §8 |
| 参考资产要求 | Step 3 镜头卡列出的本镜头图片生成必须携带的锚点集合 | quality-gates.md §1.2 |
| `&#123;&#123;Mixed n&#125;&#125;` | Seedance/LibTV 执行层按素材上传顺序生成的槽位标记；**不写入事实源** | `packs/official-ai-video/templates/05_视频提示词/视频提示词.md` 文件用途节 |

## 研究与来源

| 术语 | 含义 | 出处 |
| --- | --- | --- |
| `SRC-xxxx` | Step 0 来源 ID；关键现实事实必须携带 | workflow-spec.md §5 Step 0 节 |
| 来源卡（source card） | `_资料库/SRC-0001/` 下的研究来源单元（metadata.json、source-card.md、匿名 comment-sample.md） | `README.md` Step 0 Research |
| 创作简报 | Step 0 交接产物 `04_创作简报.md`，必须区分已验证事实/合理推断/创作改编 | quality-gates.md §2.3 |
| research inbox | `research ingest / inbox` 管理的本地研究归档流 | `apps/cli/src/lib/research.ts` |

## 校验与例外

| 术语 | 含义 | 出处 |
| --- | --- | --- |
| verify | 结构合同 + 规则化内容检查的校验命令；支持 `--step N`（分步）、`--strict`（忽略登记偏离） | `docs/zh/quickstart/verify-and-iterate.md` |
| doctor | 诊断命令，输出可合并 block 与修复建议 | `apps/cli/src/lib/doctor.ts` |
| deviations.yaml | 项目级已接受偏离登记：mode（standard/scene-basis/minimal-video/hybrid）+ 逐条 deviations + 按镜头 shots | `docs/zh/workflow/supported-deviations.md` |
| 机器✅ / 人工👤 | 质量门槛的执行归属标注：verify 机器覆盖项 vs 人工/智能体审核项 | quality-gates.md §1.3 |
| 影响分析 | 修改已完成步骤后的必做检查；结构层机器、语义层人工。CLI `impact` 双模式：`impact <关键词>` 文本命中；`impact --image <节点>` 从 `.libtv/state.json` 把 LibTV 图片节点（首版/finalNodeId/精修轮）反查到受影响 Step 4/5 文件；两种模式均输出 `reviewCandidates` 待复核候选 | `docs/zh/workflow/impact-analysis.md`、`apps/cli/src/lib/impact.ts` |
| reviewCandidates | impact 输出中的待复核文件清单：未直接命中、但位于同镜头下游链或携带匹配 Step 2 参考资产 token 的文件 | `apps/cli/src/lib/impact.ts` |
| 锁版 / 放行 | Step 6 多人协作中的版本控制状态：样张先行、批量放行 | quality-gates.md §6.1 |

## 执行与观看表面（Adapter）

| 术语 | 含义 | 出处 |
| --- | --- | --- |
| Adapter | 把同一工作流落到平台可执行位置的适配层（IDE、Obsidian、LibTV、MCP、Cherry Studio）；不创建第二套工作流 | `docs/zh/contributors/adapter-boundaries.md` |
| 观看层（`_views/obsidian/`） | 生成的 Obsidian vault 投影；Obsidian 只打开此目录；含 `流程/`、`镜头/`、`数据表/`、`画布/`、`00_项目首页.md`、`投影清单.json`；`笔记/`（用户手写）被增量导出保留但非事实源 | `README.md` Obsidian Vault Projection |
| `.libtv/` 与 `outputs/` | LibTV 本地执行状态与下载产物；gitignored | `docs/zh/contributors/adapter-boundaries.md` |
| `libtv review` | 图片节点人工审阅决策：`--decision direct\|refine\|regenerate`（直接可用/需要精修/需要重生成），可附 `--feedback` | `docs/zh/contributors/libtv-asset-adapter.md`、`apps/cli/src/lib/libtv/refine.ts` |
| `libtv refine` | 两阶段精修：基于人工反馈用 GPT Image 2（LibTV 模型 `lib-image-2`）创建精修节点；`--instruction` 中文修改指令、`--base first\|current` 精修基准；触发真实生成，CLI 强制显式 `--allow-generation` | `docs/zh/contributors/libtv-asset-adapter.md`、`apps/cli/src/lib/libtv/refine.ts` |
| `libtv approve` | 关键帧人工通过动作；通过后才能执行视频生成；若存在精修轮，`finalNodeId` 指向最近精修节点、关键帧状态置 `final_approved`，精修版进入主链 | `apps/cli/src/lib/libtv/register.ts`、`docs/zh/contributors/adapter-boundaries.md` |
| mcp-context / mcp-server | 只读 MCP 上下文输出与单项目 stdio server；不用于必须退出的脚本；上下文含关键帧/锚点精修轮数 | `README.md` MCP Read-Only Context |
| 宿主表面 | Cherry Studio 等宿主创建的 `SOUL.md`、`USER.md`、`memory/`；兼容但不当作项目事实源 | `README.md` Cross-Agent Workspace |

## 仓库工程

| 术语 | 含义 | 出处 |
| --- | --- | --- |
| skills-longform / skills 双层 | 长文内容源与目录化技能包（SKILL.md）；长文源优先，两者语义一致 | workflow-spec.md §2.1 |
| sync | 把母包同步到创作项目 IDE 运行镜像的命令；已有 `AGENTS.md`/共享文档时缺失才写 | `README.md` Cross-Agent Workspace |
| 官方示例（云上早市） | CI 验证对象示例项目；`pnpm example:verify` 的目标 | `package.json` |
| 隔离端到端测试 | 按 avw-isolated-e2e-testing skill 编排的测试：主对话编排 + 隔离子代理 + 裸仓库镜像模拟远端 | 机器全局 skill `avw-isolated-e2e-testing` |
