# AGENTS

Use the `official-ai-video` pack as the default workflow pack.

- Keep Step 3 and Step 4 frame-aligned.
- Keep Step 4 file contracts intact.
- Default to enhanced flow unless a project explicitly disables it.
- Use relative links only.

## Testing

- Any test, retest, or end-to-end verification of this repository must follow the machine-global skill `avw-isolated-e2e-testing`.
- In isolated E2E testing, the test agent may only receive: the repository link, a fresh test directory, and an initial idea/input file. It must not use the local working copy as its direct project source, and must not compare against existing production outputs or reference project materials.
