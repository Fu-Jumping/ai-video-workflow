import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { createProject } from "../src/lib/init.js";
import { verifyProject } from "../src/lib/verify.js";
import {
  allocateMediaTarget,
  describeMediaFile,
  existingMediaVersions,
  formatMediaCandidate,
  formatMediaVersion,
  mediaFileStem,
  mediaIdentityKey,
  mediaOutputDirectory,
  mediaProjectDirectories,
  mediaRecordPath,
  nextMediaVersion,
  parseMediaFileName,
  parseMediaRecord,
  renderMediaRecord,
  reserveMediaBatch,
  verifyMediaRecords,
  type MediaCandidateRecord,
  type MediaIdentity,
  type MediaRecord
} from "../src/lib/media-records.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

async function makeProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "avw-media-records-"));
  tempRoots.push(root);
  const projectRoot = path.join(root, "demo");
  await createProject({
    targetRoot: root,
    projectName: "demo",
    pack: "official-ai-video",
    ide: "codex",
    imagePlatform: "openai",
    videoPlatform: "seedance"
  });
  return projectRoot;
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
const shotIdentity: MediaIdentity = { category: "keyframe", objectId: "镜头-015", purpose: "关键帧-01" };
const videoIdentity: MediaIdentity = { category: "video", objectId: "镜头-015", purpose: "视频" };

describe("素材记录：稳定身份与命名", () => {
  test("身份键由类别、对象编号与用途组成，展示名不参与", () => {
    expect(mediaIdentityKey(characterIdentity)).toBe("character:角色-001/造型-01");
    const record: MediaRecord = {
      identity: characterIdentity,
      displayName: "女主 阿云",
      source: "generated",
      candidates: [candidate()],
      createdAt: "2026-10-22T00:00:00.000Z",
      updatedAt: "2026-10-22T00:00:00.000Z"
    };
    const parsed = parseMediaRecord(renderMediaRecord(record));
    expect(parsed).toBeDefined();
    expect(mediaIdentityKey(parsed!.identity)).toBe("character:角色-001/造型-01");

    const renamed = parseMediaRecord(renderMediaRecord({ ...record, displayName: "阿云（成年）" }));
    expect(mediaIdentityKey(renamed!.identity)).toBe(mediaIdentityKey(record.identity));
  });

  test("同一对象的不同用途落在不同目录与不同记录，不互相覆盖", () => {
    const closeUp: MediaIdentity = { category: "character", objectId: "角色-001", purpose: "特写-01" };
    expect(mediaOutputDirectory(characterIdentity)).not.toBe(mediaOutputDirectory(closeUp));
    expect(mediaRecordPath(characterIdentity)).not.toBe(mediaRecordPath(closeUp));
  });

  test("视频没有用途段，关键帧带用途段", () => {
    expect(mediaFileStem(videoIdentity, 1, 1)).toBe("镜头-015_v001_c01");
    expect(mediaFileStem(shotIdentity, 2, 3)).toBe("镜头-015_关键帧-01_v002_c03");
  });

  test("文件名可以解析回对象、用途、轮次与候选", () => {
    const parsed = parseMediaFileName("镜头-015_关键帧-01_v002_c03.png");
    expect(parsed).toEqual({
      objectId: "镜头-015",
      purpose: "关键帧-01",
      version: 2,
      candidate: 3,
      extension: ".png"
    });
    expect(parseMediaFileName("随便一张图.png")).toBeUndefined();
  });

  test("编号补零：轮次三位、候选两位", () => {
    expect(formatMediaVersion(1)).toBe("v001");
    expect(formatMediaVersion(12)).toBe("v012");
    expect(formatMediaCandidate(1)).toBe("c01");
    expect(formatMediaCandidate(9)).toBe("c09");
  });
});

