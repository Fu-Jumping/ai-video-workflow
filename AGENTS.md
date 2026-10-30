# AGENTS

Use the `official-ai-video` pack as the default workflow pack.

- Keep Step 3 and Step 4 frame-aligned.
- Keep Step 4 file contracts intact.
- Default to enhanced flow unless a project explicitly disables it.
- Use relative links only.
- 提交信息（标题与正文）一律使用简体中文，保留 conventional 类型前缀、代码标识符、路径与 Q/H/D/F 编号（D11）。

## 项目上下文工程（Context Engineering）

所有 Agent 的项目地图、任务路由与验证门禁位于 `docs/context-engineering/`。首次进入本仓库先读其 README（3 分钟上手路径）：

1. `docs/context-engineering/00-project-context.md` —— 仓库身份、修改边界、必须确认的操作。
2. `docs/context-engineering/05-task-routing.md` —— 任务类型 → 应读文档 → 可改文件 → 必须验证。
3. `docs/context-engineering/06-verification-gates.md` —— 改完之后如何验证。

规则冲突时以 `packs/official-ai-video/workflow/workflow-spec.md` 为最高解释顺序；上下文工程文档只是地图，不是第二份规范。

## 必须停止并请求用户确认的场景

- 任何消耗生成额度的操作（图片/视频生成、LibTV 真实执行）。
- 破坏性操作（`--force` 删除、重置、覆盖用户文件）。
- 修改已完成的步骤内容（先做影响分析并回报）。
- Step 1 创作决策未确认：进入 Step 1 先完成决策访谈（`01_概念策划/00_决策记录.md`），P0 决策未确认或未获用户委托前不写故事内核与剧本正文。
- 登记偏离（deviations.yaml）或放宽默认契约。
- commit / push。
- 发现规则与实际代码或文档不一致：登记到 `docs/context-engineering/07-decisions-and-open-questions.md` 并报告，不擅自修改业务行为。

## 对话引导（新手保障）

- 用户首次接触或咨询型输入时：先用两三句介绍工作位置模型（本仓库是工具仓库，只用于维护工作流产品本身；创作项目由 CLI 在别处生成，创作工作全部在项目目录内进行），再给出下一步选项。
- 每个实质性回复末尾以块引用附两行状态脚注：`> **【当前】** <位置与状态>` 与 `> **【下一步】** <具体动作>`，每行只说一件事。
- 引导只指向真实存在的命令、文件与门禁，不复述门禁正文；完整口径见 `docs/context-engineering/09-conversation-guidance.md`。

## 阶段工作树规则（多阶段并行开发）

- **先建工作树，再写提示词**：任何交给阶段执行对话的任务书，必须在对应工作树已创建、且起点提交已现场核验之后才允许交付；不得先交付提示词、再让执行方自行建树。
- 建树前先只读核对四项：`git worktree list --porcelain`、`git for-each-ref refs/heads`、目标路径是否已存在、目标分支是否已存在。任一冲突即停下报告，不复用、不覆盖、不改名绕过。
- 建树后立刻记录并写入任务书：工作树绝对路径、阶段分支名、base HEAD（必须等于主分支现场 HEAD）。
- 一阶段一工作树；主工作区只作集成目标，不在主工作区直接实现阶段任务。
- 阶段结果经用户审核并通过独立检查后才合并回目标分支；不推送远端。
- 阶段合并完成后删除该阶段工作树与阶段分支（`git worktree remove` + `git branch -d`），保持目录清爽；删除前确认工作区已干净、结果已合入目标分支。

## Testing

### Trigger

When the user says they want to test, retest, or run end-to-end verification, follow the machine-global skill `avw-isolated-e2e-testing`. Do not improvise a separate test method.

### Required process

1. Load and read `avw-isolated-e2e-testing`.
2. Act as the main/orchestrator conversation.
3. Prepare an isolated test context:
   - A fresh test directory under the machine's test root `develop-G\tests\` on the data drive (machine mapping registered in `docs/context-engineering/07-decisions-and-open-questions.md` D12; current machine: `E:\develop-G\tests\`).
   - An initial idea file.
   - A repository link or a local bare-mirror link that simulates the published remote.
   - A test config file if a real external resource (for example a LibTV test canvas) is needed.
4. Start a `general-purpose` subagent with a self-contained task book.
5. The subagent task book may contain only:
   - repository link
   - test directory
   - initial idea path
   - scenario list
   - report requirements
6. The subagent must not receive:
   - the local working tree as its project source
   - reference project materials
   - historical test reports
   - existing production outputs
7. After the subagent returns, the main conversation performs comparison, review, issue classification, and final report.
8. Do not generate or consume credits unless the user explicitly allows it.

### Prompt formatting rules

- A main-conversation test prompt should be delivered as **one single text code block**.
- Do not nest triple backticks inside that block.
- Use indentation or plain text for commands and paths inside the block.
- Separate the main prompt from the subagent task book clearly, but keep both inside the same single code block when delivering the main prompt.
- The subagent task book should be self-contained and must not include reference project information.
