# Codex Adapter

## 1. 目标

把 `ai-video-workflow` 的中立母版内容转化到 Codex 可读取的原生目录。转化完成后，`.codex/` 是当前项目的 Codex 运行时入口；`packs/official-ai-video/` 继续保留为分发包母版源。

## 2. 转化目标目录

若要把分发包转化为 Codex 原生可读结构，目标目录应是仓库根下的 `.codex/`。

推荐落位：

- `.codex/README.md`
  - 放快速使用摘要
- `.codex/agent-rules.md`
  - 放工作流主规范和质量门槛的摘要镜像
- `.codex/repo-context.md`
  - 放当前项目目录映射和起手顺序摘要
- `.codex/skills/`
  - 放 Codex 可识别的 skill 运行包
  - 目录形式固定为 `.codex/skills/<skill>/SKILL.md`
- `.codex/ai-video-workflow/`
  - 放详细总览、初始化指南、索引、模板、长文 skill 源和 skill bundle 镜像

`.codex/` 是 Codex 在当前项目中的原生运行目录。若规则不落到 `.codex/` 下的有效入口，不能假设 Codex 会稳定按项目规则运行。

## 3. 检测顺序

开始前先检测以下入口是否存在：

1. `.codex/`
2. `.codex/agent-rules.md`
3. `.codex/repo-context.md`
4. `.codex/skills/`
5. 项目根单文件入口

若原生入口已经存在，则沿用现有结构转化。若原生入口不存在，但目标是正式启用 Codex 工作流，则应按本页推荐结构创建 `.codex/` 后再转化。不要把“当前还没有 `.codex/`”误判成“可以只靠分发包运行”。

## 4. 推荐映射

若仓库已有 Codex 目录，推荐按职责映射：

- `.codex/README.md` <- `ai-video-workflow/README.md`
- `.codex/agent-rules.md` <- `packs/official-ai-video/workflow/workflow-spec.md` 与 `quality-gates.md` 的摘要
- `.codex/repo-context.md` <- 项目级 `project.config.yaml` 或实际项目映射
- `.codex/skills/<skill>/SKILL.md` <- `packs/official-ai-video/skills/<skill>/SKILL.md`
- `.codex/ai-video-workflow/WORKFLOW_OVERVIEW.md` <- `WORKFLOW_OVERVIEW.md`
- `.codex/ai-video-workflow/skills/` <- `packs/official-ai-video/skills-longform/*`
- `.codex/ai-video-workflow/skill-bundles/` <- `packs/official-ai-video/skills/*`
- `.codex/ai-video-workflow/templates/` <- `packs/official-ai-video/templates/*`
- `.codex/ai-video-workflow/indexes/` <- `packs/official-ai-video/workflow/indexes/*`

## 5. 落位原则

- `.codex/` 中的内容是 Codex 运行时实际读取内容
- `.codex/skills/` 是 skill 的运行时入口
- `.codex/ai-video-workflow/` 是完整文档和镜像层
- 当前项目绑定信息只从项目级配置读取，例如 `project.config.yaml`

## 5.1 职责分配

- `.codex/README.md`
  - 放快速使用摘要和读取顺序
- `.codex/agent-rules.md`
  - 放工作流主规范和质量门槛的摘要
- `.codex/repo-context.md`
  - 放当前项目映射、当前目录边界和起手顺序摘要
- `.codex/skills/`
  - 放运行时可识别 skill 包
  - 每个 skill 一个目录，每个目录一个 `SKILL.md`
- `.codex/ai-video-workflow/`
  - 放完整总览、初始化指南、长文 skill 源、skill bundle、模板镜像和索引镜像

## 5.2 镜像策略

- `.codex/README.md`、`.codex/agent-rules.md`、`.codex/repo-context.md` 采用摘要镜像
- `.codex/ai-video-workflow/` 采用完整镜像
- `.codex/skills/` 采用目录化运行包，不从平铺 `packs/official-ai-video/skills-longform/*.md` 直接取用
- 若只能维护最小接入层，优先保留 `.codex/agent-rules.md` 和 `.codex/repo-context.md`

## 6. 未建立原生入口时

若项目或仓库没有 Codex 专用目录，则：

1. 若目标是正式启用 Codex 工作流，必须创建 `.codex/`，并把运行摘要与详细镜像转化进去
2. 在 `.codex/` 未建立前，不应假设 Codex 会自动按该分发包识别项目规则
3. 若没有 `.codex/skills/<skill>/SKILL.md`，则不能视为目录化 skill 已正式启用
3. `ai-video-workflow/` 在这时只能作为分发包和初始化参考，不是 Codex 的完整运行替代
4. 转化完成后，应改为从 `.codex/` 入口继续执行

## 7. 最小入口建议

Codex 最少需要知道：

- `.codex/` 运行入口在哪里
- 当前项目真实目录映射是什么
- 当前请求应该落在哪一步
