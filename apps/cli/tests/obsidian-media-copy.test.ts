import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { createProject } from "../src/lib/init.js";
import {
  mediaOutputDirectory,
  mediaRecordPath,
  mediaRecordsDirectory,
  renderMediaRecord,
  type MediaCandidateRecord,
  type MediaIdentity,
  type MediaRecord
} from "../src/lib/media-records.js";
import { exportObsidianVault } from "../src/lib/obsidian/export.js";
import { planMediaReviewAssets } from "../src/lib/obsidian/media-viewer.js";
import { mediaReviewDirectory, mediaReviewPagePath } from "../src/lib/obsidian/routes.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

async function makeProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "avw-obsidian-media-copy-"));
  tempRoots.push(root);
  await createProject({
    targetRoot: root,
    projectName: "demo",
    pack: "official-ai-video",
    ide: "codex",
    imagePlatform: "openai",
    videoPlatform: "seedance"
  });
  return path.join(root, "demo");
}

async function makeOutRoot(): Promise<string> {
  const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "avw-obsidian-media-copy-vault-"));
  tempRoots.push(outRoot);
  return outRoot;
}

function candidate(overrides: Partial<MediaCandidateRecord> = {}): MediaCandidateRecord {
  return {
    version: 1,
    candidate: 1,
    fileName: "镜头-001_关键帧-01_v001_c01.png",
    platformStatus: "completed",
    downloadStatus: "downloaded",
    reviewStatus: "unreviewed",
    selected: false,
    ...overrides
  };
}

const keyframeIdentity: MediaIdentity = { category: "keyframe", objectId: "镜头-001", purpose: "关键帧-01" };

async function writeRecord(projectRoot: string, record: MediaRecord): Promise<void> {
  const recordFile = path.join(projectRoot, ...mediaRecordPath(record.identity).split("/"));
  await fs.outputFile(recordFile, renderMediaRecord(record), "utf8");
}

async function writeMediaFile(projectRoot: string, identity: MediaIdentity, fileName: string): Promise<string> {
  const relative = mediaOutputDirectory(identity) + "/" + fileName;
  await fs.outputFile(path.join(projectRoot, ...relative.split("/")), "media-bytes", "utf8");
  return relative;
}

function recordWith(identity: MediaIdentity, displayName: string, candidates: MediaCandidateRecord[], currentSelection?: string): MediaRecord {
  return {
    identity,
    displayName,
    source: "generated",
    ...(currentSelection ? { currentSelection } : {}),
    candidates,
    createdAt: "2026-10-22T00:00:00.000Z",
    updatedAt: "2026-10-22T00:00:00.000Z"
  };
}

function vaultFsPath(outRoot: string, vaultPath: string): string {
  return path.join(outRoot, ...vaultPath.split("/"));
}

/** 05_素材审阅/_素材/关键帧/镜头-001/<文件名> */
function expectedAssetVaultPath(fileName: string): string {
  return [mediaReviewDirectory, "_素材", "关键帧", "镜头-001", fileName].join("/");
}

async function exportVault(projectRoot: string): Promise<{ outRoot: string; files: { vaultPath: string; content: string }[] }> {
  const outRoot = await makeOutRoot();
  const result = await exportObsidianVault({ projectRoot, outRoot, force: true, includePluginRecipes: true });
  return { outRoot, files: result.files };
}

describe("素材副本复制进 vault", () => {
  test("素材文件存在时复制到 vault 的 05_素材审阅/_素材 下，页面嵌入写 vault 内路径", async () => {
    const projectRoot = await makeProject();
    const selected = candidate({ selected: true });
    await writeRecord(projectRoot, recordWith(keyframeIdentity, "镜头-001 关键帧 01", [selected], selected.fileName));
    const projectRelativeFile = await writeMediaFile(projectRoot, keyframeIdentity, selected.fileName);

    const { outRoot, files } = await exportVault(projectRoot);

    // 1) vault 内出现副本，且内容与源文件一致
    const assetVaultPath = expectedAssetVaultPath(selected.fileName);
    const copiedPath = vaultFsPath(outRoot, assetVaultPath);
    expect(await fs.pathExists(copiedPath)).toBe(true);
    expect(await fs.readFile(copiedPath, "utf8")).toBe("media-bytes");

    // 2) 页面嵌入指向 vault 内副本，不再写项目相对路径
    const pagePath = mediaReviewPagePath("keyframe", "镜头-001", "关键帧-01");
    const page = files.find((file) => file.vaultPath === pagePath)!.content;
    expect(page).toContain("![[05_素材审阅/_素材/关键帧/镜头-001/" + selected.fileName + "]]");
    expect(page).not.toContain("![[" + projectRelativeFile + "]]");
    expect(page).not.toContain("文件缺失");

    // 3) 清单本身也指向同一份 vault 内副本
    const assets = await planMediaReviewAssets(projectRoot);
    expect(assets).toHaveLength(1);
    expect(assets[0].vaultPath).toBe(assetVaultPath);
    expect(assets[0].exists).toBe(true);
    expect(assets[0].sourcePath).toBe(path.join(projectRoot, ...projectRelativeFile.split("/")));
  });

  test("素材文件不存在时不复制、不抛错，页面写「文件缺失」", async () => {
    const projectRoot = await makeProject();
    // 下载失败、文件确实不在：记录如实写「下载失败」，项目本身仍通过校验。
    const selected = candidate({ selected: true, downloadStatus: "failed", failureClass: "local-save-failed" });
    await writeRecord(projectRoot, recordWith(keyframeIdentity, "镜头-001 关键帧 01", [selected], selected.fileName));
    const projectRelativeFile = mediaOutputDirectory(keyframeIdentity) + "/" + selected.fileName;

    const { outRoot, files } = await exportVault(projectRoot);

    const pagePath = mediaReviewPagePath("keyframe", "镜头-001", "关键帧-01");
    const page = files.find((file) => file.vaultPath === pagePath)!.content;
    expect(page).toContain("文件缺失：" + projectRelativeFile);
    expect(page).not.toContain("05_素材审阅/_素材");

    // 没有复制出任何素材副本
    expect(await fs.pathExists(vaultFsPath(outRoot, expectedAssetVaultPath(selected.fileName)))).toBe(false);

    // 清单仍列出该候选，但标记为不存在
    const assets = await planMediaReviewAssets(projectRoot);
    expect(assets).toHaveLength(1);
    expect(assets[0].exists).toBe(false);
  });

  test("记录写已下载但文件不在时，导出被校验拦住而不是悄悄导出", async () => {
    const projectRoot = await makeProject();
    const selected = candidate({ selected: true });
    await writeRecord(projectRoot, recordWith(keyframeIdentity, "镜头-001 关键帧 01", [selected], selected.fileName));

    await expect(exportVault(projectRoot)).rejects.toThrow(/media-record-missing-file/u);
  });

  test("没有 素材记录 目录时不生成 05_素材审阅 目录，也不出现 _素材 目录", async () => {
    const projectRoot = await makeProject();
    await fs.remove(path.join(projectRoot, mediaRecordsDirectory));

    const { outRoot, files } = await exportVault(projectRoot);

    expect(files.filter((file) => file.vaultPath.startsWith(mediaReviewDirectory + "/"))).toEqual([]);
    expect(await fs.pathExists(vaultFsPath(outRoot, mediaReviewDirectory))).toBe(false);
    expect(await fs.pathExists(vaultFsPath(outRoot, mediaReviewDirectory + "/_素材"))).toBe(false);
    expect(await planMediaReviewAssets(projectRoot)).toEqual([]);
  });
});