describe("素材记录：轮次与候选", () => {
  test("轮次只增不减，失败轮次不回收", async () => {
    const projectRoot = await makeProject();
    const first = await reserveMediaBatch(projectRoot, {
      identity: characterIdentity,
      mode: "generate",
      prompt: "第一次提交",
      references: [],
      candidates: [],
      sources: []
    });
    expect(first.version).toBe(1);

    const second = await reserveMediaBatch(projectRoot, {
      identity: characterIdentity,
      mode: "generate",
      prompt: "第二次提交（上一轮失败了）",
      references: [],
      candidates: [],
      sources: []
    });
    expect(second.version).toBe(2);
    expect(nextMediaVersion(await existingMediaVersions(projectRoot, characterIdentity))).toBe(3);
  });

  test("并行提交不会抢到同一个轮次号", async () => {
    const projectRoot = await makeProject();
    const batches = await Promise.all(
      Array.from({ length: 4 }, (_unused, index) =>
        reserveMediaBatch(projectRoot, {
          identity: characterIdentity,
          mode: "generate",
          prompt: "并行提交 " + String(index),
          references: [],
          candidates: [],
          sources: []
        })
      )
    );
    const versions = batches.map((batch) => batch.version).sort((a, b) => a - b);
    expect(versions).toEqual([1, 2, 3, 4]);
  });

  test("同一轮的多个候选各自占号，写入前不会覆盖已有文件", async () => {
    const projectRoot = await makeProject();
    const batch = await reserveMediaBatch(projectRoot, {
      identity: shotIdentity,
      mode: "generate",
      prompt: "一次出四张",
      references: [],
      candidates: [],
      sources: []
    });
    const targets = [];
    for (let index = 0; index < 4; index += 1) {
      const target = await allocateMediaTarget(projectRoot, shotIdentity, batch.version, "png");
      await fs.writeFile(target.filePath, "candidate " + String(index), "utf8");
      targets.push(target);
    }
    expect(targets.map((target) => target.candidate)).toEqual([1, 2, 3, 4]);
    expect(new Set(targets.map((target) => target.fileName)).size).toBe(4);
  });

  test("补下载沿用原轮次，不重新排号", async () => {
    const projectRoot = await makeProject();
    const batch = await reserveMediaBatch(projectRoot, {
      identity: shotIdentity,
      mode: "generate",
      prompt: "生成后下载失败",
      references: [],
      candidates: [],
      sources: []
    });
    const target = await allocateMediaTarget(projectRoot, shotIdentity, batch.version, "png");
    await fs.writeFile(target.filePath, "", "utf8");

    const empty = await describeMediaFile(target.filePath);
    expect(empty?.bytes).toBe(0);

    await fs.writeFile(target.filePath, "补下载的内容", "utf8");
    const restored = await describeMediaFile(target.filePath);
    expect(restored?.bytes).toBeGreaterThan(0);
    expect(target.version).toBe(batch.version);
    expect(parseMediaFileName(target.fileName)?.version).toBe(batch.version);
  });

  test("批次记录固定当时的提示词与参考图顺序", async () => {
    const projectRoot = await makeProject();
    const batch = await reserveMediaBatch(projectRoot, {
      identity: characterIdentity,
      mode: "generate",
      prompt: "三视图正面，米白长衫",
      references: [
        { order: 1, fileName: "造型-01_v001_c01.png", purpose: "造型-01" },
        { order: 2, fileName: "场景-003_环境全景_v001_c01.png", purpose: "环境全景" }
      ],
      platform: "libtv",
      model: "gpt-image-2",
      candidates: [{ candidate: 1, fileName: "角色-001_造型-01_v001_c01.png", complete: true }],
      sources: [{ kind: "提示词", path: "04_图片提示词/镜头组-001/图片提示词.md" }]
    });
    expect(batch.version).toBe(1);
    const batchFile = path.join(projectRoot, "素材记录", "生成批次", "角色-001_造型-01_v001.md");
    expect(await fs.pathExists(batchFile)).toBe(true);
    const content = await fs.readFile(batchFile, "utf8");
    expect(content).toContain("三视图正面，米白长衫");
    expect(content).toContain("1. 造型-01_v001_c01.png");
    expect(content).toContain("2. 场景-003_环境全景_v001_c01.png");
  });
});

