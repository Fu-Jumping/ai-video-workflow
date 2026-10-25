import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { renderAutoBlock, renderManualBlock } from "../src/lib/content-tree.js";
import { createProject } from "../src/lib/init.js";
import { mediaOutputDirectory, mediaRecordPath, renderMediaRecord, type MediaCandidateRecord, type MediaIdentity, type MediaRecord } from "../src/lib/media-records.js";
import { checkRoughCutPlan, exportMediaPack, refreshRoughCutPlan, ROUGH_CUT_PLAN_FILE } from "../src/lib/roughcut.js";
import { syncProject } from "../src/lib/sync.js";

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const tempRoots: string[] = [];
const FENCE = "```";

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await fs.rmSync(root, { recursive: true, force: true });
  }
});

async function createContentProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "avw-roughcut-"));
  tempRoots.push(root);
  await createProject({
    targetRoot: root,
    projectName: "roughcut-project",
    pack: "official-ai-video",
    ide: "codex",
    imagePlatform: "openai",
    videoPlatform: "seedance"
  });
  const projectRoot = path.join(root, "roughcut-project");
  await syncProject({ repoRoot, projectRoot, ide: "codex", pack: "official-ai-video" });
  return projectRoot;
}

async function writeFile(projectRoot: string, relPath: string, content: string): Promise<void> {
  await fs.outputFile(path.join(projectRoot, ...relPath.split("/")), content, "utf8");
}

async function readFile(projectRoot: string, relPath: string): Promise<string> {
  return fs.readFile(path.join(projectRoot, ...relPath.split("/")), "utf8");
}

function shotOverviewContent(displayName: string, watchOrder: number): string {
  return [
    "# 镜头 " + "001：" + displayName,
    "",
    "- 观看顺序：" + watchOrder,
    "- 目标时长：15 秒",
    "",
    renderAutoBlock("分镜速览", "（待刷新）"),
    "",
    renderAutoBlock("图片提示词", "（待刷新）"),
    "",
    renderManualBlock("视频提示词前段", "整镜公共说明。"),
    "",
    renderAutoBlock("镜头段拼装", "（待拼装）"),
    "",
    renderManualBlock("视频提示词后段", "无配乐、无字幕。"),
    ""
  ].join("\n");
}

function storyboardContent(prompt: string): string {
  return [
    "# 分镜-01",
    "",
    "## 一、本段正文（画面与动作）",
    "",
    "- **画面与动作**：阿岚站在门前。",
    "",
    "## 二、关键帧",
    "",
    "本段没有单独关键帧。",
    "",
    "## 三、视频提示词片段",
    "",
    FENCE + "text",
    prompt,
    FENCE,
    ""
  ].join("\n");
}

async function seedShot(projectRoot: string, shotDir: string, watchOrder: number, prompt: string): Promise<string> {
  const directory = "内容/场-001/镜头组-001/" + shotDir;
  await writeFile(projectRoot, directory + "/00_" + shotDir + ".md", shotOverviewContent(shotDir, watchOrder));
  await writeFile(projectRoot, directory + "/分镜-01.md", storyboardContent(prompt));
  return directory;
}

function candidate(overrides: Partial<MediaCandidateRecord>): MediaCandidateRecord {
  return {
    version: 1,
    candidate: 1,
    fileName: "shot-001_v001_c01.mp4",
    platformStatus: "completed",
    downloadStatus: "downloaded",
    reviewStatus: "unreviewed",
    selected: true,
    ...overrides
  };
}

async function seedVideoRecord(projectRoot: string, shotId: string, candidates: MediaCandidateRecord[], currentSelection?: string): Promise<void> {
  const identity: MediaIdentity = { category: "video", objectId: shotId, purpose: "视频" };
  const record: MediaRecord = {
    identity,
    displayName: shotId.replace(/^shot-/u, "镜头-") + " 视频",
    source: "generated",
    ...(currentSelection !== undefined ? { currentSelection } : {}),
    candidates,
    createdAt: "2026-10-24T00:00:00.000Z",
    updatedAt: "2026-10-24T00:00:00.000Z"
  };
  await writeFile(projectRoot, mediaRecordPath(identity), renderMediaRecord(record));
}

