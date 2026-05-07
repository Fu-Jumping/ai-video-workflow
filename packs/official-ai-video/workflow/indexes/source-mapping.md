# Source Mapping

## 1. 目的

本文件记录中立化分发包吸收了哪些旧来源，以及这些内容在新包中的落点。

## 2. 吸收来源与去向

| 新文件或新目录 | 主要吸收来源 |
| --- | --- |
| `README.md` | 项目根 `README.md`、旧流程主文档、旧中文导航页 |
| `WORKFLOW_OVERVIEW.md` | 旧流程主文档、旧总路由技能、旧规则入口、旧 workflow 配置 |
| `packs/official-ai-video/workflow/workflow-spec.md` | 旧 spec、旧规则入口、旧总路由技能 |
| `packs/official-ai-video/workflow/quality-gates.md` | 旧 spec、旧需求文档、旧图片/视频模板、后续 Step 5 调整计划 |
| `packs/official-ai-video/workflow/step-map.yaml` | 旧 `workflow.yaml` |
| `packs/official-ai-video/workflow/indexes/capability-index.md` | 原工作流中的审核、变更传播、修复、模型治理、成本治理、总控等成熟设计，以及后续项目中“局部修改后自动核对上下游并对话回报”的机制提炼 |
| `packs/official-ai-video/skills-longform/film-workflow.md` | 旧总路由技能、旧规则入口、旧中文 skills 导航 |
| `packs/official-ai-video/skills-longform/film-planner.md` | 旧 Step 1 技能、旧 Step 1 中文文档 |
| `packs/official-ai-video/skills-longform/film-setter.md` | 旧 Step 2 技能、旧 Step 2 中文文档 |
| `packs/official-ai-video/skills-longform/film-storyboarder.md` | 旧 Step 3 技能、旧 Step 3 中文文档 |
| `packs/official-ai-video/skills-longform/film-image-prompter.md` | 旧 Step 4 技能、旧 Step 4 中文文档、旧图片模板 |
| `packs/official-ai-video/skills-longform/film-video-prompter.md` | 旧 Step 5 技能、旧 Step 5 中文文档、旧视频模板、后续 Step 5 调整计划 |
| `packs/official-ai-video/skills-longform/film-producer.md` | 旧 Step 6 技能、旧 Step 6 中文文档 |
| `packs/official-ai-video/skills/*/SKILL.md` | 旧 `.trae/skills/*/SKILL.md`、旧目录化 skill 包、原生 IDE 触发说明与技能识别入口习惯 |
| `packs/official-ai-video/templates/*.md` | 旧模板目录与对应步骤说明，以及后续项目中可复用的增强流程回报结构 |
| `packs/official-ai-video/ide-integrations/*` | 旧工具入口形态、原始仓库中的规则接入方式、既有目录化接入习惯 |
| 项目级配置与 starter/scaffold | 旧 `workflow.yaml`、原始项目目录结构、旧需求文档中的目录与边界信息 |

## 3. 关键旧来源清单

以下旧来源被实际吸收并中立化：

- `<source-project-root>/.trae/skills/*/SKILL.md`
- `<source-project-root>/.cursor/rules/ai-film-workflow.mdc`
- `<source-project-root>/.codex/skills/*/SKILL.md`
- `<source-project-root>/skills/*.md`
- `<source-project-root>/skills/templates/*.md`
- `<source-project-root>/AI短片制作全流程3_0_1.md`
- `<source-project-root>/workflow.yaml`
- `<source-project-root>/README.md`
- `<source-project-root>/.trae/specs/consolidate-ai-workflow-into-trae/spec.md`
- `<source-project-root>/.trae/specs/consolidate-ai-workflow-into-trae/checklist.md`
- `<source-project-root>/.trae/specs/consolidate-ai-workflow-into-trae/tasks.md`
- `<source-project-root>/.trae/documents/提示词工作流重构需求文档_2026-04-03.md`
- `<source-project-root>/.trae/documents/plan_视频提示词去细节化与引用改造_加地面汇合_2026-04-05.md`
- `<source-project-root>/.trae/documents/plan_视频提示词扩充与对应核对_L03-L05_2026-04-05.md`

## 4. 明确排除的内容

以下内容没有进入中立包正文：

- `01_策划/` 到 `06_生产清单/` 的具体项目产物
- `log/`
- `.filmworkflow/`
- `.trae/documents/迁移接力包/*`
- `plan_*.md` 中的项目专属叙事、镜号、场景名、人物名和落地产物清单
- 一切绝对路径、具体项目名、具体角色名、具体剧情设定

## 5. 中立化处理原则

旧来源在进入新包时统一经过以下处理：

- 去项目专属信息
- 去固定工具目录依赖
- 去多权威入口表述
- 保留步骤边界、平台默认值、质量门槛与通用模板
- 把长文规则源和目录化 skill 包明确拆层
- 把后续 Step 5 调整提炼成通用规则，而不是保留原始计划文本
