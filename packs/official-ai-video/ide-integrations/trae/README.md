# Trae Adapter

## 1. 目标

把 `ai-video-workflow` 的中立母版内容转化到 Trae 可读取的原生目录。转化完成后，`.trae/` 是当前项目的 Trae 运行时入口；`packs/official-ai-video/` 继续保留为分发包母版源。

## 2. 转化目标目录

若要把分发包转化为 Trae 原生可读结构，目标目录应是项目根下的 `.trae/`。

推荐落位：

- `.trae/skills/`
  - 放可识别的 skill 运行包
  - 目录形式固定为 `.trae/skills/<skill>/SKILL.md`
- `.trae/specs/ai-video-workflow/`
  - 放工作流主规范、质量门槛和 workflow 模板
- `.trae/documents/ai-video-workflow/`
  - 放详细总览、初始化指南、索引、模板和长文 skill 源镜像

`.trae/` 是 Trae 在当前项目中的原生运行目录。Trae 若要稳定识别技能，核心内容必须进入 `.trae/skills/` 等原生位置。

## 3. 检测顺序

开始前先检测以下入口是否已经存在：

1. `.trae/`
2. `.trae/skills/`
3. `.trae/specs/`
4. `.trae/documents/`

若原生入口已经存在，则沿用现有结构转化。若原生入口不存在，但目标是正式启用 Trae 工作流，则应按本页推荐结构创建 `.trae/` 后再转化。不要先入为主假定某个隐藏目录一定存在，但也不要把“目录不存在”误判成“无需转化”。

## 4. 推荐映射

若项目已经有 Trae 的原生技能结构，推荐这样映射：

- `.trae/skills/film-workflow/SKILL.md` <- `packs/official-ai-video/skills/film-workflow/SKILL.md`
- `.trae/skills/<step-skill>/SKILL.md` <- `packs/official-ai-video/skills/<step-skill>/SKILL.md`
- `.trae/specs/ai-video-workflow/` <- `packs/official-ai-video/workflow/*`
- `.trae/documents/ai-video-workflow/WORKFLOW_OVERVIEW.md` <- `WORKFLOW_OVERVIEW.md`
- `.trae/documents/ai-video-workflow/skills/` <- `packs/official-ai-video/skills-longform/*`
- `.trae/documents/ai-video-workflow/skill-bundles/` <- `packs/official-ai-video/skills/*`
- `.trae/documents/ai-video-workflow/indexes/` <- `packs/official-ai-video/workflow/indexes/*`
- `.trae/documents/ai-video-workflow/templates/` <- `packs/official-ai-video/templates/*`

## 5. 落位原则

- Trae 原生目录中的内容是项目运行时实际读取内容
- 分发包维护时不在 adapter 里另写第二套规则
- 若分发包母版更新，已启用的 `.trae/` 镜像也必须同步

## 5.1 职责分配

- `.trae/skills/`
  - 放步骤技能的可识别运行包
  - 每个 skill 一个目录，每个目录一个 `SKILL.md`
- `.trae/specs/ai-video-workflow/`
  - 放工作流主规范、质量门槛、workflow 模板
  - 适合放接近完整的规范镜像
- `.trae/documents/ai-video-workflow/`
  - 放总览、初始化指南、长文 skill 源、skill bundle 源、索引和模板镜像
  - 适合放供 AI 和人类快速理解的说明文档

## 5.2 镜像策略

- 规则入口优先用摘要镜像，避免在入口层堆过长正文
- 规范、模板和索引可以保留完整镜像
- skill 运行入口必须使用 `packs/official-ai-video/skills/` 的目录化输出，而不是直接平铺 `packs/official-ai-video/skills-longform/*.md`
- 若只能保留一份完整文本，优先保留 `WORKFLOW_OVERVIEW.md` 和 `AI初始化指南.md`

## 6. 未建立原生入口时

若当前项目没有 Trae 原生目录，则：

1. 若目标是正式启用 Trae 工作流，必须创建 `.trae/`，并把技能、规范、模板和索引按本页转化进去
2. 在 `.trae/skills/` 未建立前，不应假设 Trae 能识别这些技能
3. 若只复制了文档镜像，但没有 `.trae/skills/<skill>/SKILL.md`，视为技能尚未正式启用
4. `ai-video-workflow/` 在这时只能作为分发包和初始化参考，不是 Trae 的完整运行替代
5. 转化完成后，应改为从 `.trae/` 入口继续执行

## 7. 最小入口建议

若只保留一个 Trae 可见入口，建议它至少说明：

- `.trae/` 是当前项目的 Trae 运行入口
- 当前项目的目录映射文件在哪里
- 当前请求应先路由到哪个步骤

## 8. Adapter Contract

- 读取：`packs/official-ai-video/`、`project.config.yaml` 和项目 Step 1 到 Step 6 文件。
- 写入：`AGENTS.md` 兼容入口、`.trae/skills/` 技能入口、`.trae/rules/ai-video-workflow.md` 规则入口、`.trae/specs/ai-video-workflow/` 规范镜像和 `.trae/documents/ai-video-workflow/` 文档镜像。
- 文档镜像包括：`WORKFLOW_OVERVIEW.md`、`skills/`、`skill-bundles/`、`templates/` 和 `indexes/`。
- 同步方向：`runtime-mirror`。
- 事实源：`project-step-files`，而不是 `.trae/` 运行镜像。
- `sync --ide trae` 不生成 `CLAUDE.md`；Claude Code 入口只属于 `sync --ide claude-code`。
- 不能写入：源 Step 文件、生成的 Obsidian 投影文件、用户 `.obsidian/` 配置、`CLAUDE.md` 或绝对路径链接。
- 验证：`ai-video-workflow verify --project <path> --ide trae`。
