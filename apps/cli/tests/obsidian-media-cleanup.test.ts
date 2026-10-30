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
import { mediaReviewDirectory, userNotesDirectory } from "../src/lib/obsidian/routes.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

async function makeProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "avw-obsidian-media-cleanup-"));
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
  const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "avw-obsidian-media-cleanup-vault-"));
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

/** 首次导出用 force（干净起点）；后续导出不加 force，才能观察清理效果。 */
async function exportVault(projectRoot: string, outRoot: string, options: { force?: boolean } = {}): Promise<void> {
  await exportObsidianVault({
    projectRoot,
    outRoot,
    ...(options.force ? { force: true } : {}),
    includePluginRecipes: true
  });
}

describe("素材副本孤儿清理", () => {
  test("导出一次后 vault 的 05_素材审阅/_素材 下出现副本", async () => {
    const projectRoot = await makeProject();
    const selected = candidate({ selected: true });
    await writeRecord(projectRoot, recordWith(keyframeIdentity, "镜头-001 关键帧 01", [selected], selected.fileName));
    await writeMediaFile(projectRoot, keyframeIdentity, selected.fileName);

    const outRoot = await makeOutRoot();
    await exportVault(projectRoot, outRoot, { force: true });

    const copiedPath = vaultFsPath(outRoot, expectedAssetVaultPath(selected.fileName));
    expect(await fs.pathExists(copiedPath)).toBe(true);
    expect(await fs.readFile(copiedPath, "utf8")).toBe("media-bytes");
  });

  test("从素材记录里去掉某个候选后再导出，对应副本被清理、保留下来的候选副本仍在", async () => {
    const projectRoot = await makeProject();
    const first = candidate({ version: 1, candidate: 1, fileName: "镜头-001_关键帧-01_v001_c01.png" });
    const second = candidate({ version: 2, candidate: 1, fileName: "镜头-001_关键帧-01_v002_c01.png" });
    await writeMediaFile(projectRoot, keyframeIdentity, first.fileName);
    await writeMediaFile(projectRoot, keyframeIdentity, second.fileName);
    await writeRecord(projectRoot, recordWith(keyframeIdentity, "镜头-001 关键帧 01", [first, second], second.fileName));

    const outRoot = await makeOutRoot();
    await exportVault(projectRoot, outRoot, { force: true });
    expect(await fs.pathExists(vaultFsPath(outRoot, expectedAssetVaultPath(first.fileName)))).toBe(true);
    expect(await fs.pathExists(vaultFsPath(outRoot, expectedAssetVaultPath(second.fileName)))).toBe(true);

    // 用户删掉了第一轮候选：记录只保留第二轮，源文件也一并删掉。
    await fs.remove(path.join(projectRoot, ...(mediaOutputDirectory(keyframeIdentity) + "/" + first.fileName).split("/")));
    await writeRecord(projectRoot, recordWith(keyframeIdentity, "镜头-001 关键帧 01", [second], second.fileName));
    await exportVault(projectRoot, outRoot);

    expect(await fs.pathExists(vaultFsPath(outRoot, expectedAssetVaultPath(first.fileName)))).toBe(false);
    expect(await fs.pathExists(vaultFsPath(outRoot, expectedAssetVaultPath(second.fileName)))).toBe(true);
    // 页面 md 不受清理影响。
    expect(await fs.pathExists(vaultFsPath(outRoot, mediaReviewDirectory + "/00_素材总览.md"))).toBe(true);
  });

  test("清理不会动 _素材 之外的用户笔记文件", async () => {
    const projectRoot = await makeProject();
    const first = candidate({ version: 1, candidate: 1, fileName: "镜头-001_关键帧-01_v001_c01.png" });
    const second = candidate({ version: 2, candidate: 1, fileName: "镜头-001_关键帧-01_v002_c01.png" });
    await writeMediaFile(projectRoot, keyframeIdentity, first.fileName);
    await writeMediaFile(projectRoot, keyframeIdentity, second.fileName);
    await writeRecord(projectRoot, recordWith(keyframeIdentity, "镜头-001 关键帧 01", [first, second], second.fileName));

    const outRoot = await makeOutRoot();
    await exportVault(projectRoot, outRoot, { force: true });

    const userNoteVaultPath = userNotesDirectory + "/我的审阅意见.md";
    const userNotePath = vaultFsPath(outRoot, userNoteVaultPath);
    await fs.outputFile(userNotePath, "这是我自己的笔记，导出不能删。", "utf8");

    // 删掉一个候选并再次导出，触发孤儿清理。
    await fs.remove(path.join(projectRoot, ...(mediaOutputDirectory(keyframeIdentity) + "/" + first.fileName).split("/")));
    await writeRecord(projectRoot, recordWith(keyframeIdentity, "镜头-001 关键帧 01", [second], second.fileName));
    await exportVault(projectRoot, outRoot);

    expect(await fs.pathExists(vaultFsPath(outRoot, expectedAssetVaultPath(first.fileName)))).toBe(false);
    expect(await fs.pathExists(userNotePath)).toBe(true);
    expect(await fs.readFile(userNotePath, "utf8")).toBe("这是我自己的笔记，导出不能删。");
  });

  test("没有 素材记录 目录时导出后既没有 05_素材审阅 也没有 _素材", async () => {
    const projectRoot = await makeProject();
    await fs.remove(path.join(projectRoot, mediaRecordsDirectory));

    const outRoot = await makeOutRoot();
    await exportVault(projectRoot, outRoot, { force: true });

    expect(await fs.pathExists(vaultFsPath(outRoot, mediaReviewDirectory))).toBe(false);
    expect(await fs.pathExists(vaultFsPath(outRoot, mediaReviewDirectory + "/_素材"))).toBe(false);
  });
});
