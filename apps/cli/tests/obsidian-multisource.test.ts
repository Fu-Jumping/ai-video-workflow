import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { exportObsidianVault } from "../src/lib/obsidian/export.js";
import { verifyObsidianVault } from "../src/lib/obsidian/verify.js";
import { scanProjectForObsidian } from "../src/lib/obsidian/scan.js";
import { syncProject } from "../src/lib/sync.js";

/**
 * Multi-source card regression guard: every `_资料库/SRC-xxxx/source-card.md` must project to a
 * unique vault page (SRC id kept in the title). Before the fix, all cards collapsed onto a single
 * "Source Card.md", silently dropping all but one from the vault and failing verify-obsidian.
 * The official example only ships one source card, which is why this class of bug went unnoticed.
 */

const tempRoots: string[] = [];
const repoRoot = path.resolve(__dirname, "..", "..", "..");

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

async function buildMultiSourceProject(): Promise<{ projectRoot: string; outRoot: string }> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-multisource-"));
  tempRoots.push(tempRoot);
  const sourceRoot = path.join(repoRoot, "examples", "官方示例-云上早市");
  const projectRoot = path.join(tempRoot, "multisource-project");
  await fs.copy(sourceRoot, projectRoot, {
    filter: (filePath) => !filePath.includes(`${path.sep}.codex${path.sep}`) && !filePath.includes(`${path.sep}_views${path.sep}`)
  });
  await syncProject({ repoRoot, projectRoot, pack: "official-ai-video", ide: "codex" });

  const libraryRoot = path.join(projectRoot, "00_前期研究", "_资料库");
  for (const id of ["SRC-0002", "SRC-0003"]) {
    const dir = path.join(libraryRoot, id);
    await fs.ensureDir(dir);
    await fs.writeFile(
      path.join(dir, "source-card.md"),
      ["---", `source_id: ${id}`, "---", "", `# ${id} 来源卡`, "", "测试来源卡内容，无敏感信息。", `- 关键事实：来源 ${id} 的测试事实（${id}）。`].join("\n"),
      "utf8"
    );
  }
  // raw/ extracts are gitignored and must not leak into the projection.
  const rawDir = path.join(libraryRoot, "SRC-0001", "raw");
  await fs.ensureDir(rawDir);
  await fs.writeFile(path.join(rawDir, "raw-note.md"), "# raw 提取笔记\n\n不应进入观看层。\n", "utf8");

  const outRoot = path.join(tempRoot, "vault");
  return { projectRoot, outRoot };
}

describe("multi-source obsidian projection", () => {
  test("every source card projects to its own SRC-prefixed vault page", async () => {
    const { projectRoot } = await buildMultiSourceProject();
    const sourceFiles = await scanProjectForObsidian(projectRoot);
    const cardTitles = sourceFiles
      .filter((file) => file.sourcePath.includes("/source-card.md"))
      .map((file) => file.title);
    expect(cardTitles.sort()).toEqual(["SRC-0001 来源卡", "SRC-0002 来源卡", "SRC-0003 来源卡"]);
  });

  test("export and verify-obsidian pass with multiple source cards; raw/ is excluded", async () => {
    const { projectRoot, outRoot } = await buildMultiSourceProject();
    await exportObsidianVault({ projectRoot, outRoot, force: true, includePluginRecipes: true });

    for (const id of ["SRC-0001", "SRC-0002", "SRC-0003"]) {
      const cardPath = path.join(outRoot, "01_阶段审核", "00_前期研究", `${id} 来源卡.md`);
      expect(await fs.pathExists(cardPath)).toBe(true);
    }
    const vaultFiles = (await scanProjectForObsidian(projectRoot)).map((file) => file.sourcePath);
    expect(vaultFiles.some((sourcePath) => sourcePath.includes("/raw/"))).toBe(false);

    const result = await verifyObsidianVault({ projectRoot, vaultRoot: outRoot });
    expect(result).toEqual({ ok: true, issues: [] });
  });
});
