# 06 验证门禁

## 1. 命令清单（工具仓库侧） `[AVW 专用]`

| 命令 | 覆盖 | 备注 |
| --- | --- | --- |
| `pnpm build` | CLI 构建 + 文档站构建 | docs:build 含 VitePress 死链检查 |
| `pnpm test` | apps/cli 全部 vitest 套件 | 测试会引导官方示例 IDE 运行镜像，干净克隆可直接跑 |
| `pnpm example:verify` | 官方示例 sync + verify | |
| `pnpm verify:v0.2` | build + test + example:verify 合一 | 提交前全量门禁 |
| `pnpm example:obsidian` / `:ui` / `:in-project` | Obsidian 投影导出 + 校验 | 人工 QA 打开 `examples/官方示例-云上早市/_views/obsidian/`，不要打开项目根 |
| `pnpm example:mcp-context` | MCP 只读上下文烟测 | 不适合需要退出的脚本 |
| `git diff --check` | 空白错误检查 | 提交前 |

**串行约束**：涉及 `apps/cli/dist` 的命令必须串行执行；并行跑会造成误报（`docs/zh/contributors/testing.md`）。

**CI**：`.github/workflows/ci.yml` = verify:v0.2 + LibTV adapter mock 测试（ubuntu / node 24 / pnpm 10）。

## 2. 变更类型 × 验证矩阵 `[通用规则]`

| 变更类型 | 最小验证 | 完整验证 |
| --- | --- | --- |
| 仅 docs/ 文档 | `pnpm docs:build`（死链） | 人审中英文一致性 |
| 模板（packs/.../templates/） | `pnpm build && pnpm test`（template-compliance） | `pnpm verify:v0.2`（"照抄即合规"） |
| 规范/skill 正文（packs/） | 同步长文源与技能包 → `pnpm test` | `pnpm verify:v0.2` + 镜像同步检查 |
| CLI 代码（apps/cli/src/） | `pnpm build && pnpm test` | `pnpm verify:v0.2` + 新增回归测试 |
| 平台口径 / 枚举 | 相关专项测试 | verify:v0.2 + 文档口径 grep 核对 |
| 官方示例（examples/官方示例-云上早市/） | `pnpm example:verify` | + obsidian in-project 校验 |
| adapter（obsidian/libtv/mcp） | 对应 adapter 测试 | verify:v0.2 + libtv mock 测试 |
| 创作项目 Step 文件（项目侧） | `verify --step N` | 全量 `verify` + 人审内容门槛 |
| 上游步骤内容修改（项目侧） | 影响分析回报 → `verify` | 观看层 `export-obsidian` + `verify-obsidian` |

## 3. 三层测试体系 `[AVW 专用]`

1. **单元 / 集成测试**：`apps/cli/tests/*.test.ts`（verify/sync/init/impact/deviations/obsidian/libtv（含 plan/apply/order/refine）/mcp/template-compliance 等 30+ 套件）。跑法：`pnpm test`。
2. **工作流集成测试**：以官方示例为夹具走真实命令链（sync → verify → export-obsidian → verify-obsidian / mcp-context）。跑法：`pnpm example:verify`、`pnpm example:obsidian:in-project`、`pnpm example:mcp-context`。
3. **隔离端到端测试**：见 §4；只有用户要求测试/复测/端到端验证时启动。

## 4. 隔离端到端测试方法论（对齐 avw-isolated-e2e-testing） `[AVW 专用]`

完整方法论以机器全局 skill `avw-isolated-e2e-testing` 为准（仓库根 `AGENTS.md` Testing 章节强制引用）；本节沉淀执行要点：

### 4.1 隔离红线（不可妥协）

1. 测试环境（子代理）上下文只有三样：仓库链接、测试目录、初期构想输入；不得出现参考项目素材、已有产物、历史测试结论。
2. 测试方必须从链接 `git clone` 自行初始化；修复未推送远程时，用本地裸仓库镜像 + 分支指向修复提交来模拟"已发布"。
3. 构想只到"整体想法"层（主题、风格、规格、制作链路、锚点示例），不含具体名单、提示词、工作流策略；明确每主题镜数避免体量歧义。
4. 内容比对只在测试结束后由主环境完成；测试方不与已有产物比对。
5. 测试前确认被测提交（`git log --oneline -1`），报告显著标注被测版本。
6. 如实记录：中断/失败必须说明做到哪一步、卡在哪。

