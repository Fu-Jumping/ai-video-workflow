# 00 项目上下文

## 1. 这个仓库是什么

`ai-video-workflow` 是一个开源**产品仓库（工具仓库）**，把一套可复用的 AI 视频创作工作流做成产品。它由五部分组成（README.md "Product Shape"）：

- `packs/official-ai-video/` —— 官方工作流包（母版源）：规则、模板、skills、质量门槛、checks。
- `apps/cli/` —— TypeScript CLI：init / sync / verify / doctor / impact / deviation / research / export-obsidian / verify-obsidian / clean-view / rebuild-view / mcp-context / mcp-server / new-pack / libtv 子命令族。
- `docs/` —— 双语 VitePress 文档站（en / zh）+ 实施计划目录（plans）+ 本上下文工程目录。
- `examples/` —— 公开示例创作项目（`官方示例-云上早市` 是 CI 验证对象；另有 `official-mini-film`、`libtv`）。
- `scaffolds/workflow-pack/` —— 新 pack 脚手架。

`[AVW 专用]` 本仓库**不是创作项目**。创作项目由 CLI `init` 在工具仓库之外生成（见 `docs/zh/quickstart/beginner-agent-init.md`）。不要在工具仓库根目录创建 Step 目录或运行 `init`。

## 2. 双仓模型与事实源分层 `[AVW 专用]`

| 层 | 位置 | 角色 |
| --- | --- | --- |
| 母版源 | `packs/official-ai-video/` | 规则、模板、skill、质量门槛、checks 的唯一权威来源 |
| 创作项目源文件 | 创作项目内 `00_前期研究/` ~ `07_发布物料/` 的 Markdown | 创作事实源（project-step-files） |
| IDE 运行镜像 | 创作项目内 `.codex/`、`.cursor/`、`.claude/`、`.trae/` | 由 `sync` 按固定映射生成的运行表面，**不是第二套规则**（`WORKFLOW_OVERVIEW.md` §2.4） |
| Obsidian 观看层 | 创作项目内 `_views/obsidian/` | 生成的浏览/审阅投影，**不是事实源**；Obsidian 只打开这个目录 |
| LibTV 执行面 | 创作项目内 `.libtv/`、`outputs/` | gitignored 本地执行状态与产物，**不是事实源** |
| 宿主表面 | `SOUL.md`、`USER.md`、`memory/`（Cherry Studio 等） | 智能体宿主文件，保留但不当项目事实源 |

skill 双层：`packs/official-ai-video/skills-longform/*.md` 是内容源；`packs/official-ai-video/skills/<skill>/SKILL.md` 是打包层；长文源优先（`packs/official-ai-video/workflow/workflow-spec.md` §2.1）。

## 3. 生命周期一句话

工具仓库的生命周期：维护母包与 CLI → 用户（或 Agent 代跑）用 CLI 在别处创建创作项目 → 创作项目沿 Step 0-7 推进（见 [02-workflow-map.md](./02-workflow-map.md)）→ 用 verify/doctor/Obsidian/LibTV/MCP 等表面校验、审阅与执行 → 项目经验回流母包规则。

## 4. 生成产物与不应提交的内容 `[AVW 专用]`

依据仓库根 `.gitignore` 与示例项目 `.gitignore`，以下属于生成产物或本地表面，不属于规范来源：

- 构建产物：`node_modules/`、`dist/`、`docs/.vitepress/cache|dist/`、`coverage/`。
- 临时目录：`tmp/`、`.tmp/`、`temp/`、`*.log`。
- 创作项目本地表面：`_views/`、`.obsidian/`、`.libtv/`、`outputs/`、`SOUL.md`、`USER.md`、`memory/`。
- 研究原始采集：raw captures、媒体文件、完整评论转储、浏览器 profile、cookie（Step 0 边界，README.md "Step 0 Research"）。
- 注意：新建的 `docs/plans/*.md` 也被 gitignore（历史 22 份已被跟踪）——计划类文档入库需放别处（如本目录）。`[待确认]`（详见 [07-decisions-and-open-questions.md](./07-decisions-and-open-questions.md)）

