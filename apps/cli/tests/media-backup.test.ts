import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  createMediaBackup,
  inspectProjectReferences,
  restoreMediaBackup,
  scanBackupEntries,
  verifyBackup
} from "../src/lib/media-backup.js";
import {
  mediaFileStem,
  mediaOutputDirectory,
  writeMediaRecord
} from "../src/lib/media-records.js";
import type { MediaRecord } from "../src/lib/media-records.js";

const tempRoots: string[] = [];

async function makeTempRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "avw-media-backup-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) await fs.remove(root);
  }
});

function sampleRecord(projectRoot: string, objectId: string): MediaRecord {
  const identity = { category: "character" as const, objectId, purpose: "三视图" };
  const firstFile = mediaFileStem(identity, 1, 1) + ".png";
  const secondFile = mediaFileStem(identity, 2, 1) + ".png";
  return {
    identity,
    displayName: "角色 " + objectId,
    source: "generated",
    currentSelection: firstFile,
    candidates: [
      {
        version: 1,
        candidate: 1,
        fileName: firstFile,
        platformStatus: "completed",
        downloadStatus: "downloaded",
        reviewStatus: "accepted",
        selected: true,
        taskId: "task-" + objectId,
        note: "原位置：" + projectRoot
      },
      {
        version: 2,
        candidate: 1,
        fileName: secondFile,
        platformStatus: "unknown",
        downloadStatus: "unknown",
        reviewStatus: "unreviewed",
        selected: false
      }
    ],
    notes: "工作目录：" + projectRoot,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z"
  };
}

async function seedProject(projectRoot: string): Promise<MediaRecord> {
  const record = sampleRecord(projectRoot, "角色-001");
  await writeMediaRecord(projectRoot, record);
  const directory = mediaOutputDirectory(record.identity);
  for (const candidate of record.candidates) {
    const absolute = path.join(projectRoot, directory, candidate.fileName);
    await fs.ensureDir(path.dirname(absolute));
    await fs.writeFile(absolute, Buffer.from([1, 2, 3, candidate.version]));
  }
  await fs.ensureDir(path.join(projectRoot, "assets/library/角色-001"));
  await fs.writeFile(path.join(projectRoot, "assets/library/角色-001/参考.png"), Buffer.from([9, 9, 9]));
  await fs.ensureDir(path.join(projectRoot, "工作记录/生成记录"));
  await fs.writeFile(path.join(projectRoot, "工作记录/生成记录/说明.md"), "# 说明\n");
  await fs.writeFile(path.join(projectRoot, "project.config.yaml"), "pack: official-ai-video\n");
  return record;
}

