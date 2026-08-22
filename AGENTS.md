# AGENTS

Use the `official-ai-video` pack as the default workflow pack.

- Keep Step 3 and Step 4 frame-aligned.
- Keep Step 4 file contracts intact.
- Default to enhanced flow unless a project explicitly disables it.
- Use relative links only.

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
