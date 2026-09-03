# 10 人工真实对话手动测试指南（从零开始）

本指南面向**亲自上手的人工测试者**（通常是维护者本人）：在一个隔离目录里从零克隆、安装、初始化，以真实对话逐步推进工作流，验证"新手第一次使用"的完整体验。`[AVW 专用]`

与隔离端到端测试的分工（方法论见 [06-verification-gates.md](./06-verification-gates.md) §4）：隔离 E2E 由子代理执行、可重复、零真人参与；人工真实对话测试补它覆盖不到的三件事——

1. **对话手感**：引导话术、状态脚注、门禁拦截在真实会话里是否自然、噪音是否可接受。静态断言与子代理 E2E 判不了"人觉得好不好用"。
2. **全局安装路径**：`npm install -g apps/cli` + `--project` 外挂命令。历史全部隔离 E2E 都以 `node dist/index.js` 代跑 CLI，此路径从未实测（见 [07-decisions-and-open-questions.md](./07-decisions-and-open-questions.md) Q16 终审偏差 2）。
3. **会话切换真实性**：初始化后"换目录、开新会话、项目内规则接管"的交接体验，只有真人能完整感知（口径见 [09-conversation-guidance.md](./09-conversation-guidance.md) §2）。

## 1. 开始前的检查清单

- `pnpm verify:v0.2` 全绿（build + vitest + example:verify）。
- 被测改动已提交：`git status` 干净（`.zcode/` 等本地表面文件除外）。
- 明确本轮范围：**最小轮**（M1-M5，约 30 分钟）或**完整轮**（M1-M8）；M9（LibTV）默认不做。
- 若本轮含 LibTV 真实执行：先确认额度预算并获得明确批准（默认零额度，红线见 §5）。

## 2. 准备隔离现场（约 10 分钟）

### 2.1 测试目录与构想文件

```text
G:\develop-G\tests\avw-manual-YYYYMMDD\
├── idea.md          # 初期构想（见下）
└── REPORT.md        # 边测边记（见 §4）
```

`idea.md` 示例（只到"整体想法"层，写明镜数，不含具体提示词与名单，对齐 06 §4.1 红线）：

```text
主题：深夜便利店的一碗关东煮
规格：竖屏 9:16，30 秒，4 个镜头
风格：胶片质感、暖光、生活流
制作链路：Seedance 视频平台，从 Step 0 研究开始
锚点示例：收银台蒸汽特写
```

### 2.2 获取被测版本（模拟"已发布远端"）

二选一：

- **开箱保真（推荐）**：按 [06-verification-gates.md](./06-verification-gates.md) §4.4 的标准序列做本地快照 + 裸镜像，再从镜像 clone；测完记得 `git reset` 还原主仓库暂存区。
- **行为抽查（快速）**：直接 `git clone` 本仓库到测试目录（克隆的是已提交状态，工作树未提交内容不会进入克隆）。

克隆完成后记录被测版本（`git log --oneline -1`），写进报告标题。

### 2.3 构建 + 全局安装（本轮重点路径）

```text
cd <测试目录>\clone
pnpm install
pnpm build
npm install -g apps/cli
ai-video-workflow --version
```

期望：`--version` 正常输出；任意目录 `ai-video-workflow --help` 可用。若全局安装或命令解析失败，立即记为发现（定级：严重）——这正是本路径首次实测要抓的问题。

## 3. 场景清单（按序执行）

每个场景记录四件事：你的原话、智能体回复的**关键逐字**（尤其脚注两行）、实际执行的命令与退出码、主观体验（顺畅/卡顿/噪音）。脚注格式权威见 [09-conversation-guidance.md](./09-conversation-guidance.md) §2。

### M1 首触咨询

- 操作：在 clone 目录打开一个**全新对话**，问："这是什么？我能用它做什么？从哪开始？"
- 期望：两三句"车间/菜"工作位置定位（工具仓库 vs 创作项目）；给出下一步选项；回复末尾两行块引用脚注 `> **【当前】** …` / `> **【下一步】** …`，每行只说一件事。

### M2 工具仓库写剧本（纠偏）

- 操作：接着说"别麻烦了，你直接在这里帮我写个剧本"。
- 期望：明确拒绝（工具仓库里不写创作内容），引导走 `init`；脚注正常。

### M3 初始化护航（逐项询问分支）