### 4.2 编排流程（AGENTS.md Testing 必守过程）

主对话 = 编排者：准备隔离目录（`G:\develop-G\tests\` 下新建子文件夹，命名 `avw-<轮次>-e2e-<日期>` 或 `avw-retest-<日期>`）→ 准备初期构想文件 → 准备裸镜像/仓库链接 → 启动 general-purpose 子代理（任务书自包含且只含：仓库链接、测试目录、构想路径、场景清单、报告要求）→ 子代理返回后由主对话做比对、问题分类、终审。

子代理任务书**不得**包含：本地工作树作为源、参考项目材料、历史测试报告、既有生产产物。

**提示词格式**（AGENTS.md）：主对话测试提示词用**单个文本代码块**交付；块内不嵌套三引号；命令路径用缩进或纯文本；子代理任务书与主提示同块交付、清晰分隔。

### 4.3 场景类型

- **R1 主链路**：克隆 → 通读文档 → install/build → 官方验证 → init → Step 0-6 全流程（每步校验）→ Obsidian 导出校验。
- **R2 审核修改链路**：每步 2-4 条内容级意见 → 修改 → 复核；中途换人联动；完成后改时长联动；整体重写；组合场景。
- **R3 真实环境走查**：模拟真实创作者 + 故意注入违规看工具是否抓到。
- **复测矩阵**：开箱类 / 数据类 / 校验类 / 检查类 / 模板类 / 防御类 / 文档类——逐修复点给"复测方法 + 证据"。

### 4.4 "已发布远端"模拟的标准命令序列 `[AVW 专用]`

修复未推送远程时，用本地快照 + 裸镜像构造"克隆已发布状态"，全程不移动本地 HEAD、不产生本地分支提交（Git Bash 示例）：

```text
TESTDIR="/g/develop-G/tests/<本轮目录>"
mkdir -p "$TESTDIR"

cd /g/develop-G/ai-video-workflow
git add -A                                  # 快照暂存（结束前 reset，不影响工作树）
TREE=$(git write-tree)
git reset -q
COMMIT=$(git commit-tree "$TREE" -p HEAD -m "temp: snapshot for isolated retest")

git init --bare "$TESTDIR/remote-mirror.git" -q
git push -q "$TESTDIR/remote-mirror.git" "$COMMIT":refs/heads/master
git --git-dir="$TESTDIR/remote-mirror.git" symbolic-ref HEAD refs/heads/master

git clone -q "$TESTDIR/remote-mirror.git" "$TESTDIR/clone"   # 测试方只接触这个克隆
```

要点：测试方（子代理或脚本）只从 `remote-mirror.git` 克隆，看到的即是"已发布"状态；比对与终审由主环境在测试结束后完成。

### 4.5 红线补充

- 不生成、不消耗任何生成额度，除非用户明确允许。
- 版本模拟技巧（裸镜像 + symbolic-ref）、Windows/Git Bash 已知坑（UTF-8、CRLF、串行）、报告模板见 skill 原文；报告骨架另见 [templates/isolated-test-report.md](./templates/isolated-test-report.md)。

## 5. 诚实报告要求 `[通用规则]`

1. **`verify` 通过 ≠ 内容达标**（quality-gates.md §1.3）：心理词、导演解释、上下文依赖、偷继承、可复制版缩水、中英文语义对齐由人工/智能体审核把关。报告必须声明这一边界。
2. 无法执行的验证**明确标注原因**，不得伪造通过结果。
3. 验证前后各跑一次 `git status --short`，确认没有计划外修改或临时文件残留；`git diff --check` 提交前必过。
4. 环境性偶发失败先重跑复核（历史上有 vitest 瞬时失败记录，`FIX_PLAN.md` F13），仍失败才报告为问题。