describe("素材记录：四个状态分开", () => {
  test("平台已完成但没下载，不会被写成已下载", async () => {
    const projectRoot = await makeProject();
    const record: MediaRecord = {
      identity: characterIdentity,
      displayName: "女主",
      source: "generated",
      candidates: [candidate({ downloadStatus: "not-downloaded" })],
      createdAt: "2026-10-22T00:00:00.000Z",
      updatedAt: "2026-10-22T00:00:00.000Z"
    };
    const recordFile = path.join(projectRoot, mediaRecordPath(characterIdentity));
    await fs.ensureDir(path.dirname(recordFile));
    await fs.writeFile(recordFile, renderMediaRecord(record), "utf8");

    const parsed = parseMediaRecord(await fs.readFile(recordFile, "utf8"));
    expect(parsed!.candidates[0].platformStatus).toBe("completed");
    expect(parsed!.candidates[0].downloadStatus).toBe("not-downloaded");
    expect(parsed!.candidates[0].reviewStatus).toBe("unreviewed");
    expect(parsed!.candidates[0].selected).toBe(false);
  });

  test("下载成功也不会自动变成已审或已选用", async () => {
    const projectRoot = await makeProject();
    const target = await allocateMediaTarget(projectRoot, characterIdentity, 1, "png");
    await fs.writeFile(target.filePath, "真实图片字节", "utf8");
    const described = await describeMediaFile(target.filePath);
    const record: MediaRecord = {
      identity: characterIdentity,
      displayName: "女主",
      source: "generated",
      candidates: [
        candidate({
          fileName: target.fileName,
          bytes: described!.bytes,
          sha256: described!.sha256
        })
      ],
      createdAt: "2026-10-22T00:00:00.000Z",
      updatedAt: "2026-10-22T00:00:00.000Z"
    };
    const recordFile = path.join(projectRoot, mediaRecordPath(characterIdentity));
    await fs.ensureDir(path.dirname(recordFile));
    await fs.writeFile(recordFile, renderMediaRecord(record), "utf8");

    const issues: Parameters<typeof verifyMediaRecords>[1] = [];
    await verifyMediaRecords(projectRoot, issues);
    expect(issues).toEqual([]);

    const parsed = parseMediaRecord(await fs.readFile(recordFile, "utf8"));
    expect(parsed!.candidates[0].reviewStatus).toBe("unreviewed");
    expect(parsed!.candidates[0].selected).toBe(false);
    expect(parsed!.currentSelection).toBeUndefined();
  });
});