- 操作：同意初始化，但**只告诉它项目名**，其余信息（位置、智能体工具、图片/视频平台、起始步）不给，观察是否逐项询问。
- 期望：依赖检查 → 逐项询问 → 真实执行 `init` → 报告项目落点；最终回复讲清**交接三步**（项目建在哪 / 换目录开新会话且规则由项目接管 / 命令外挂 `--project`），并附 init 内置的"第一句话"模板；脚注正常。流程权威见 `docs/zh/quickstart/beginner-agent-init.md`。

### M4 换目录开新会话（交接真实性）

- 操作：亲手按交接三步做——在创作项目目录打开新会话，把"第一句话"模板粘进去。
- 期望：新会话按项目内规则工作，不再表现工具仓库身份；脚注按所处步骤与校验状态描述。

### M5 全局命令外挂

- 操作：在创作项目目录运行 `ai-video-workflow verify --project <本项目路径> --step 0`。
- 期望：Step 0 门禁真实工作（缺研究文件时报可读错误，而非静默通过）；`--step` 分步语义与文档一致。

### M6 推进 Step 0 与门禁拦截

- 操作：按项目内引导填写 `00_前期研究/` 起步文件，然后让智能体"直接进下一步"。
- 期望：推进前被提醒先 `verify --step <N>`，校验通过 + 对应人工审核后才放行；"填完就想跳过校验"被挡。

### M7 校验失败分类处置（偏离路线）

- 操作 A：故意留一处内容错误（如 Step 2 结构不合模板），观察引导方向。
- 操作 B：提出一个合理偏离（如"这个镜头走轻量模式，不建关键帧"），观察是否引导 `deviation add` 带 reason 显式登记。
- 期望：两类失败走向不同——内容问题引导回步骤源文件修复；合理偏离引导显式登记（`deviation add` / `set-mode` / `set-shot-mode`），未登记不得静默绕过；登记后脚注出现偏离状态。口径见 [09-conversation-guidance.md](./09-conversation-guidance.md) §5。

### M8 Obsidian 观看层（可选）

- 操作：让项目内智能体引导导出，或终端运行 `ai-video-workflow export-obsidian --project <项目路径> --in-project-view`，再 `verify-obsidian --project <项目路径> --in-project-view`。
- 期望：`_views/obsidian/` 生成且校验通过；引导强调"这是生成的观看投影，不是事实源"。

### M9 LibTV 真实执行（可选，默认不做）

前置：`libtv login` 刷新凭据（本机凭据曾于 2026-08-28 疑似过期）；真实调用前 stderr 应出现一行凭据来源提示（预期行为，见 Q13）。

- 先全程 `--mock` 走 plan / apply / review 流程；
- 抽查硬闸：`libtv apply`（不带 `--allow-generation`）应被拒绝；`libtv project delete`（不带 `--yes`）应被拒绝；
- 真实生成必须获明确批准后只跑最小用例，并记录消耗。

## 4. 记录、评级与问题处置

- 报告写到测试目录 `REPORT.md`，骨架参照 [templates/isolated-test-report.md](./templates/isolated-test-report.md)（场景 × 期望 × 实际 × 判定），标题标注被测版本。
- 评级口径：**可用**（无阻塞残留）/ **有残留**（每条定级：严重 / 一般 / 提示）。
- `verify` 通过 ≠ 内容达标：内容质量的人工审核结论必须写进报告（见 [06-verification-gates.md](./06-verification-gates.md) §5）。
- 发现问题先停下报告，不擅自修改：
  - 规则与实际代码/文档不一致 → 按 [07-decisions-and-open-questions.md](./07-decisions-and-open-questions.md) §3 登记 Q 编号；
  - 缺陷修复 → 按 `FIX_PLAN.md` 既有格式追加条目，动手前需确认。

## 5. 红线与常见坑

- 工具仓库里不 init、不写创作内容；创作只发生在测试项目目录。
- 零额度原则：除非明确批准，不触发任何图片/视频生成。LibTV 文件凭据是**机器全局作用域**（任意目录裸调用都生效），需要隔离时用 `LIBTV_CONFIG_DIR` 指向空目录。
- Windows 坑：控制台中文乱码用 UTF-8（如 `chcp 65001`）或改用 Git Bash；CRLF 警告属正常；命令串行执行。
- 用 §2.2 快照序列测完后：主仓库 `git reset` 还原暂存区，`git status` 确认干净，临时快照提交无需清理（未被任何分支引用，会被 GC）。
