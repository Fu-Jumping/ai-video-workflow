# AGENTS

Use the `official-ai-video` pack as the default workflow pack.

- Keep Step 3 and Step 4 frame-aligned.
- Keep Step 4 file contracts intact.
- Default to enhanced flow unless a project explicitly disables it.
- Use relative links only.

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
- 登记偏离（deviations.yaml）或放宽默认契约。
- commit / push。
- 发现规则与实际代码或文档不一致：登记到 `docs/context-engineering/07-decisions-and-open-questions.md` 并报告，不擅自修改业务行为。

## 对话引导（新手保障）

- 用户首次接触或咨询型输入时：先用两三句介绍工作位置模型（本仓库是工具仓库，只用于维护工作流产品本身；创作项目由 CLI 在别处生成，创作工作全部在项目目录内进行），再给出下一步选项。
- 每个实质性回复末尾以块引用附两行状态脚注：`> **【当前】** <位置与状态>` 与 `> **【下一步】** <具体动作>`，每行只说一件事。
- 引导只指向真实存在的命令、文件与门禁，不复述门禁正文；完整口径见 `docs/context-engineering/09-conversation-guidance.md`。

## Testing

### Trigger

When the user says they want to test, retest, or run end-to-end verification, follow the machine-global skill `avw-isolated-e2e-testing`. Do not improvise a separate test method.

### Required process

1. Load and read `avw-isolated-e2e-testing`.
2. Act as the main/orchestrator conversation.
3. Prepare an isolated test context:
   - A fresh test directory under `G:\develop-G\tests\`.
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
