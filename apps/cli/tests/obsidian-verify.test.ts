import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { exportObsidianVault } from "../src/lib/obsidian/export.js";
import { projectionManifestPath } from "../src/lib/obsidian/manifest.js";
import { verifyObsidianVault } from "../src/lib/obsidian/verify.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

function officialExampleRoot(): string {
  return path.resolve(__dirname, "..", "..", "..", "examples", "official-mini-film");
}

describe("verifyObsidianVault", () => {
  test("passes for exported official example", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-verify-"));
    tempRoots.push(outRoot);
    const projectRoot = officialExampleRoot();
    await exportObsidianVault({ projectRoot, outRoot, force: true, includePluginRecipes: true });

    const result = await verifyObsidianVault({ projectRoot, vaultRoot: outRoot });
    expect(result.ok).toBe(true);
  });

  test("passes for exported official example with optional Obsidian UI suggestions", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-verify-ui-"));
    tempRoots.push(outRoot);
    const projectRoot = officialExampleRoot();
    await exportObsidianVault({ projectRoot, outRoot, force: true, includePluginRecipes: true, includeObsidianUi: true });

    const result = await verifyObsidianVault({ projectRoot, vaultRoot: outRoot });
    expect(result.ok).toBe(true);
  });

  test("fails when projection manifest is missing", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-missing-manifest-"));
    tempRoots.push(outRoot);
    const projectRoot = officialExampleRoot();
    await exportObsidianVault({ projectRoot, outRoot, force: true, includePluginRecipes: true });
    await fs.remove(path.join(outRoot, projectionManifestPath));

    const result = await verifyObsidianVault({ projectRoot, vaultRoot: outRoot });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "missing-obsidian-manifest" })]));
  });

  test("fails when a generated file no longer matches the manifest hash", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-hash-mismatch-"));
    tempRoots.push(outRoot);
    const projectRoot = officialExampleRoot();
    await exportObsidianVault({ projectRoot, outRoot, force: true, includePluginRecipes: true });
    await fs.appendFile(path.join(outRoot, "Workflow", "Step 3 - Storyboard", "Shot 001 - Storyboard.md"), "\nManual generated-file edit.\n", "utf8");

    const result = await verifyObsidianVault({ projectRoot, vaultRoot: outRoot });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "obsidian-manifest-hash-mismatch" })]));
  });

  test("fails when Review Map canvas is missing", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-missing-review-map-"));
    tempRoots.push(outRoot);
    const projectRoot = officialExampleRoot();
    await exportObsidianVault({ projectRoot, outRoot, force: true, includePluginRecipes: true });
    await fs.remove(path.join(outRoot, "Canvas", "Review Map.canvas"));

    const result = await verifyObsidianVault({ projectRoot, vaultRoot: outRoot });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-obsidian-canvas-json" })]));
  });

  test("fails when a required Base view is missing", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-missing-base-view-"));
    tempRoots.push(outRoot);
    const projectRoot = officialExampleRoot();
    await exportObsidianVault({ projectRoot, outRoot, force: true, includePluginRecipes: true });
    const workflowBase = path.join(outRoot, "Bases", "Workflow Files.base");
    const content = await fs.readFile(workflowBase, "utf8");
    await fs.writeFile(workflowBase, content.replace("Review Queue", "Review Queue Removed"), "utf8");

    const result = await verifyObsidianVault({ projectRoot, vaultRoot: outRoot });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "missing-obsidian-base-view" })]));
  });

  test("fails when optional Obsidian UI suggestion JSON is invalid", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-invalid-ui-"));
    tempRoots.push(outRoot);
    const projectRoot = officialExampleRoot();
    await exportObsidianVault({ projectRoot, outRoot, force: true, includePluginRecipes: true, includeObsidianUi: true });
    await fs.writeFile(path.join(outRoot, ".obsidian", "ai-video-workflow-suggested", "bookmarks.json"), "{ invalid json", "utf8");

    const result = await verifyObsidianVault({ projectRoot, vaultRoot: outRoot });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-obsidian-ui-config" })]));
  });

  test("fails when optional Obsidian UI suggestions omit a required bookmark route", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-missing-ui-route-"));
    tempRoots.push(outRoot);
    const projectRoot = officialExampleRoot();
    await exportObsidianVault({ projectRoot, outRoot, force: true, includePluginRecipes: true, includeObsidianUi: true });
    const bookmarksPath = path.join(outRoot, ".obsidian", "ai-video-workflow-suggested", "bookmarks.json");
    const bookmarks = await fs.readJson(bookmarksPath) as { items: Array<{ path?: string }> };
    bookmarks.items = bookmarks.items.filter((item) => item.path !== "04_Agent_Handoff.md");
    await fs.writeJson(bookmarksPath, bookmarks, { spaces: 2 });

    const result = await verifyObsidianVault({ projectRoot, vaultRoot: outRoot });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid-obsidian-ui-config",
          message: expect.stringContaining("04_Agent_Handoff.md")
        })
      ])
    );
  });

  test("fails when optional Obsidian UI suggestion workspace JSON is invalid", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-invalid-ui-workspace-"));
    tempRoots.push(outRoot);
    const projectRoot = officialExampleRoot();
    await exportObsidianVault({ projectRoot, outRoot, force: true, includePluginRecipes: true, includeObsidianUi: true });
    await fs.writeFile(path.join(outRoot, ".obsidian", "ai-video-workflow-suggested", "workspace.json"), "{ invalid json", "utf8");

    const result = await verifyObsidianVault({ projectRoot, vaultRoot: outRoot });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-obsidian-ui-config" })]));
  });

  test("fails when a shot review page is missing an immersive review marker", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-shot-marker-"));
    tempRoots.push(outRoot);
    const projectRoot = officialExampleRoot();
    await exportObsidianVault({ projectRoot, outRoot, force: true, includePluginRecipes: true });
    const shotReviewPath = path.join(outRoot, "Shots", "shot-001.md");
    const content = await fs.readFile(shotReviewPath, "utf8");
    await fs.writeFile(shotReviewPath, content.replace("## Prompt Handoff", "## Prompt Bridge"), "utf8");

    const result = await verifyObsidianVault({ projectRoot, vaultRoot: outRoot });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-obsidian-shot-review" })]));
  });

  test("fails when a linked shot review canvas is missing", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-shot-canvas-"));
    tempRoots.push(outRoot);
    const projectRoot = officialExampleRoot();
    await exportObsidianVault({ projectRoot, outRoot, force: true, includePluginRecipes: true });
    await fs.remove(path.join(outRoot, "Canvas", "Shot Reviews", "shot-001.canvas"));

    const result = await verifyObsidianVault({ projectRoot, vaultRoot: outRoot });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-obsidian-shot-review" })]));
  });

  test("fails when the project agent handoff page is missing", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-agent-handoff-missing-"));
    tempRoots.push(outRoot);
    const projectRoot = officialExampleRoot();
    await exportObsidianVault({ projectRoot, outRoot, force: true, includePluginRecipes: true });
    await fs.remove(path.join(outRoot, "04_Agent_Handoff.md"));

    const result = await verifyObsidianVault({ projectRoot, vaultRoot: outRoot });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-obsidian-agent-handoff" })]));
  });

  test("fails when a shot page is missing agent handoff guidance", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-agent-shot-marker-"));
    tempRoots.push(outRoot);
    const projectRoot = officialExampleRoot();
    await exportObsidianVault({ projectRoot, outRoot, force: true, includePluginRecipes: true });
    const shotReviewPath = path.join(outRoot, "Shots", "shot-001.md");
    const content = await fs.readFile(shotReviewPath, "utf8");
    await fs.writeFile(shotReviewPath, content.replace("## Agent Handoff", "## Agent Context"), "utf8");

    const result = await verifyObsidianVault({ projectRoot, vaultRoot: outRoot });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-obsidian-agent-handoff" })]));
  });
});
