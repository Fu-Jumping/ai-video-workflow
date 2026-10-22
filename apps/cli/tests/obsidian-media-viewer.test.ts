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
import { renderMediaReviewFiles } from "../src/lib/obsidian/media-viewer.js";
import {
  mediaReviewDirectory,
  mediaReviewIndexPath,
  mediaReviewPagePath
} from "../src/lib/obsidian/routes.js";
import { verifyObsidianVault } from "../src/lib/obsidian/verify.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

async function makeProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "avw-obsidian-media-viewer-"));
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
  const outRoot = await fs.mkdtemp(path.join(os.tmpdir(), "avw-obsidian-media-viewer-vault-"));
  tempRoots.push(outRoot);
  return outRoot;
}

function candidate(overrides: Partial<MediaCandidateRecord> = {}): MediaCandidateRecord {
  return {
    version: 1,
    candidate: 1,
    fileName: "角色-001_造型-01_v001_c01.png",
    platformStatus: "completed",
    downloadStatus: "downloaded",
    reviewStatus: "unreviewed",
    selected: false,
    ...overrides
  };
}

const characterIdentity: MediaIdentity = { category: "character", objectId: "角色-001", purpose: "造型-01" };
const keyframeIdentity: MediaIdentity = { category: "keyframe", objectId: "镜头-015", purpose: "关键帧-01" };
const videoIdentity: MediaIdentity = { category: "video", objectId: "镜头-015", purpose: "视频" };

async function writeRecord(projectRoot: string, record: MediaRecord): Promise<void> {
  const recordFile = path.join(projectRoot, ...mediaRecordPath(record.identity).split("/"));
  await fs.outputFile(recordFile, renderMediaRecord(record), "utf8");
}

