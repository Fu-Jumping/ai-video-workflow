import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { createPackScaffold } from "../src/lib/new-pack.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

describe("createPackScaffold", () => {
  test("creates a new workflow pack scaffold with checks and Step 6 templates", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-pack-"));
    tempRoots.push(root);

    await createPackScaffold({
      targetRoot: root,
      packName: "custom-pack"
    });

    const packRoot = path.join(root, "custom-pack");
    await expect(fs.pathExists(path.join(packRoot, "pack.yaml"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(packRoot, "checks", "required-files.yaml"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(packRoot, "templates", "06_execution_plan", "02_video_execution_plan.md"))).resolves.toBe(true);
  });
});