describe("media backup", () => {
  it("copies media content and writes a manifest that verifies", async () => {
    const root = await makeTempRoot();
    const projectRoot = path.join(root, "project");
    const backupRoot = path.join(root, "backup");
    await seedProject(projectRoot);

    const result = await createMediaBackup(projectRoot, backupRoot, { now: new Date("2026-10-22T00:00:00.000Z") });
    expect(result.manifest.entries.length).toBeGreaterThan(0);
    expect(await fs.pathExists(path.join(backupRoot, "备份清单.json"))).toBe(true);
    expect(await fs.pathExists(path.join(backupRoot, "素材记录/角色-001_三视图.md"))).toBe(true);

    const report = await verifyBackup(backupRoot);
    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.checked).toBe(result.manifest.entries.length);
  });

  it("keeps caches, ide private folders and credentials out of the backup", async () => {
    const root = await makeTempRoot();
    const projectRoot = path.join(root, "project");
    const backupRoot = path.join(root, "backup");
    await seedProject(projectRoot);
    await fs.ensureDir(path.join(projectRoot, "outputs/.libtv"));
    await fs.writeFile(path.join(projectRoot, "outputs/.libtv/state.json"), "{}");
    await fs.ensureDir(path.join(projectRoot, "outputs/_views/obsidian"));
    await fs.writeFile(path.join(projectRoot, "outputs/_views/obsidian/a.md"), "x");
    await fs.writeFile(path.join(projectRoot, "outputs/credentials.json"), "{}");
    await fs.writeFile(path.join(projectRoot, "assets/library/角色-001/.env"), "SECRET=1");

    const scan = await scanBackupEntries(projectRoot);
    const paths = scan.entries.map((entry) => entry.relativePath);
    expect(paths.some((item) => item.includes(".libtv"))).toBe(false);
    expect(paths.some((item) => item.includes("_views"))).toBe(false);
    expect(paths.some((item) => item.includes("credentials.json"))).toBe(false);
    expect(paths.some((item) => item.includes(".env"))).toBe(false);
    expect(scan.excluded.length).toBeGreaterThan(0);

    await createMediaBackup(projectRoot, backupRoot);
    expect(await fs.pathExists(path.join(backupRoot, "outputs/.libtv/state.json"))).toBe(false);
    expect(await fs.pathExists(path.join(backupRoot, "outputs/credentials.json"))).toBe(false);
  });

  it("reports missing files and hash mismatches instead of claiming success", async () => {
    const root = await makeTempRoot();
    const projectRoot = path.join(root, "project");
    const backupRoot = path.join(root, "backup");
    await seedProject(projectRoot);
    await createMediaBackup(projectRoot, backupRoot);

    const target = path.join(backupRoot, "assets/library/角色-001/参考.png");
    await fs.writeFile(target, Buffer.from([7, 7, 7]));
    await fs.remove(path.join(backupRoot, "工作记录/生成记录/说明.md"));

    const report = await verifyBackup(backupRoot);
    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.kind === "hash-mismatch")).toBe(true);
    expect(report.issues.some((issue) => issue.kind === "missing")).toBe(true);
    expect(report.lines.join("\n")).toContain("未通过校验");
  });

  it("refuses a backup directory inside the project", async () => {
    const root = await makeTempRoot();
    const projectRoot = path.join(root, "project");
    await seedProject(projectRoot);
    await expect(createMediaBackup(projectRoot, path.join(projectRoot, "backup"))).rejects.toThrow();
  });

  it("restores into a new location and rewrites absolute references", async () => {
    const root = await makeTempRoot();
    const projectRoot = path.join(root, "old-project");
    const backupRoot = path.join(root, "backup");
    const restoredRoot = path.join(root, "new-project");
    await seedProject(projectRoot);
    await createMediaBackup(projectRoot, backupRoot);

    const report = await restoreMediaBackup(backupRoot, restoredRoot);
    expect(report.ok).toBe(true);
    expect(report.restored.length).toBeGreaterThan(0);
    expect(await fs.pathExists(path.join(restoredRoot, "素材记录/角色-001_三视图.md"))).toBe(true);

    const recordText = await fs.readFile(path.join(restoredRoot, "素材记录/角色-001_三视图.md"), "utf8");
    expect(recordText).not.toContain(projectRoot);
    expect(recordText).toContain(restoredRoot);

    const inspection = await inspectProjectReferences(restoredRoot);
    expect(inspection.issues).toEqual([]);
    expect(inspection.valid).toBe(true);
  });

  it("keeps existing files when restoring without explicit overwrite", async () => {
    const root = await makeTempRoot();
    const projectRoot = path.join(root, "old-project");
    const backupRoot = path.join(root, "backup");
    const restoredRoot = path.join(root, "new-project");
    await seedProject(projectRoot);
    await createMediaBackup(projectRoot, backupRoot);

    const existing = path.join(restoredRoot, "assets/library/角色-001/参考.png");
    await fs.ensureDir(path.dirname(existing));
    await fs.writeFile(existing, Buffer.from([5, 5, 5]));

    const report = await restoreMediaBackup(backupRoot, restoredRoot);
    expect(report.ok).toBe(true);
    expect(report.skippedExisting).toContain("assets/library/角色-001/参考.png");
    expect([...(await fs.readFile(existing))]).toEqual([5, 5, 5]);
  });

  it("aborts the restore without writing anything when the backup does not verify", async () => {
    const root = await makeTempRoot();
    const projectRoot = path.join(root, "old-project");
    const backupRoot = path.join(root, "backup");
    const restoredRoot = path.join(root, "new-project");
    await seedProject(projectRoot);
    await createMediaBackup(projectRoot, backupRoot);
    await fs.remove(path.join(backupRoot, "assets/library/角色-001/参考.png"));

    const report = await restoreMediaBackup(backupRoot, restoredRoot);
    expect(report.ok).toBe(false);
    expect(report.aborted).toBe(true);
    expect(report.restored).toEqual([]);
    expect(await fs.pathExists(path.join(restoredRoot, "素材记录/角色-001_三视图.md"))).toBe(false);
  });

  it("flags references that still point outside the moved project", async () => {
    const root = await makeTempRoot();
    const projectRoot = path.join(root, "old-project");
    const backupRoot = path.join(root, "backup");
    const restoredRoot = path.join(root, "new-project");
    await seedProject(projectRoot);
    await createMediaBackup(projectRoot, backupRoot);

    const report = await restoreMediaBackup(backupRoot, restoredRoot, { rewriteReferences: false });
    expect(report.ok).toBe(true);

    const inspection = await inspectProjectReferences(restoredRoot);
    expect(inspection.valid).toBe(false);
    expect(inspection.issues.length).toBeGreaterThan(0);
  });
});