async function writeMediaFile(projectRoot: string, identity: MediaIdentity, fileName: string): Promise<string> {
  const relative = mediaOutputDirectory(identity) + "/" + fileName;
  const absolute = path.join(projectRoot, ...relative.split("/"));
  await fs.outputFile(absolute, "media-bytes", "utf8");
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

async function exportVault(projectRoot: string): Promise<{ outRoot: string; files: { vaultPath: string; content: string }[] }> {
  const outRoot = await makeOutRoot();
  const result = await exportObsidianVault({ projectRoot, outRoot, force: true, includePluginRecipes: true });
  return { outRoot, files: result.files };
}

describe("素材审阅页（B3）", () => {
  test("项目没有 素材记录/ 目录时不生成任何 05_素材审阅 文件", async () => {
    const projectRoot = await makeProject();
    await fs.remove(path.join(projectRoot, mediaRecordsDirectory));

    const { files } = await exportVault(projectRoot);

    expect(files.filter((file) => file.vaultPath.startsWith(mediaReviewDirectory + "/"))).toEqual([]);
    expect(files.some((file) => file.vaultPath === mediaReviewIndexPath)).toBe(false);
    // 首页没有素材审阅入口，导出结果与新增本模块之前一致。
    const home = files.find((file) => file.vaultPath === "00_开始审阅/00_项目首页.md");
    expect(home).toBeDefined();
    expect(home!.content).not.toContain("素材审阅");
  });

  test("一条带三个候选的素材记录生成总览页与单条页，四种状态分别出现且不合并", async () => {
    const projectRoot = await makeProject();
    const selected = candidate({ version: 1, candidate: 1, reviewStatus: "accepted", selected: true });
    const failed = candidate({
      version: 2,
      candidate: 1,
      fileName: "角色-001_造型-01_v002_c01.png",
      platformStatus: "failed",
      downloadStatus: "failed",
      failureClass: "remote-failed"
    });
    const unknown = candidate({
      version: 3,
      candidate: 1,
      fileName: "角色-001_造型-01_v003_c01.png",
      platformStatus: "unknown",
      downloadStatus: "unknown"
    });
    await writeRecord(projectRoot, recordWith(characterIdentity, "女主 阿云", [selected, failed, unknown], selected.fileName));
    await writeMediaFile(projectRoot, characterIdentity, selected.fileName);

    const { outRoot, files } = await exportVault(projectRoot);

    const pagePath = mediaReviewPagePath("character", "角色-001", "造型-01");
    const vaultPaths = files.map((file) => file.vaultPath);
    expect(vaultPaths).toContain(mediaReviewIndexPath);
    expect(vaultPaths).toContain(pagePath);
    expect(await fs.pathExists(path.join(outRoot, ...pagePath.split("/")))).toBe(true);

    const page = files.find((file) => file.vaultPath === pagePath)!.content;
    // 身份三段
    expect(page).toContain("类别：角色");
    expect(page).toContain("对象编号：角色-001");
    expect(page).toContain("用途：造型-01");
    expect(page).toContain("女主 阿云");
    // 四种状态分别出现
    expect(page).toContain("已选用");
    expect(page).toContain("平台失败");
    expect(page).toContain("下载失败");
    expect(page).toContain("状态未知");
    // 状态列没有被合并成一列
    expect(page).toContain("| 版本 | 候选 | 文件 | 平台 | 下载 | 审核 | 选用 | 当前状态 | 说明 |");
    expect(page).toContain("v001");
    expect(page).toContain("v002");
    expect(page).toContain("v003");

    const index = files.find((file) => file.vaultPath === mediaReviewIndexPath)!.content;
    expect(index).toContain("女主 阿云");
    expect(index).toContain("v001 / c01");
  });

  test("单条页嵌入指向真实文件；文件删掉后写“文件缺失”且不抛错", async () => {
    const projectRoot = await makeProject();
    const selected = candidate({ selected: true });
    await writeRecord(projectRoot, recordWith(characterIdentity, "女主 阿云", [selected], selected.fileName));
    const relativeFile = await writeMediaFile(projectRoot, characterIdentity, selected.fileName);

    const first = await exportVault(projectRoot);
    const pagePath = mediaReviewPagePath("character", "角色-001", "造型-01");
    const firstPage = first.files.find((file) => file.vaultPath === pagePath)!.content;
    // 素材会复制进 vault，页面嵌入指向 vault 内副本，而不是项目相对路径。
    const embed = "![[05_素材审阅/_素材/参考素材/角色-001/" + selected.fileName + "]]";
    expect(firstPage).toContain(embed);
    expect(firstPage).not.toContain("文件缺失");
    // 源文件在项目里真实存在
    expect(await fs.pathExists(path.join(projectRoot, ...relativeFile.split("/")))).toBe(true);

    // 删掉素材文件后重跑：页面写“文件缺失”，且导出不抛错。
    await fs.remove(path.join(projectRoot, ...relativeFile.split("/")));
    const rendered = await renderMediaReviewFiles(projectRoot);
    const rerenderedPage = rendered.find((file) => file.vaultPath === pagePath)!.content;
    expect(rerenderedPage).toContain("文件缺失：" + relativeFile);
    expect(rerenderedPage).not.toContain(embed);

    // 记录同步改成下载失败后再次导出，仍然不抛错，页面保留“文件缺失”。
    await writeRecord(
      projectRoot,
      recordWith(
        characterIdentity,
        "女主 阿云",
        [candidate({ selected: true, platformStatus: "failed", downloadStatus: "failed", failureClass: "local-save-failed" })],
        selected.fileName
      )
    );
    const second = await exportVault(projectRoot);
    const secondPage = second.files.find((file) => file.vaultPath === pagePath)!.content;
    expect(secondPage).toContain("文件缺失：" + relativeFile);
    expect(secondPage).not.toContain(embed);
  });

  test("总览页每类素材都有相对链接，且链接目标文件确实被生成", async () => {
    const projectRoot = await makeProject();
    await writeRecord(
      projectRoot,
      recordWith(characterIdentity, "女主 阿云", [candidate({ selected: true })], "角色-001_造型-01_v001_c01.png")
    );
    await writeMediaFile(projectRoot, characterIdentity, "角色-001_造型-01_v001_c01.png");
    await writeRecord(
      projectRoot,
      recordWith(
        keyframeIdentity,
        "镜头-015 关键帧 01",
        [candidate({ fileName: "镜头-015_关键帧-01_v001_c01.png", selected: true })],
        "镜头-015_关键帧-01_v001_c01.png"
      )
    );
    await writeMediaFile(projectRoot, keyframeIdentity, "镜头-015_关键帧-01_v001_c01.png");
    await writeRecord(
      projectRoot,
      recordWith(
        videoIdentity,
        "镜头-015 视频",
        [candidate({ fileName: "镜头-015_v001_c01.mp4", selected: true })],
        "镜头-015_v001_c01.mp4"
      )
    );
    await writeMediaFile(projectRoot, videoIdentity, "镜头-015_v001_c01.mp4");

    const { outRoot, files } = await exportVault(projectRoot);

    const index = files.find((file) => file.vaultPath === mediaReviewIndexPath)!.content;
    const pagePaths = [
      mediaReviewPagePath("character", "角色-001", "造型-01"),
      mediaReviewPagePath("keyframe", "镜头-015", "关键帧-01"),
      mediaReviewPagePath("video", "镜头-015", "视频")
    ];
    expect(index).toContain("## 1. 角色");
    expect(index).toContain("## 5. 关键帧");
    expect(index).toContain("## 6. 视频");
    for (const pagePath of pagePaths) {
      const linkTarget = pagePath.slice(0, -".md".length);
      expect(index).toContain("[[" + linkTarget + "|");
      expect(await fs.pathExists(path.join(outRoot, ...pagePath.split("/")))).toBe(true);
    }
  });

  test("有素材记录但缺少单条素材页时 verify 报一条问题", async () => {
    const projectRoot = await makeProject();
    const selected = candidate({ selected: true });
    await writeRecord(projectRoot, recordWith(characterIdentity, "女主 阿云", [selected], selected.fileName));
    await writeMediaFile(projectRoot, characterIdentity, selected.fileName);

    const { outRoot } = await exportVault(projectRoot);
    const pagePath = mediaReviewPagePath("character", "角色-001", "造型-01");
    await fs.remove(path.join(outRoot, ...pagePath.split("/")));

    const result = await verifyObsidianVault({ projectRoot, vaultRoot: outRoot });
    const pageIssues = result.issues.filter(
      (issue) => issue.path === pagePath && issue.code === "missing-obsidian-dashboard"
    );
    expect(pageIssues.length).toBe(1);
    expect(pageIssues[0].message).toContain(pagePath);
  });
});
