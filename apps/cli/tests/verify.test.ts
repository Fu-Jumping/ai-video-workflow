import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { verifyProject } from "../src/lib/verify.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

describe("verifyProject", () => {
  test("finds missing Step 6 files, invalid Step 4 contracts, and absolute path links", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-verify-"));
    tempRoots.push(root);

    const projectRoot = path.join(root, "bad-project");
    await fs.ensureDir(path.join(projectRoot, "04_image_prompts"));
    await fs.ensureDir(path.join(projectRoot, "06_execution_plan"));
    await fs.writeFile(
      path.join(projectRoot, "project.config.yaml"),
      [
        "pack: official-ai-video",
        "ide: codex",
        "platforms:",
        "  image:",
        "    default: openai",
        "workflow:",
        "  enhanced_flow:",
        "    enabled: true"
      ].join("\n"),
      "utf8"
    );
    await fs.writeFile(
      path.join(projectRoot, "04_image_prompts", "shot-01.md"),
      [
        "# Shot 01",
        "",
        "快速导读",
        "",
        "主体在夜色中前行。",
        "",
        "中文完整版本",
        "",
        "参考前文继续写，模型应自行理解剧情。",
        "",
        "[bad](G:\\absolute\\path.md)"
      ].join("\n"),
      "utf8"
    );

    const result = await verifyProject({
      projectRoot,
      ide: "codex",
      pack: "official-ai-video"
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "missing-step6-file",
        "missing-step4-section",
        "absolute-path-link",
        "step4-forbidden-text",
        "missing-video-default-platform"
      ])
    );
  });
});
