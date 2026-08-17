import path from "node:path";

import { syncProject } from "../src/lib/sync.js";

/**
 * Runs once before the whole vitest suite. Several test files verify or export the official
 * example project, which requires its `.codex/` runtime mirror. The mirror is gitignored and
 * therefore absent in a clean clone, so tests bootstrap it here. Without this setup,
 * `pnpm test` fails out of the box with `missing-ide-runtime` errors.
 */
export default async function globalSetup(): Promise<void> {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const projectRoot = path.join(repoRoot, "examples", "官方示例-云上早市");
  await syncProject({
    repoRoot,
    projectRoot,
    pack: "official-ai-video",
    ide: "codex"
  });
}
