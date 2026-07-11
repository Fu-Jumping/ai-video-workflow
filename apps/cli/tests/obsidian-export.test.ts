import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { exportObsidianVault } from "../src/lib/obsidian/export.js";
import { hashContent, projectionManifestPath, readProjectionManifest, renderProjectionManifest } from "../src/lib/obsidian/manifest.js";
import { toVaultPath } from "../src/lib/obsidian/paths.js";
import { scanProjectForObsidian } from "../src/lib/obsidian/scan.js";
import type { ObsidianProjectionManifest } from "../src/lib/obsidian/types.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

function officialExampleRoot(): string {
  return path.resolve(__dirname, "..", "..", "..", "examples", "official-mini-film");
}

describe("Obsidian export paths", () => {
  test("normalizes Windows paths to vault-relative POSIX paths", () => {
    expect(toVaultPath(path.join("Workflow", "Step 3 - Storyboard", "Shot 001.md"))).toBe(
      "Workflow/Step 3 - Storyboard/Shot 001.md"
    );
  });
});

describe("Obsidian projection manifests", () => {
  test("hashes content and round-trips manifest JSON", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-manifest-"));
    tempRoots.push(outRoot);
    const manifest: ObsidianProjectionManifest = {
      schemaVersion: 1,
      generator: "ai-video-workflow",
      generatedAt: "2026-07-09T00:00:00.000Z",
      projectName: "demo",
      projectRoot: "demo",
      files: [
        {
          vaultPath: "Workflow/Step 1 - Concept/Story Kernel.md",
          sourcePath: "01_concept/story-kernel.md",
          contentHash: hashContent("story")
        }
      ]
    };

    await fs.writeFile(path.join(outRoot, projectionManifestPath), renderProjectionManifest(manifest), "utf8");

    expect(hashContent("story")).toHaveLength(64);
    await expect(readProjectionManifest(outRoot)).resolves.toEqual(manifest);
  });
});

describe("scanProjectForObsidian", () => {
  test("scans the official example into workflow source files", async () => {
    const files = await scanProjectForObsidian(officialExampleRoot());

    expect(files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceKind: "concept", step: 1 }),
        expect.objectContaining({ sourceKind: "storyboard", step: 3, shotId: "shot-001" }),
        expect.objectContaining({ sourceKind: "image-prompt", step: 4, shotId: "shot-001" }),
        expect.objectContaining({ sourceKind: "video-prompt", step: 5, shotId: "shot-001" }),
        expect.objectContaining({ sourceKind: "execution-plan", step: 6 })
      ])
    );
  });
});

