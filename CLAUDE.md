# CLAUDE

This repository treats the workflow as a product.

- Default pack: `official-ai-video`
- Step 6 is an execution plan system.
- Codex must keep a full runtime mirror and a runtime skills layer.
- Relative links only.

Project map, task routing, and verification gates for agents live in `docs/context-engineering/` (start from its README). When rules conflict, `packs/official-ai-video/workflow/workflow-spec.md` wins; context-engineering docs are maps, not a second spec.

## Testing

### Required method

Any testing/retesting/end-to-end verification must follow the machine-global skill `avw-isolated-e2e-testing`.

### Orchestration flow

1. The main conversation is the orchestrator.
2. It prepares an isolated test directory, initial idea file, repository link or bare mirror, and any external test config.
3. It starts a general-purpose subagent with a self-contained task book.
4. The subagent task book contains only repository link, test directory, idea path, scenario list, and report requirements.
5. The subagent must clone/initialize from the link, not use the local working tree as its source.
6. The subagent must not see reference materials, old reports, or existing outputs.
7. After the subagent finishes, the main conversation performs comparison and final review.

### Prompt formatting rules

- The main-conversation test prompt must be delivered as one single text code block.
- Never nest triple backticks inside that block.
- Commands and paths inside the block should be indented or plain text.
- The subagent task book should be included inside the same single block when delivering the main prompt.
- The subagent task book must remain free of reference project information.