规范来源 vs 示例：`packs/` 是规范；`examples/官方示例-云上早市` 是**受 CI 验证的示例**，既是对规范的示范也是测试夹具，修改它需走 `pnpm example:verify` 验证。

## 5. 修改边界

### 5.1 维护本仓库时的边界 `[通用规则]`

1. 改任何规则、模板、索引、平台口径、skill 或质量门槛后，必须同步运行镜像并保证一致性（`packs/official-ai-video/workflow/workflow-spec.md` §10）。
2. 改 skill 时长文源与技能包必须同时更新（quality-gates.md §1.1）。
3. 母包中不写死项目专属编号、场景名或阶段性统计数字（workflow-spec.md §10）。
4. 文档跳转只用相对路径，不用绝对路径、盘符、`file://`、IDE 专属 URI（quality-gates.md §7）。
5. docs/ 内文件**不得用 Markdown 链接指向 docs/ 外部**（VitePress 构建死链失败）；外部引用用反引号路径文本。`[AVW 专用]`

### 5.2 支持创作项目时的边界 `[AVW 专用]`

1. Step 3 与 Step 4 保持帧级对齐；Step 4 文件合同（快速导读 / 中文完整版本 / 可复制提示词）完整；默认增强流程；只使用相对链接（项目级 `AGENTS.md` 全局规则）。
2. 下游不得补造与上游冲突的事实；上游错误回上游修（workflow-spec.md §3）。
3. 对外交付层不用项目内部代号；不用"同上/参考前文"式偷继承（quality-gates.md §1）。
4. adapter（Obsidian/LibTV/MCP/各 IDE）不创建第二套工作流、不绕过 Step3/4 对齐、不破坏 Step 4 合同（`docs/zh/contributors/adapter-boundaries.md`）。

## 6. 必须先经用户确认的操作 `[通用规则]`

1. **消耗生成额度**的任何操作：图片/视频生成、LibTV 真实执行（仓库根 `AGENTS.md` Testing 第 8 条）。工具侧硬闸：`libtv refine` 触发真实生成，CLI 强制显式 `--allow-generation`，不传即拒绝执行。
2. **破坏性操作**：`export-obsidian --force`、`clean-view`（非 dry-run）、删除/重置文件、强制覆盖。
3. **修改已完成的步骤内容**：先做影响分析并把结果回报对话，确认后再动（quality-gates.md §1；流程见 `docs/zh/workflow/impact-analysis.md`）。
4. **登记偏离 / 放宽默认**：写 `deviations.yaml`、放宽 Step 5 单镜 15 秒默认等。
5. **提交与推送**：未经用户明确要求不 commit / push。
6. 修复方向若与"模板与文档服从校验器合同"原则相反（要改校验器迁就模板），需确认（`FIX_PLAN.md` 修复原则）。

## 7. 硬门槛速查（出处：`WORKFLOW_OVERVIEW.md` §7 与 quality-gates.md）

- 对外交付层正文/标题出现项目内部代号 → 硬失败。
- Step 4 正文出现心理词、导演解释、上下文依赖、模板残句 → 硬失败。
- 单个 Step 4 文件混写两个不兼容稳定状态 → 硬失败。
- Step 3/4 四层（Step 3 总表、Step 3 镜头卡、Step 4 总表、Step 4 单文件）互相对不上 → 硬失败。
- 偷继承写法代替可见事实 → 硬失败。
- 阶段性统计数字写成母包固定规则 → 硬失败。

## 8. 支持的平台（README.md "v0.2 Verification"）

图片/视频平台：`openai`、`gpt-image-2`、`veo`、`runway`、`luma`、`minimax`、`seedance`、`midjourney`。其中 `gpt-image-2` 经 LibTV `lib-image-2` 执行；`midjourney` 仅配置注册，生图仍在平台本体。默认视频平台 Seedance（2.0 全能参考模式）。不要臆造未列出的平台或模型名。`[AVW 专用]`