describe("exportObsidianVault", () => {
  test("exports generated workflow notes with provenance frontmatter", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });

    const storyboard = await fs.readFile(path.join(outRoot, "Workflow", "Step 3 - Storyboard", "Shot 001 - Storyboard.md"), "utf8");
    expect(storyboard).toContain("projection_generated: true");
    expect(storyboard).toContain("source_path: 03_storyboard/shot-001.md");
    expect(storyboard).toContain("stage_group: shot-review");
    expect(storyboard).toContain("review_status: shot-review");
    expect(storyboard).toContain("execution_status: not-applicable");
    expect(storyboard).toContain("shot_order: 1");
    expect(storyboard).toContain("ai-video/step/03-storyboard");
    expect(storyboard).toContain("[[01_Review_Dashboard]]");
    expect(storyboard).toContain("[[Canvas/Review Map.canvas]]");
    await expect(fs.pathExists(path.join(outRoot, projectionManifestPath))).resolves.toBe(true);
  });

  test("exports Obsidian dashboards with embedded Bases and query blocks", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-dashboard-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });

    const home = await fs.readFile(path.join(outRoot, "00_Project_Home.md"), "utf8");
    expect(home).toContain("Open Vault Workflow");
    expect(home).toContain("Inspect project");
    expect(home).toContain("Inspect a shot");
    expect(home).toContain("Hand off to agent");
    expect(home).toContain("Verify after edits");
    expect(home).toContain("Review Command Center");
    expect(home).toContain("Immersive Shot Reviews");
    expect(home).toContain("[[04_Agent_Handoff|Agent Handoff]]");
    expect(home).toContain("Project Health");
    expect(home).toContain("Shot Progress");
    expect(home).toContain("Execution Readiness");
    expect(home).toContain("![[Bases/Workflow Files.base#Workflow Files]]");
    expect(home).toContain("![[Bases/Workflow Files.base#Review Queue]]");
    expect(home).toContain("![[Canvas/Workflow Map.canvas]]");
    expect(home).toContain("[[Canvas/Review Map.canvas|Review Map]]");
    expect(home).toContain("[[Notes/README|Obsidian Notes]]");
    expect(home).toContain("```query");

    const reviewDashboard = await fs.readFile(path.join(outRoot, "01_Review_Dashboard.md"), "utf8");
    expect(reviewDashboard).toContain("Generated File Conflicts");
    expect(reviewDashboard).toContain("Agent Handoff");
    expect(reviewDashboard).toContain("Shot Review Canvases");
    expect(reviewDashboard).toContain("![[Bases/Workflow Files.base#Modified Generated Files]]");
  });

  test("exports a generated README with an open-vault path", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-readme-path-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });

    const readme = await fs.readFile(path.join(outRoot, "README.md"), "utf8");
    expect(readme).toContain("[[00_Project_Home]]");
    expect(readme).toContain("[[02_Shot_Index]]");
    expect(readme).toContain("[[04_Agent_Handoff]]");
    expect(readme).toContain("[[Canvas/Review Map.canvas|Review Map]]");
    expect(readme).toContain("[[03_Production_Board]]");
  });

  test("exports project-level agent handoff guidance", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-agent-handoff-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });

    const handoff = await fs.readFile(path.join(outRoot, "04_Agent_Handoff.md"), "utf8");
    expect(handoff).toContain("# Agent Handoff");
    expect(handoff).toContain("Copy-ready Prompts");
    expect(handoff).toContain("Source Editing Boundary");
    expect(handoff).toContain("Verification Commands");
    expect(handoff).toContain("edit only the source Step files");
    expect(handoff).toContain("Do not edit generated Obsidian projection files");
    expect(handoff).toContain("node apps/cli/dist/index.js verify --project <project-path> --ide codex");
    expect(handoff).toContain("[[Shots/shot-001|shot-001]]");
  });

  test("exports immersive single-shot review pages", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-shot-review-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });

    const shotReview = await fs.readFile(path.join(outRoot, "Shots", "shot-001.md"), "utf8");
    expect(shotReview).toContain("review_mode: immersive");
    expect(shotReview).toContain('review_canvas: "[[Canvas/Shot Reviews/shot-001.canvas]]"');
    expect(shotReview).toContain('review_note: "[[Notes/Shot Reviews/shot-001]]"');
    expect(shotReview).toContain("has_storyboard: true");
    expect(shotReview).toContain("has_image_prompt: true");
    expect(shotReview).toContain("has_video_prompt: true");
    expect(shotReview).toContain('agent_handoff: "[[04_Agent_Handoff#Single-Shot Handoff|Agent Handoff]]"');
    expect(shotReview).toContain("## Immersive Review");
    expect(shotReview).toContain("## Frame Continuity");
    expect(shotReview).toContain("## Prompt Handoff");
    expect(shotReview).toContain("## Agent Handoff");
    expect(shotReview).toContain("## Review Canvas");
    expect(shotReview).toContain("![[Workflow/Step 3 - Storyboard/Shot 001 - Storyboard.md]]");
    expect(shotReview).toContain("![[Workflow/Step 4 - Image Prompts/Shot 001 Keyframe - Image Prompt.md]]");
    expect(shotReview).toContain("![[Workflow/Step 5 - Video Prompts/Shot 001 - Video Prompt.md]]");
    expect(shotReview).toContain("Please inspect shot-001 across its Step 3 storyboard");
    expect(shotReview).toContain("03_storyboard/shot-001.md");
    expect(shotReview).toContain("04_image_prompts/shot-001-keyframe.md");
    expect(shotReview).toContain("05_video_prompts/shot-001.md");
    expect(shotReview).toContain("Do not edit generated Obsidian projection files");
  });

  test("exports Obsidian Bases for workflow files and shots", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-bases-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });

    const shotsBase = await fs.readFile(path.join(outRoot, "Bases", "Shots.base"), "utf8");
    expect(shotsBase).toContain("file.hasTag(\"ai-video/shot\")");
    expect(shotsBase).toContain("type: table");
    expect(shotsBase).toContain("type: cards");
    expect(shotsBase).toContain("Shot Progress");
    expect(shotsBase).toContain("Immersive Review");
    expect(shotsBase).toContain("Agent Handoff");
    expect(shotsBase).toContain("agent_handoff");
    expect(shotsBase).toContain("review_canvas");
    expect(shotsBase).toContain("review_note");

    const workflowBase = await fs.readFile(path.join(outRoot, "Bases", "Workflow Files.base"), "utf8");
    expect(workflowBase).toContain("Review Queue");
    expect(workflowBase).toContain("Modified Generated Files");

    const productionBase = await fs.readFile(path.join(outRoot, "Bases", "Production Status.base"), "utf8");
    expect(productionBase).toContain("Execution Readiness");
  });

  test("exports valid JSON Canvas maps", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-canvas-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });

    const workflowMap = await fs.readJson(path.join(outRoot, "Canvas", "Workflow Map.canvas"));
    expect(workflowMap.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ type: "group", label: "Step 3" })]));
    expect(workflowMap.edges.length).toBeGreaterThan(0);

    const shotPipeline = await fs.readJson(path.join(outRoot, "Canvas", "Shot Pipeline.canvas"));
    expect(shotPipeline.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ type: "file" })]));

    const reviewMap = await fs.readJson(path.join(outRoot, "Canvas", "Review Map.canvas"));
    expect(reviewMap.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ type: "file", file: "00_Project_Home.md" })]));
    expect(reviewMap.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ type: "file", file: "Bases/Workflow Files.base" })]));
    expect(reviewMap.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ type: "file", file: "04_Agent_Handoff.md" })]));
    expect(reviewMap.edges.length).toBeGreaterThan(0);

    const shotReview = await fs.readJson(path.join(outRoot, "Canvas", "Shot Reviews", "shot-001.canvas"));
    expect(shotReview.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ type: "file", file: "Shots/shot-001.md" })]));
    expect(shotReview.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ type: "file", file: "03_Production_Board.md" })]));
    expect(shotReview.nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "file", file: "Workflow/Step 3 - Storyboard/Shot 001 - Storyboard.md" })])
    );
    expect(shotReview.nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "file", file: "Workflow/Step 4 - Image Prompts/Shot 001 Keyframe - Image Prompt.md" })])
    );
    expect(shotReview.nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "file", file: "Workflow/Step 5 - Video Prompts/Shot 001 - Video Prompt.md" })])
    );
    expect(
      shotReview.nodes
        .filter((node: { type?: string }) => node.type === "file")
        .every((node: { file?: string }) => node.file && !path.isAbsolute(node.file) && !node.file.includes(":\\") && !node.file.includes(":/"))
    ).toBe(true);
    expect(shotReview.edges).toEqual(expect.arrayContaining([expect.objectContaining({ label: "review start / frame" })]));
  });

  test("preserves user-authored notes during incremental export", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-incremental-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });
    const userNote = path.join(outRoot, "Notes", "manual-review.md");
    await fs.writeFile(userNote, "# Manual Review\n\nKeep this note.\n", "utf8");
    const result = await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: false, includePluginRecipes: true });

    await expect(fs.readFile(userNote, "utf8")).resolves.toContain("Keep this note.");
    expect(result.operations).toEqual(expect.arrayContaining([expect.objectContaining({ status: "unchanged", vaultPath: "00_Project_Home.md" })]));
  });

  test("skips user-modified generated files by default", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-conflict-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });
    const generatedFile = path.join(outRoot, "Workflow", "Step 3 - Storyboard", "Shot 001 - Storyboard.md");
    await fs.appendFile(generatedFile, "\nUser edit inside Obsidian.\n", "utf8");
    const result = await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: false, includePluginRecipes: true });

    expect(result.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "skipped-user-modified",
          vaultPath: "Workflow/Step 3 - Storyboard/Shot 001 - Storyboard.md"
        })
      ])
    );
    await expect(fs.readFile(generatedFile, "utf8")).resolves.toContain("User edit inside Obsidian.");
  });

  test("updates generated files when source files change and generated files are untouched", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-project-"));
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-update-"));
    tempRoots.push(projectRoot, outRoot);
    await fs.copy(officialExampleRoot(), projectRoot);

    await exportObsidianVault({ projectRoot, outRoot, force: true, includePluginRecipes: true });
    await fs.appendFile(path.join(projectRoot, "03_storyboard", "shot-001.md"), "\nUpdated source beat.\n", "utf8");
    const result = await exportObsidianVault({ projectRoot, outRoot, force: false, includePluginRecipes: true });
    const generatedFile = path.join(outRoot, "Workflow", "Step 3 - Storyboard", "Shot 001 - Storyboard.md");

    expect(result.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "updated",
          vaultPath: "Workflow/Step 3 - Storyboard/Shot 001 - Storyboard.md"
        })
      ])
    );
    await expect(fs.readFile(generatedFile, "utf8")).resolves.toContain("Updated source beat.");
  });

  test("force export rebuilds the vault projection", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-force-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });
    const userNote = path.join(outRoot, "Notes", "manual-review.md");
    await fs.writeFile(userNote, "# Manual Review\n", "utf8");
    const result = await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });

    await expect(fs.pathExists(userNote)).resolves.toBe(false);
    expect(result.operations.every((operation) => operation.status === "created")).toBe(true);
  });

  test("dry-run reports operations without writing files", async () => {
    const parentRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-dry-run-"));
    tempRoots.push(parentRoot);
    const outRoot = path.join(parentRoot, "vault");

    const result = await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: false, includePluginRecipes: true, dryRun: true });

    expect(result.operations).toEqual(expect.arrayContaining([expect.objectContaining({ status: "created", vaultPath: "00_Project_Home.md" })]));
    await expect(fs.pathExists(outRoot)).resolves.toBe(false);
  });

  test("does not write Obsidian UI config by default", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-ui-default-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true });

    await expect(fs.pathExists(path.join(outRoot, ".obsidian"))).resolves.toBe(false);
  });

  test("writes opt-in Obsidian UI suggestion config", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-ui-"));
    tempRoots.push(outRoot);

    await exportObsidianVault({ projectRoot: officialExampleRoot(), outRoot, force: true, includePluginRecipes: true, includeObsidianUi: true });

    await expect(fs.pathExists(path.join(outRoot, ".obsidian", "bookmarks.json"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(outRoot, ".obsidian", "workspace.json"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(outRoot, ".obsidian", "core-plugins.json"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(outRoot, ".obsidian", "appearance.json"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(outRoot, ".obsidian", "ai-video-workflow-suggested", "bookmarks.json"))).resolves.toBe(true);

    const bookmarks = await fs.readJson(path.join(outRoot, ".obsidian", "bookmarks.json"));
    expect(JSON.stringify(bookmarks)).toContain("00_Project_Home.md");
    expect(JSON.stringify(bookmarks)).toContain("04_Agent_Handoff.md");
    expect(JSON.stringify(bookmarks)).toContain("02_Shot_Index.md");
    expect(JSON.stringify(bookmarks)).toContain("03_Production_Board.md");
    expect(JSON.stringify(bookmarks)).toContain("Canvas/Review Map.canvas");
    expect(JSON.stringify(bookmarks)).toContain("Canvas/Shot Pipeline.canvas");
    expect(JSON.stringify(bookmarks)).toContain("Notes/README.md");

    const suggestedBookmarks = await fs.readJson(path.join(outRoot, ".obsidian", "ai-video-workflow-suggested", "bookmarks.json"));
    expect(JSON.stringify(suggestedBookmarks)).toContain("00_Project_Home.md");
    expect(JSON.stringify(suggestedBookmarks)).toContain("04_Agent_Handoff.md");
    expect(JSON.stringify(suggestedBookmarks)).toContain("02_Shot_Index.md");
    expect(JSON.stringify(suggestedBookmarks)).toContain("03_Production_Board.md");
    expect(JSON.stringify(suggestedBookmarks)).toContain("Canvas/Review Map.canvas");
    expect(JSON.stringify(suggestedBookmarks)).toContain("Canvas/Shot Pipeline.canvas");
    expect(JSON.stringify(suggestedBookmarks)).toContain("Notes/README.md");

    const workspace = await fs.readJson(path.join(outRoot, ".obsidian", "workspace.json"));
    expect(JSON.stringify(workspace)).toContain("00_Project_Home.md");
    expect(JSON.stringify(workspace)).toContain("04_Agent_Handoff.md");
    expect(JSON.stringify(workspace)).toContain("Canvas/Review Map.canvas");
    expect(
      JSON.stringify(workspace).includes(":\\") || JSON.stringify(workspace).includes("file://") || JSON.stringify(workspace).includes("vscode://")
    ).toBe(false);
  });

  test("does not overwrite existing Obsidian UI config", async () => {
    const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-ui-existing-"));
    tempRoots.push(outRoot);
    const bookmarksPath = path.join(outRoot, ".obsidian", "bookmarks.json");
    await fs.ensureDir(path.dirname(bookmarksPath));
    await fs.writeFile(bookmarksPath, "{\"items\":[{\"title\":\"User Bookmark\"}]}\n", "utf8");

    const result = await exportObsidianVault({
      projectRoot: officialExampleRoot(),
      outRoot,
      force: false,
      includePluginRecipes: true,
      includeObsidianUi: true
    });

    await expect(fs.readFile(bookmarksPath, "utf8")).resolves.toContain("User Bookmark");
    await expect(fs.pathExists(path.join(outRoot, ".obsidian", "ai-video-workflow-suggested", "bookmarks.json"))).resolves.toBe(true);
    expect(result.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "skipped-user-config-existing",
          vaultPath: ".obsidian/bookmarks.json"
        })
      ])
    );
  });

  test("dry-run with Obsidian UI suggestions writes nothing", async () => {
    const parentRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-obsidian-ui-dry-run-"));
    tempRoots.push(parentRoot);
    const outRoot = path.join(parentRoot, "vault");

    const result = await exportObsidianVault({
      projectRoot: officialExampleRoot(),
      outRoot,
      force: false,
      includePluginRecipes: true,
      includeObsidianUi: true,
      dryRun: true
    });

    expect(result.operations).toEqual(expect.arrayContaining([expect.objectContaining({ status: "created", vaultPath: ".obsidian/bookmarks.json" })]));
    await expect(fs.pathExists(outRoot)).resolves.toBe(false);
  });
});
