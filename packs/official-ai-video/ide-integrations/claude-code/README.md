# Claude Code Adapter

## 1. 目标

把 `ai-video-workflow` 的中立母版内容转化到 Claude Code 可读取的原生入口。转化完成后，`.claude/` 或 `CLAUDE.md` 是当前项目的 Claude Code 运行时入口；`packs/official-ai-video/` 继续保留为分发包母版源。

## 2. 转化目标目录

Claude Code 推荐优先转化到项目根下的 `.claude/`。如果团队不使用目录化布局，则可使用仓库级 `CLAUDE.md` 单文件入口。

推荐落位：

- `.claude/skills/`
  - 放目录化 skill 运行包
  - 目录形式固定为 `.claude/skills/<skill>/SKILL.md`
- `.claude/ai-video-workflow/`
  - 放详细总览、初始化指南、长文 skill 源、skill bundle、索引和模板镜像
- `.claude/commands/` 或团队现有命令目录
  - 放步骤级入口摘要
- `CLAUDE.md`
  - 作为 Claude Code 的总入口，指向 `.claude/ai-video-workflow/` 或当前项目中的 Claude 镜像内容

## 3. 检测顺序

开始前先检测以下入口是否存在：

1. `.claude/`
2. `CLAUDE.md`
3. 项目级 AI 协作说明文件
4. 已有的 Claude 相关命令目录

不要假定项目一定已经具备某种 Claude 目录结构。若当前目标是正式启用 Claude Code，而两种入口都不存在，则应创建 `.claude/` 或 `CLAUDE.md`。

## 4. 推荐映射

对 Claude Code，优先采用“单入口 + 指向包内主源”的方式：

- `CLAUDE.md` <- 总入口，只负责读取顺序和规则优先级
- `.claude/skills/<skill>/SKILL.md` <- `packs/official-ai-video/skills/<skill>/SKILL.md`
- `.claude/ai-video-workflow/WORKFLOW_OVERVIEW.md` <- `WORKFLOW_OVERVIEW.md`
- - `.claude/ai-video-workflow/workflow/` <- `packs/official-ai-video/workflow/*`
- `.claude/ai-video-workflow/skills/` <- `packs/official-ai-video/skills-longform/*`
- `.claude/ai-video-workflow/skill-bundles/` <- `packs/official-ai-video/skills/*`
- `.claude/ai-video-workflow/templates/` <- `packs/official-ai-video/templates/*`
- `.claude/ai-video-workflow/indexes/` <- `packs/official-ai-video/workflow/indexes/*`

若项目已有更细的 Claude 入口体系，再补：

- 步骤级摘要
- 模板级索引
- 当前项目目录映射说明

## 5. 落位原则

- Claude 的入口文件只做启动导航
- Claude 运行时应以 `.claude/` 或 `CLAUDE.md` 中的有效内容为准
- 项目目录绑定保持在 `scaffolds/` or project-level config
- 若使用目录化模式，则 `.claude/skills/` 才是 skill 的运行入口，不是 `.claude/ai-video-workflow/skills/`

## 5.1 职责分配

- `CLAUDE.md`
  - 只放启动顺序、规则优先级和当前项目绑定入口
  - 不放完整规范正文
- `.claude/ai-video-workflow/`
  - 放完整总览、初始化指南、长文 skill 源、skill bundle、模板镜像和索引镜像
- `.claude/skills/`
  - 放运行时可识别 skill 包
  - 每个 skill 一个目录，每个目录一个 `SKILL.md`
- `.claude/commands/`
  - 只放命令式入口摘要，不承担规范主源职责

## 5.2 镜像策略

- 单文件入口采用摘要镜像
- `.claude/ai-video-workflow/` 采用完整镜像
- `.claude/skills/` 采用目录化运行包
- 如果团队只愿意维护一个入口，则优先维护 `CLAUDE.md`；它本身就是 Claude Code 的原生运行入口之一

## 6. 未建立原生入口时

若项目没有现成 Claude 专用入口，则：

1. 若目标是正式启用 Claude Code，可创建 `.claude/`，也可直接建立 `CLAUDE.md`
2. `CLAUDE.md` 不是临时回退，而是 Claude Code 的正式原生单文件入口
3. 若采用目录化模式，还必须补齐 `.claude/skills/<skill>/SKILL.md`
4. 若两者都还不存在，`ai-video-workflow/` 只能先作为初始化参考；正式启用前至少要补齐 `.claude/` 或 `CLAUDE.md`

## 7. 最小入口建议

建议最少给 Claude 一个稳定入口，内容包括：

- 读取顺序
- 当前项目映射文件
- 当前 Claude 原生入口位置
- adapter 只做落位说明
