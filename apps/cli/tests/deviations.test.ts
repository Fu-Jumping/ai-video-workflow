import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import {
  addDeviation,
  modeSuppressesIssue,
  readDeviations,
  removeDeviation,
  setShotMode,
  setWorkflowMode
} from "../src/lib/deviations.js";
import { createProject } from "../src/lib/init.js";
import { syncProject } from "../src/lib/sync.js";
import type { Ide } from "../src/lib/types.js";
import { verifyProject } from "../src/lib/verify.js";

const tempRoots: string[] = [];
const repoRoot = path.resolve(__dirname, "../../..");

async function createSyncedProject(root: string, ide: Ide = "codex"): Promise<string> {
  await createProject({
    targetRoot: root,
    projectName: "deviation-project",
    pack: "official-ai-video",
    ide,
    imagePlatform: "openai",
    videoPlatform: "seedance"
  });
  const projectRoot = path.join(root, "deviation-project");
  await syncProject({ repoRoot, projectRoot, ide, pack: "official-ai-video" });
  return projectRoot;
}

async function seedMissingCharacterTriView(projectRoot: string): Promise<void> {
  await fs.writeFile(
    path.join(projectRoot, "02_世界设定", "角色设定.md"),
    [
      "# 角色设定",
      "",
      "## 测试角色",
      "",
      "- 主角色：是",
      "- 外观特征：测试"
    ].join("\n"),
    "utf8"
  );
}

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => fs.remove(root)));
  tempRoots.length = 0;
});

describe("workflow deviation registry", () => {
  test("registered deviation suppresses matching issue by default and strict mode reports it", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "avw-deviation-accept-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root);
    await seedMissingCharacterTriView(projectRoot);

    const before = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video" });
    expect(before.ok).toBe(false);
    expect(before.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "missing-character-triview" })])
    );

    await addDeviation(projectRoot, {
      rule: "missing-character-triview",
      scope: "02_世界设定/角色设定.md",
      reason: "scene-basis"
    });

    const accepted = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video" });
    expect(accepted.ok).toBe(true);
    expect(accepted.acceptedDeviations).toHaveLength(1);
    expect(accepted.acceptedDeviations?.[0]?.code).toBe("missing-character-triview");

    const strict = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video", strict: true });
    expect(strict.ok).toBe(false);
    expect(strict.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "missing-character-triview" })])
    );
    expect(strict.acceptedDeviations).toBeUndefined();
  });

  test("scope mismatch does not suppress an issue", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "avw-deviation-scope-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root);
    await seedMissingCharacterTriView(projectRoot);

    await addDeviation(projectRoot, {
      rule: "missing-character-triview",
      scope: "02_世界设定/场景设定.md",
      reason: "wrong file"
    });

    const result = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video" });
    expect(result.ok).toBe(false);
    expect(result.acceptedDeviations).toBeUndefined();
  });

  test("add/list/remove round-trips a deviation", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "avw-deviation-crud-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root);

    await addDeviation(projectRoot, {
      rule: "missing-scene-reference-image",
      scope: "02_世界设定/场景设定.md#大漠",
      reason: "scene-basis"
    });

    const listed = await readDeviations(projectRoot);
    expect(listed.deviations).toHaveLength(1);
    expect(listed.deviations[0]).toMatchObject({
      rule: "missing-scene-reference-image",
      scope: "02_世界设定/场景设定.md#大漠"
    });

    await removeDeviation(projectRoot, "missing-scene-reference-image", "02_世界设定/场景设定.md#大漠");
    const afterRemove = await readDeviations(projectRoot);
    expect(afterRemove.deviations).toHaveLength(0);
  });

  test("global scene-basis mode suppresses asset errors by default and strict reports them", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "avw-deviation-mode-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root);
    await seedMissingCharacterTriView(projectRoot);

    await setWorkflowMode(projectRoot, "scene-basis");

    const accepted = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video" });
    expect(accepted.ok).toBe(true);
    expect(accepted.acceptedDeviations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "missing-character-triview" })])
    );

    const strict = await verifyProject({ projectRoot, ide: "codex", pack: "official-ai-video", strict: true });
    expect(strict.ok).toBe(false);
    expect(strict.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "missing-character-triview" })])
    );
  });

  test("setShotMode persists a per-shot mode and modeSuppressesIssue matches expected codes", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "avw-deviation-shot-mode-"));
    tempRoots.push(root);
    const projectRoot = await createSyncedProject(root);

    await setShotMode(projectRoot, "shot-002", "minimal-video", "不建关键帧");
    const listed = await readDeviations(projectRoot);
    expect(listed.shots).toEqual([
      expect.objectContaining({ id: "shot-002", mode: "minimal-video", reason: "不建关键帧" })
    ]);

    expect(modeSuppressesIssue("minimal-video", "invalid-keyframe-mapping")).toBe(true);
    expect(modeSuppressesIssue("minimal-video", "missing-character-triview")).toBe(false);
    expect(modeSuppressesIssue("scene-basis", "missing-character-triview")).toBe(true);
  });
});
