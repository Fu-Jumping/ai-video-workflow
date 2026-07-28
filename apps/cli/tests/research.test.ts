import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { createProject } from "../src/lib/init.js";
import {
  ingestResearchInbox,
  ingestResearchSource,
  renderResearchInboxSummary,
  renderResearchIngestSummary
} from "../src/lib/research.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

async function seedResearchProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-research-"));
  tempRoots.push(root);
  await createProject({
    targetRoot: root,
    projectName: "research-project",
    pack: "official-ai-video",
    ide: "codex",
    imagePlatform: "openai",
    videoPlatform: "runway"
  });
  return path.join(root, "research-project");
}

describe("research ingest", () => {
  test("dry-run reports a planned URL archive without writing files", async () => {
    const projectRoot = await seedResearchProject();

    const result = await ingestResearchSource({
      projectRoot,
      source: "https://www.bilibili.com/video/BV1xx411c7mD",
      platform: "auto",
      runtime: "auto",
      withComments: true,
      commentLimit: 5,
      dryRun: true
    });

    expect(result.dryRun).toBe(true);
    expect(result.sourceId).toBe("SRC-0001");
    expect(result.platform).toBe("bilibili");
    expect(result.runtime).toBe("toolbox");
    expect(result.createdFiles.map((file) => file.kind)).toEqual(["metadata", "source-card", "comment-sample"]);
    expect(result.toolboxCommand).toContain("<research-toolbox>");
    expect(result.toolboxCommand).not.toMatch(/[A-Z]:\\/);
    await expect(fs.pathExists(path.join(projectRoot, result.sourceRoot))).resolves.toBe(false);
    expect(renderResearchIngestSummary(result)).toContain("Research ingest dry-run");
  });

  test("writes metadata and source card for URL sources", async () => {
    const projectRoot = await seedResearchProject();

    const result = await ingestResearchSource({
      projectRoot,
      source: "https://example.com/report",
      platform: "web",
      runtime: "toolbox",
      withComments: false,
      commentLimit: 0
    });

    const sourceRoot = path.join(projectRoot, result.sourceRoot);
    await expect(fs.pathExists(path.join(sourceRoot, "metadata.json"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(sourceRoot, "source-card.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(sourceRoot, "comment-sample.md"))).resolves.toBe(false);

    const metadata = await fs.readJson(path.join(sourceRoot, "metadata.json"));
    expect(metadata).toEqual(expect.objectContaining({ source_id: "SRC-0001", source_kind: "url", platform: "web" }));
    await expect(fs.readFile(path.join(sourceRoot, "source-card.md"), "utf8")).resolves.toContain("SRC-0001 来源卡");
  });

  test("writes anonymized comment samples without raw usernames", async () => {
    const projectRoot = await seedResearchProject();

    const result = await ingestResearchSource({
      projectRoot,
      source: "https://www.zhihu.com/question/123",
      platform: "zhihu",
      runtime: "toolbox",
      withComments: true,
      commentLimit: 2
    });

    const sample = await fs.readFile(path.join(projectRoot, result.sourceRoot, "comment-sample.md"), "utf8");
    expect(sample).toContain("user_");
    expect(sample).toContain("样本上限：2");
    expect(sample).not.toContain("alice");
  });

  test("copies local files into gitignored raw storage", async () => {
    const projectRoot = await seedResearchProject();
    const sourceFile = path.join(path.dirname(projectRoot), "local-source.md");
    await fs.writeFile(sourceFile, "# Local Source\n", "utf8");

    const result = await ingestResearchSource({
      projectRoot,
      source: sourceFile,
      platform: "web",
      runtime: "ide-inbox",
      withComments: false,
      commentLimit: 0
    });

    const rawCopy = result.createdFiles.find((file) => file.kind === "raw-copy");
    expect(result.source).toBe("00_前期研究/_资料库/SRC-0001/raw/local-source.md");
    expect(rawCopy?.path).toBe("00_前期研究/_资料库/SRC-0001/raw/local-source.md");
    await expect(fs.readFile(path.join(projectRoot, rawCopy?.path ?? ""), "utf8")).resolves.toContain("Local Source");

    const metadata = await fs.readJson(path.join(projectRoot, result.sourceRoot, "metadata.json"));
    expect(metadata.source).toBe("00_前期研究/_资料库/SRC-0001/raw/local-source.md");
    expect(metadata.original_file_name).toBe("local-source.md");
    const sourceCard = await fs.readFile(path.join(projectRoot, result.sourceRoot, "source-card.md"), "utf8");
    expect(sourceCard).not.toContain(sourceFile);

    const gitignore = await fs.readFile(path.join(projectRoot, ".gitignore"), "utf8");
    expect(gitignore).toContain("00_前期研究/_资料库/*/raw/");
  });

  test("normalizes inbox files into source cards and skips unsupported files", async () => {
    const projectRoot = await seedResearchProject();
    const inboxRoot = path.join(projectRoot, "00_前期研究", "_inbox");
    await fs.ensureDir(inboxRoot);
    await fs.writeFile(path.join(inboxRoot, "manual-note.md"), "# Manual\n", "utf8");
    await fs.writeFile(path.join(inboxRoot, "ignore.exe"), "binary\n", "utf8");

    const result = await ingestResearchInbox({ projectRoot });

    expect(result.ingested).toHaveLength(1);
    expect(result.ingested[0]?.sourceId).toBe("SRC-0001");
    expect(result.skipped).toEqual(["00_前期研究/_inbox/ignore.exe"]);
    await expect(fs.pathExists(path.join(projectRoot, "00_前期研究", "_资料库", "SRC-0001", "source-card.md"))).resolves.toBe(true);
    expect(renderResearchInboxSummary(result)).toContain("ingested: 1");
  });

  test("inbox dry-run allocates unique planned source IDs", async () => {
    const projectRoot = await seedResearchProject();
    const inboxRoot = path.join(projectRoot, "00_前期研究", "_inbox");
    await fs.ensureDir(inboxRoot);
    await fs.writeFile(path.join(inboxRoot, "first.md"), "# First\n", "utf8");
    await fs.writeFile(path.join(inboxRoot, "second.txt"), "Second\n", "utf8");

    const result = await ingestResearchInbox({ projectRoot, dryRun: true });

    expect(result.ingested.map((item) => item.sourceId)).toEqual(["SRC-0001", "SRC-0002"]);
    await expect(fs.pathExists(path.join(projectRoot, "00_前期研究", "_资料库", "SRC-0001"))).resolves.toBe(false);
    await expect(fs.pathExists(path.join(projectRoot, "00_前期研究", "_资料库", "SRC-0002"))).resolves.toBe(false);
  });
});
