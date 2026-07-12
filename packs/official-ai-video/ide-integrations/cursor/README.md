# Cursor Adapter

## 1. 目标

把 `ai-video-workflow` 的中立母版内容转化到 Cursor 可读取的原生目录。转化完成后，`.cursor/` 是当前项目的 Cursor 运行时入口；`packs/official-ai-video/` 继续保留为分发包母版源。

## 2. 转化目标目录

若要把分发包转化为 Cursor 原生可读结构，目标目录应是项目根下的 `.cursor/`，其中主要入口位于 `.cursor/rules/`。

推荐落位：

- `.cursor/rules/`
  - 放总入口规则和步骤级规则镜像
- `.cursor/ai-video-workflow/`
  - 放详细总览、初始化指南、长文 skill 源、skill bundle 镜像、索引和模板镜像

`.cursor/` 是 Cursor 在当前项目中的原生运行目录。若规则不落到 `.cursor/rules/` 等可识别位置，不能假设 Cursor 会稳定读取这些规则。

跨平台读取时，先读项目根 `AGENTS.md` 和 `docs/ai-workspace/`，再进入 `.cursor/` runtime mirror。

## 3. 检测顺序

开始前先检测以下入口是否存在：

1. `.cursor/`
2. `.cursor/rules/`
3. 项目级说明文档
4. 项目级 AI 指令文件

若原生入口已经存在，则沿用现有结构转化。若原生入口不存在，但目标是正式启用 Cursor 工作流，则应按本页推荐结构创建 `.cursor/` 后再转化。不要把“当前还没有 `.cursor/`”误判成“可以跳过原生目录”。

## 4. 推荐映射

若项目已有 Cursor 规则目录，推荐最少落一个总入口规则文件，内容只做以下事情：

- `.cursor/rules/ai-video-workflow.mdc` <- 总入口，指向 `workflow-spec.md`、`quality-gates.md`、`AI初始化指南.md`
- `.cursor/rules/step1-6/*.mdc` <- 可选的步骤级规则入口，显式对应某个 `packs/official-ai-video/skills/<skill>/SKILL.md`
- `.cursor/ai-video-workflow/WORKFLOW_OVERVIEW.md` <- `WORKFLOW_OVERVIEW.md`
- `.cursor/ai-video-workflow/skills/` <- `packs/official-ai-video/skills-longform/*`
- `.cursor/ai-video-workflow/skill-bundles/` <- `packs/official-ai-video/skills/*`
- `.cursor/ai-video-workflow/templates/` <- `packs/official-ai-video/templates/*`
- `.cursor/ai-video-workflow/indexes/` <- `packs/official-ai-video/workflow/indexes/*`

当项目需要更细拆分时，再补：

- 总路由规则
- Step 1 到 Step 6 的步骤规则
- 模板索引规则

## 5. 落位原则

- `.cursor/` 中的内容是 Cursor 运行时实际读取内容
- 分发包维护时不在 adapter 里复制第二套规则母版
- 任何平台默认值与质量门槛都应从分发包母版生成并同步到 `.cursor/`
- Cursor 虽然以 rules 为主入口，但也必须保留 skill bundle 镜像，不能只剩平铺 skill 名称

## 5.0 Adapter Contract

- 读取：`packs/official-ai-video/`、`project.config.yaml` 和项目 Step 1 到 Step 6 文件。
- 写入：`.cursor/rules/` 规则入口、`.cursor/skills/` 技能入口和 `.cursor/ai-video-workflow/` 完整运行镜像。
- 同步方向：`runtime-mirror`。
- 事实源：`project-step-files`，而不是 `.cursor/` 运行镜像。
- 不能写入：源 Step 文件、生成的 Obsidian 投影文件、用户 `.obsidian/` 配置或绝对路径链接。
- 验证：`ai-video-workflow verify --project <path> --ide cursor`。

## 5.1 职责分配

- `.cursor/rules/`
  - 放总入口规则和步骤级摘要规则
  - 适合短文本、路由说明、优先级说明
- `.cursor/ai-video-workflow/`
  - 放完整总览、初始化指南、长文 skill 源、skill bundle、模板与索引镜像
  - 适合较长的规则说明和参考文档

## 5.2 镜像策略

- `.cursor/rules/` 只保留摘要，不复制整套规范
- `WORKFLOW_OVERVIEW.md`、模板、长文 skill 源和 skill bundle 应放到 `.cursor/ai-video-workflow/`
- 每个 `.mdc` 规则入口都应显式映射到某个 skill bundle，而不是只写平铺 skill 名称
- 如果规则入口只能容纳一小段文本，应优先放读取顺序和 `.cursor/ai-video-workflow/` 详细镜像位置

## 6. 未建立原生入口时

若项目没有 Cursor 原生规则目录，则：

1. 若目标是正式启用 Cursor 工作流，必须创建 `.cursor/`，并把规则入口与详细镜像转化进去
2. 在 `.cursor/rules/` 未建立前，不应假设 Cursor 能自动识别这些规则
3. 若只有 `.cursor/rules/`，但没有 `.cursor/ai-video-workflow/skill-bundles/`，则可视为入口存在但技能说明层仍不完整
3. `ai-video-workflow/` 在这时只能作为分发包和初始化参考，不是 Cursor 的完整运行替代
4. 转化完成后，应改为从 `.cursor/` 入口继续执行

## 7. 最小入口建议

若只放一个 Cursor 入口文件，它应至少包含：

- `.cursor/` 运行入口位置
- 当前项目映射文件位置
- 当前项目使用的步骤顺序
- 哪些文档只做 adapter，不是主源