/** 构造最小 mp4（mvhd v0）：timescale 1000、时长 durationMs 毫秒。 */
function minimalMp4(durationMs: number): Buffer {
  const mvhdBody = Buffer.concat([
    Buffer.from([0x00, 0, 0, 0]),
    Buffer.alloc(8),
    (() => { const b = Buffer.alloc(4); b.writeUInt32BE(1000); return b; })(),
    (() => { const b = Buffer.alloc(4); b.writeUInt32BE(durationMs); return b; })()
  ]);
  const mvhd = Buffer.concat([(() => { const b = Buffer.alloc(4); b.writeUInt32BE(mvhdBody.length + 8); return b; })(), Buffer.from("mvhd"), mvhdBody]);
  const moovHeader = Buffer.alloc(8);
  moovHeader.writeUInt32BE(mvhd.length + 8);
  moovHeader.write("moov", 4);
  const ftypHeader = Buffer.alloc(8);
  ftypHeader.writeUInt32BE(16);
  ftypHeader.write("ftyp", 4);
  return Buffer.concat([ftypHeader, Buffer.from("isomiso2"), moovHeader, mvhd]);
}

async function placeVideo(projectRoot: string, shotId: string, fileName: string, durationMs: number): Promise<void> {
  const identity: MediaIdentity = { category: "video", objectId: shotId, purpose: "视频" };
  await fs.outputFile(path.join(projectRoot, ...(mediaOutputDirectory(identity).split("/")), fileName), minimalMp4(durationMs));
}

