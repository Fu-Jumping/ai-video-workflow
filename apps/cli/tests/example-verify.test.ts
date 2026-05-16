import path from "node:path";
import { describe, expect, test } from "vitest";

import { verifyProject } from "../src/lib/verify.js";

describe("official example", () => {
  test("official-mini-film passes codex verification", async () => {
    const projectRoot = path.resolve(__dirname, "../../../examples/official-mini-film");

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result).toEqual({ ok: true, issues: [] });
  });
});
