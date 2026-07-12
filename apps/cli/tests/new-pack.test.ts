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
  test.each([
    "",
    "   ",
    ".",
    "..",
    "../escaped-pack",
    "..\\escaped-pack",
    "nested/pack",
    "nested\\pack",
    "C:\\pack",
    "\\\\server\\share",
    "CON",
    "trailing-dot.",
    "trailing-space "
  ])("rejects unsafe pack directory name %j", async (packName) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-pack-name-"));
    tempRoots.push(root);
    const possibleTarget = path.resolve(root, packName);
    if (possibleTarget !== root && possibleTarget.startsWith(`${root}${path.sep}`)) {
      tempRoots.push(possibleTarget);
    }

    await expect(
      createPackScaffold({
        targetRoot: root,
        packName
      })
    ).rejects.toThrow();

    await expect(fs.pathExists(path.join(root, "pack.yaml"))).resolves.toBe(false);
  });

  test("rejects an existing file target without writing scaffold files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-pack-file-"));
    tempRoots.push(root);
    await fs.writeFile(path.join(root, "custom-pack"), "keep me", "utf8");

    await expect(
      createPackScaffold({
        targetRoot: root,
        packName: "custom-pack"
      })
    ).rejects.toThrow("not a directory");

    await expect(fs.readFile(path.join(root, "custom-pack"), "utf8")).resolves.toBe("keep me");
  });

  test("rejects a non-empty target directory without overwriting user files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-pack-non-empty-"));
    tempRoots.push(root);
    const packRoot = path.join(root, "custom-pack");
    await fs.ensureDir(packRoot);
    await fs.writeFile(path.join(packRoot, "README.md"), "# Existing pack\n", "utf8");

    await expect(
      createPackScaffold({
        targetRoot: root,
        packName: "custom-pack"
      })
    ).rejects.toThrow("not empty");

    await expect(fs.readFile(path.join(packRoot, "README.md"), "utf8")).resolves.toBe("# Existing pack\n");
    await expect(fs.pathExists(path.join(packRoot, "pack.yaml"))).resolves.toBe(false);
  });

  test("allows scaffolding into an existing empty directory", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-pack-empty-"));
    tempRoots.push(root);
    const packRoot = path.join(root, "custom-pack");
    await fs.ensureDir(packRoot);

    await createPackScaffold({
      targetRoot: root,
      packName: "custom-pack"
    });

    await expect(fs.pathExists(path.join(packRoot, "pack.yaml"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(packRoot, "checks", "required-files.yaml"))).resolves.toBe(true);
  });

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