describe("roughcut plan（D1 顺序与选用）", () => {
  test("按观看顺序生成草案：已审可用、缺素材、起止累计", async () => {
    const projectRoot = await createContentProject();
    await seedShot(projectRoot, "镜头-001", 1, "镜头1：开门。");
    await seedShot(projectRoot, "镜头-002", 2, "镜头2：回头。");
    // 镜头-001：已审可用视频（2.0 秒）；镜头-002：无素材记录 = 缺素材。
    await seedVideoRecord(projectRoot, "shot-001", [candidate({ fileName: "shot-001_v001_c01.mp4", reviewStatus: "accepted" })]);
    await placeVideo(projectRoot, "shot-001", "shot-001_v001_c01.mp4", 2000);

    const result = await refreshRoughCutPlan(projectRoot);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]!.shotKey).toBe("场-001/镜头组-001/镜头-001");
    expect(result.rows[0]!.availability).toBe("accepted");
    expect(result.rows[0]!.cutOrder).toBe(1);
    expect(result.rows[0]!.durationSeconds).toBeCloseTo(2, 6);
    expect(result.rows[0]!.startSeconds).toBe(0);
    expect(result.rows[0]!.endSeconds).toBeCloseTo(2, 6);
    expect(result.rows[1]!.availability).toBe("missing");
    expect(result.rows[1]!.cutOrder).toBe(2);
    expect(result.rows[1]!.videoFile).toBeNull();

    const document = await readFile(projectRoot, ROUGH_CUT_PLAN_FILE);
    expect(document).toContain("成片顺序");
    expect(document).toContain("❌ 缺素材");
    expect(document).toContain("✅ 可用");
    expect(document).toContain("00:00.0 – 00:02.0");

    // 缺素材镜头在 check 里要明确报出（不偷偷换版本）。
    const checked = await checkRoughCutPlan(projectRoot);
    expect(checked.ok).toBe(false);
    expect(checked.issues.map((issue) => issue.message).join("\n")).toContain("镜头-002");
  });

  test("手改成片顺序被刷新保留；连续性错误与选用变化被 check 报出", async () => {
    const projectRoot = await createContentProject();
    await seedShot(projectRoot, "镜头-001", 1, "镜头1：开门。");
    await seedShot(projectRoot, "镜头-002", 2, "镜头2：回头。");
    await seedVideoRecord(projectRoot, "shot-001", [candidate({ fileName: "shot-001_v001_c01.mp4", reviewStatus: "accepted" })]);
    await seedVideoRecord(projectRoot, "shot-002", [candidate({ fileName: "shot-002_v001_c01.mp4", reviewStatus: "accepted" })]);
    await placeVideo(projectRoot, "shot-001", "shot-001_v001_c01.mp4", 1000);
    await placeVideo(projectRoot, "shot-002", "shot-002_v001_c01.mp4", 1500);
    await refreshRoughCutPlan(projectRoot);

    // 用户手改：镜头-002 排第 1、镜头-001 排第 2（对调）。
    const before = await readFile(projectRoot, ROUGH_CUT_PLAN_FILE);
    const swapped = before
      .replace("| 1 | 1 | 场-001/镜头组-001/镜头-001 |", "| 2 | 1 | 场-001/镜头组-001/镜头-001 |")
      .replace("| 2 | 2 | 场-001/镜头组-001/镜头-002 |", "| 1 | 2 | 场-001/镜头组-001/镜头-002 |");
    await writeFile(projectRoot, ROUGH_CUT_PLAN_FILE, swapped);

    const refreshed = await refreshRoughCutPlan(projectRoot);
    expect(refreshed.rows[0]!.shotKey).toBe("场-001/镜头组-001/镜头-002");
    expect(refreshed.rows[0]!.cutOrder).toBe(1);
    expect(refreshed.rows[1]!.shotKey).toBe("场-001/镜头组-001/镜头-001");
    // 起止按新手改的顺序累计。
    expect(refreshed.rows[0]!.durationSeconds).toBeCloseTo(1.5, 6);

    // 顺序号跳号：check 必须报错。
    await writeFile(projectRoot, ROUGH_CUT_PLAN_FILE, swapped.replace("| 2 | 1 | 场-001/镜头组-001/镜头-001 |", "| 5 | 1 | 场-001/镜头组-001/镜头-001 |"));
    const gapChecked = await checkRoughCutPlan(projectRoot);
    expect(gapChecked.ok).toBe(false);
    expect(gapChecked.issues.map((issue) => issue.message).join("\n")).toContain("连续编号");

    // 素材记录换了当前选用：check 报选用变化并提示刷新（素材记录是当前事实）。
    await seedVideoRecord(
      projectRoot,
      "shot-001",
      [
        candidate({ fileName: "shot-001_v001_c01.mp4", reviewStatus: "accepted", selected: false }),
        candidate({ fileName: "shot-001_v001_c02.mp4", reviewStatus: "unreviewed", selected: true })
      ],
      "shot-001_v001_c02.mp4"
    );
    const changedChecked = await checkRoughCutPlan(projectRoot);
    expect(changedChecked.issues.map((issue) => issue.message).join("\n")).toContain("选用版本已从");
  });

  test("未审试用与已审不可用的口径：标注而不改审核状态", async () => {
    const projectRoot = await createContentProject();
    await seedShot(projectRoot, "镜头-001", 1, "镜头1：开门。");
    // 当前选用是未审候选：草案里标「未审试用」，素材记录的审核状态不变。
    await seedVideoRecord(projectRoot, "shot-001", [candidate({ fileName: "shot-001_v001_c01.mp4", reviewStatus: "unreviewed" })], "shot-001_v001_c01.mp4");
    await placeVideo(projectRoot, "shot-001", "shot-001_v001_c01.mp4", 800);

    const result = await refreshRoughCutPlan(projectRoot);
    expect(result.rows[0]!.availability).toBe("unreviewed");
    const document = await readFile(projectRoot, ROUGH_CUT_PLAN_FILE);
    expect(document).toContain("未审试用");

    // 当前选用是已审不可用、且没有别的已审候选：仍算缺素材。
    await seedVideoRecord(projectRoot, "shot-001", [candidate({ fileName: "shot-001_v001_c01.mp4", reviewStatus: "rejected" })], "shot-001_v001_c01.mp4");
    const afterReject = await refreshRoughCutPlan(projectRoot);
    expect(afterReject.rows[0]!.availability).toBe("missing");
  });

  test("素材包导出（D2）：片段按成片顺序编号、清单齐备、缺素材占位与冲突拒绝", async () => {
    const projectRoot = await createContentProject();
    await seedShot(projectRoot, "镜头-001", 1, "镜头1：开门。");
    await seedShot(projectRoot, "镜头-002", 2, "镜头2：回头。");
    await seedVideoRecord(projectRoot, "shot-001", [candidate({ fileName: "shot-001_v001_c01.mp4", reviewStatus: "accepted" })]);
    await placeVideo(projectRoot, "shot-001", "shot-001_v001_c01.mp4", 1000);
    await refreshRoughCutPlan(projectRoot);
    const outDir = path.join(path.dirname(projectRoot), "pack-ok");

    const result = await exportMediaPack(projectRoot, outDir);
    expect(result.ok).toBe(true);
    expect(result.segments.map((segment) => segment.directoryName)).toEqual(["01_镜头-001", "02_镜头-002_缺素材"]);
    expect(
      await fs.pathExists(path.join(outDir, "01_镜头-001", "shot-001_v001_c01.mp4"))
    ).toBe(true);
    expect(await fs.pathExists(path.join(outDir, "02_镜头-002_缺素材", "缺素材说明.md"))).toBe(true);
    const manifest = await fs.readFile(path.join(outDir, "00_素材包清单.md"), "utf8");
    expect(manifest).toContain("shot-001_v001_c01.mp4");
    expect(manifest).toContain("❌ 缺素材");
    expect(manifest).toContain("无记录");
    expect(manifest).toContain("只读快照");
    // 顺序说明（D3 受阻的退路交付物）：顺序、时长合计与未定稿口径。
    const instructions = await fs.readFile(path.join(outDir, "01_粗剪顺序说明.md"), "utf8");
    expect(instructions).toContain("粗剪顺序说明");
    expect(instructions).toContain("01_镜头-001/");
    expect(instructions).toContain("（缺素材，用占位）");
    expect(instructions).toContain("未定稿");

    // 原件没有被移动或改名：项目里视频还在原位。
    expect(
      await fs.pathExists(path.join(projectRoot, "outputs", "video", "shot-001", "shot-001_v001_c01.mp4"))
    ).toBe(true);

    // 同名冲突先列出、绝不覆盖：往同一目录再导出必须拒绝。
    const conflict = await exportMediaPack(projectRoot, outDir);
    expect(conflict.ok).toBe(false);
    expect(conflict.issues.map((issue) => issue.message).join("\n")).toContain("已存在同名内容");

    // 顺序表与素材记录不一致（换了当前选用未刷新）时拒绝导出。
    await seedVideoRecord(
      projectRoot,
      "shot-001",
      [
        candidate({ fileName: "shot-001_v001_c01.mp4", reviewStatus: "accepted", selected: false }),
        candidate({ fileName: "shot-001_v001_c02.mp4", reviewStatus: "unreviewed", selected: true })
      ],
      "shot-001_v001_c02.mp4"
    );
    const stale = await exportMediaPack(projectRoot, path.join(path.dirname(projectRoot), "pack-stale"));
    expect(stale.ok).toBe(false);
    expect(stale.issues.map((issue) => issue.message).join("\n")).toContain("选用版本已从");
    // 被拒绝的导出没有留下任何文件。
    expect(await fs.pathExists(path.join(path.dirname(projectRoot), "pack-stale"))).toBe(false);
  });
});