describe("素材记录：三类失败与自检", () => {
  test("远端状态未知、远端明确失败、本地保存失败各自记录", () => {
    const record: MediaRecord = {
      identity: shotIdentity,
      displayName: "镜头 015 关键帧 01",
      source: "generated",
      candidates: [
        candidate({ candidate: 1, fileName: "a.png", platformStatus: "unknown", downloadStatus: "unknown", failureClass: "remote-unknown" }),
        candidate({ candidate: 2, fileName: "b.png", platformStatus: "failed", downloadStatus: "not-downloaded", failureClass: "remote-failed" }),
        candidate({ candidate: 3, fileName: "c.png", platformStatus: "completed", downloadStatus: "failed", failureClass: "local-save-failed" })
      ],
      createdAt: "2026-10-22T00:00:00.000Z",
      updatedAt: "2026-10-22T00:00:00.000Z"
    };
    const parsed = parseMediaRecord(renderMediaRecord(record));
    expect(parsed!.candidates.map((entry) => entry.failureClass)).toEqual([
      "remote-unknown",
      "remote-failed",
      "local-save-failed"
    ]);
  });

  test("空文件不会被当作完整下载", async () => {
    const projectRoot = await makeProject();
    const target = await allocateMediaTarget(projectRoot, shotIdentity, 1, "png");
    await fs.writeFile(target.filePath, "", "utf8");
    const record: MediaRecord = {
      identity: shotIdentity,
      displayName: "镜头 015",
      source: "generated",
      candidates: [candidate({ fileName: target.fileName, downloadStatus: "downloaded", bytes: 0 })],
      createdAt: "2026-10-22T00:00:00.000Z",
      updatedAt: "2026-10-22T00:00:00.000Z"
    };
    const recordFile = path.join(projectRoot, mediaRecordPath(shotIdentity));
    await fs.ensureDir(path.dirname(recordFile));
    await fs.writeFile(recordFile, renderMediaRecord(record), "utf8");

    const issues: Parameters<typeof verifyMediaRecords>[1] = [];
    await verifyMediaRecords(projectRoot, issues);
    expect(issues.map((issue) => issue.code)).toContain("media-record-empty-file");
  });

  test("下载中断留下的半文件会因大小不符被报出来", async () => {
    const projectRoot = await makeProject();
    const target = await allocateMediaTarget(projectRoot, shotIdentity, 1, "png");
    await fs.writeFile(target.filePath, "只有半截", "utf8");
    const record: MediaRecord = {
      identity: shotIdentity,
      displayName: "镜头 015",
      source: "generated",
      candidates: [candidate({ fileName: target.fileName, downloadStatus: "downloaded", bytes: 999999 })],
      createdAt: "2026-10-22T00:00:00.000Z",
      updatedAt: "2026-10-22T00:00:00.000Z"
    };
    const recordFile = path.join(projectRoot, mediaRecordPath(shotIdentity));
    await fs.ensureDir(path.dirname(recordFile));
    await fs.writeFile(recordFile, renderMediaRecord(record), "utf8");

    const issues: Parameters<typeof verifyMediaRecords>[1] = [];
    await verifyMediaRecords(projectRoot, issues);
    expect(issues.map((issue) => issue.code)).toContain("media-record-size-mismatch");
  });

  test("记录说已下载但文件不存在时报出来", async () => {
    const projectRoot = await makeProject();
    const record: MediaRecord = {
      identity: shotIdentity,
      displayName: "镜头 015",
      source: "generated",
      candidates: [candidate({ fileName: "镜头-015_关键帧-01_v001_c01.png" })],
      createdAt: "2026-10-22T00:00:00.000Z",
      updatedAt: "2026-10-22T00:00:00.000Z"
    };
    const recordFile = path.join(projectRoot, mediaRecordPath(shotIdentity));
    await fs.ensureDir(path.dirname(recordFile));
    await fs.writeFile(recordFile, renderMediaRecord(record), "utf8");

    const issues: Parameters<typeof verifyMediaRecords>[1] = [];
    await verifyMediaRecords(projectRoot, issues);
    expect(issues.map((issue) => issue.code)).toContain("media-record-missing-file");
  });

  test("重开项目后能从记录恢复同一份索引", async () => {
    const projectRoot = await makeProject();
    const target = await allocateMediaTarget(projectRoot, characterIdentity, 1, "png");
    await fs.writeFile(target.filePath, "图片内容", "utf8");
    const described = await describeMediaFile(target.filePath);
    const record: MediaRecord = {
      identity: characterIdentity,
      displayName: "女主",
      source: "generated",
      currentSelection: target.fileName,
      candidates: [candidate({ fileName: target.fileName, bytes: described!.bytes, sha256: described!.sha256, selected: true })],
      createdAt: "2026-10-22T00:00:00.000Z",
      updatedAt: "2026-10-22T00:00:00.000Z"
    };
    const recordFile = path.join(projectRoot, mediaRecordPath(characterIdentity));
    await fs.ensureDir(path.dirname(recordFile));
    await fs.writeFile(recordFile, renderMediaRecord(record), "utf8");

    const reopened = parseMediaRecord(await fs.readFile(recordFile, "utf8"));
    expect(reopened!.currentSelection).toBe(target.fileName);
    expect(reopened!.candidates[0].selected).toBe(true);
    expect(reopened!.candidates[0].sha256).toBe(described!.sha256);
  });

  test("记录无法解析时给出 invalid-media-record", async () => {
    const projectRoot = await makeProject();
    const recordFile = path.join(projectRoot, "素材记录", "坏记录.md");
    await fs.writeFile(recordFile, "# 这不是记录\n", "utf8");
    const issues: Parameters<typeof verifyMediaRecords>[1] = [];
    await verifyMediaRecords(projectRoot, issues);
    expect(issues.map((issue) => issue.code)).toContain("invalid-media-record");
  });

  test("当前选用指向不存在的候选时报出来", async () => {
    const projectRoot = await makeProject();
    const record: MediaRecord = {
      identity: characterIdentity,
      displayName: "女主",
      source: "generated",
      currentSelection: "不存在_v001_c09.png",
      candidates: [candidate()],
      createdAt: "2026-10-22T00:00:00.000Z",
      updatedAt: "2026-10-22T00:00:00.000Z"
    };
    const recordFile = path.join(projectRoot, mediaRecordPath(characterIdentity));
    await fs.ensureDir(path.dirname(recordFile));
    await fs.writeFile(recordFile, renderMediaRecord(record), "utf8");
    const issues: Parameters<typeof verifyMediaRecords>[1] = [];
    await verifyMediaRecords(projectRoot, issues);
    expect(issues.map((issue) => issue.code)).toContain("media-record-selection-missing");
  });
});

describe("素材记录：项目初始化与既有项目兼容", () => {
  test("初始化后建出最小目录集与说明文件", async () => {
    const projectRoot = await makeProject();
    for (const dir of mediaProjectDirectories) {
      expect(await fs.pathExists(path.join(projectRoot, dir))).toBe(true);
    }
    expect(await fs.pathExists(path.join(projectRoot, "素材记录", "00_素材记录说明.md"))).toBe(true);
  });

  test("没有素材记录目录的既有项目完全不受影响", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "avw-media-legacy-"));
    tempRoots.push(root);
    const issues: Parameters<typeof verifyMediaRecords>[1] = [];
    await verifyMediaRecords(root, issues);
    expect(issues).toEqual([]);
  });

  test("初始化后的项目仍然通过完整校验", async () => {
    const projectRoot = await makeProject();
    const result = await verifyProject({ projectRoot, ide: "codex" });
    expect(result.issues.filter((issue) => issue.code.includes("media"))).toEqual([]);
  });
});
