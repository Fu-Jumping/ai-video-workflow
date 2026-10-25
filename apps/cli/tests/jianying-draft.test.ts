import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, test } from "vitest";

import { renderAutoBlock, renderManualBlock } from "../src/lib/content-tree.js";
import { createProject } from "../src/lib/init.js";
import {
  mediaOutputDirectory,
  mediaRecordPath,
  renderMediaRecord,
  type MediaCandidateRecord,
  type MediaIdentity,
  type MediaRecord
} from "../src/lib/media-records.js";
import { refreshRoughCutPlan } from "../src/lib/roughcut.js";
import { syncProject } from "../src/lib/sync.js";
import {
  buildDraftJson,
  buildDraftPlan,
  discoverJianyingDir,
  generateJianyingDraft,
  jianyingIsRunning,
  renderJianyingDraftSummary,
  resolveJianyingProfile,
  type DraftPlan
} from "../src/lib/jianying-draft.js";

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const tempRoots: string[] = [];
const FENCE = "```";

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await fs.rmSync(root, { recursive: true, force: true });
  }
});

async function createContentProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "avw-jy-draft-"));
  tempRoots.push(root);
  await createProject({
    targetRoot: root,
    projectName: "draft-project",
    pack: "official-ai-video",
    ide: "codex",
    imagePlatform: "openai",
    videoPlatform: "seedance"
  });
  const projectRoot = path.join(root, "draft-project");
  await syncProject({ repoRoot, projectRoot, ide: "codex", pack: "official-ai-video" });
  return projectRoot;
}

async function writeFile(projectRoot: string, relPath: string, content: string): Promise<void> {
  await fs.outputFile(path.join(projectRoot, ...relPath.split("/")), content, "utf8");
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

async function seedShot(projectRoot: string, shotDir: string, watchOrder: number, prompt: string): Promise<void> {
  const directory = "内容/场-001/镜头组-001/" + shotDir;
  await writeFile(projectRoot, directory + "/00_" + shotDir + ".md", shotOverviewContent(shotDir, watchOrder));
  await writeFile(projectRoot, directory + "/分镜-01.md", storyboardContent(prompt));
}

function candidate(overrides: Partial<MediaCandidateRecord>): MediaCandidateRecord {
  return {
    version: 1,
    candidate: 1,
    fileName: "shot-001_v001_c01.mp4",
    platformStatus: "completed",
    downloadStatus: "downloaded",
    reviewStatus: "accepted",
    selected: true,
    ...overrides
  };
}

async function seedVideoRecord(projectRoot: string, shotId: string, fileName: string): Promise<void> {
  const identity: MediaIdentity = { category: "video", objectId: shotId, purpose: "视频" };
  const record: MediaRecord = {
    identity,
    displayName: shotId.replace(/^shot-/u, "镜头-") + " 视频",
    source: "generated",
    candidates: [candidate({ fileName, reviewStatus: "accepted" })],
    createdAt: "2026-10-25T00:00:00.000Z",
    updatedAt: "2026-10-25T00:00:00.000Z"
  };
  await writeFile(projectRoot, mediaRecordPath(identity), renderMediaRecord(record));
}

/** 最小 mp4（mvhd v0，timescale 1000）：无视频轨，宽高探测得 undefined 属预期。 */
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
  const identity = { category: "video" as const, objectId: shotId, purpose: "视频" };
  await fs.outputFile(path.join(projectRoot, ...(mediaOutputDirectory(identity).split("/")), fileName), minimalMp4(durationMs));
}

/** 两个已审镜头（2 秒 + 3 秒）+ 一个缺素材镜头。 */
async function seedTwoShotProject(): Promise<string> {
  const projectRoot = await createContentProject();
  await seedShot(projectRoot, "镜头-001", 1, "镜头1：开门。");
  await seedShot(projectRoot, "镜头-002", 2, "镜头2：回望。");
  await seedShot(projectRoot, "镜头-003", 3, "镜头3：离开（缺素材）。");
  await seedVideoRecord(projectRoot, "shot-001", "shot-001_v001_c01.mp4");
  await seedVideoRecord(projectRoot, "shot-002", "shot-002_v001_c01.mp4");
  await placeVideo(projectRoot, "shot-001", "shot-001_v001_c01.mp4", 2000);
  await placeVideo(projectRoot, "shot-002", "shot-002_v001_c01.mp4", 3000);
  await refreshRoughCutPlan(projectRoot);
  return projectRoot;
}

function fakePlanFixture(totalMicros = 5000000): DraftPlan {
  return {
    draftName: "avw-draft-test",
    segments: [
      {
        row: {
          cutOrder: 1, watchOrder: 1, shotKey: "场-001/镜头组-001/镜头-001", storyboardNames: ["分镜-01"],
          videoFile: "shot-001_v001_c01.mp4", availability: "accepted", durationSeconds: 2,
          startSeconds: 0, endSeconds: 2
        },
        sourceAbsolutePath: "E:/clip/shot-001_v001_c01.mp4",
        durationMicros: 2000000,
        targetStartMicros: 0,
        videoSize: undefined
      },
      {
        row: {
          cutOrder: 2, watchOrder: 2, shotKey: "场-001/镜头组-001/镜头-002", storyboardNames: ["分镜-01"],
          videoFile: "shot-002_v001_c01.mp4", availability: "accepted", durationSeconds: 3,
          startSeconds: 2, endSeconds: 5
        },
        sourceAbsolutePath: "E:/clip/shot-002_v001_c01.mp4",
        durationMicros: 3000000,
        targetStartMicros: 2000000,
        videoSize: { width: 640, height: 360 }
      }
    ],
    skipped: [{ shotKey: "场-001/镜头组-001/镜头-003", reason: "缺素材（顺序表已标占位）" }],
    totalDurationMicros: totalMicros,
    issues: []
  };
}

describe("jianying draft（D3 计划与明文构造）", () => {
  test("计划：两段可用、缺素材镜头跳过并按顺序累计", async () => {
    const projectRoot = await seedTwoShotProject();
    const plan = await buildDraftPlan(projectRoot, "avw-draft-test");
    expect(plan.segments).toHaveLength(2);
    expect(plan.segments[0]!.targetStartMicros).toBe(0);
    expect(plan.segments[0]!.durationMicros).toBe(2000000);
    expect(plan.segments[1]!.targetStartMicros).toBe(2000000);
    expect(plan.totalDurationMicros).toBe(5000000);
    expect(plan.skipped.map((skip) => skip.shotKey)).toEqual(["场-001/镜头组-001/镜头-003"]);
  });

  test("明文构造：draft/meta/project 三份结构完整、引用闭合", () => {
    const { content, meta, project } = buildDraftJson(fakePlanFixture(), {
      ids: { draftId: "D", timelineId: "T", projectId: "P", trackId: "K" },
      nowMicros: 1793000000000000,
      canvas: { width: 1920, height: 1080 },
      profile: { jianying: "11.6.0.14552", sha256: "", newVersion: "189.0.0", appVersion: "11.6.0" },
      draftDir: "E:/drafts/avw-draft-test",
      draftsRoot: "E:/drafts",
      draftName: "avw-draft-test",
      totalDurationMicros: 5000000,
      materialsSizeBytes: 42
    });
    expect(content).toMatchObject({ id: "T", version: 360000, new_version: "189.0.0", duration: 5000000 });
    expect((content["canvas_config"] as Record<string, unknown>)).toEqual({ width: 1920, height: 1080 });
    const tracks = content["tracks"] as { segments: Record<string, unknown>[] }[];
    expect(tracks).toHaveLength(1);
    expect(tracks[0]!.segments).toHaveLength(2);
    expect((tracks[0]!.segments[1]!["target_timerange"] as Record<string, number>)).toEqual({ start: 2000000, duration: 3000000 });
    const materials = content["materials"] as Record<string, { id: string }[]>;
    const knownIds = new Set(Object.values(materials).flat().map((entry) => entry.id));
    for (const segment of tracks[0]!.segments) {
      for (const ref of segment["extra_material_refs"] as string[]) {
        expect(knownIds.has(ref)).toBe(true);
      }
    }
    const videos = materials["videos"]!;
    expect(videos).toHaveLength(2);
    expect(videos[0]).not.toHaveProperty("width"); // 宽高未知时省略字段
    expect(videos[1]).toMatchObject({ width: 640, height: 360 });
    expect(meta).toMatchObject({ draft_id: "D", draft_name: "avw-draft-test", tm_duration: 5000000 });
    expect(((meta["draft_materials"] as { value: unknown[] }[])[0]!.value)).toHaveLength(2);
    expect(project).toMatchObject({ id: "P", main_timeline_id: "T" });
  });

  test("摘要：跳过清单与人工终审提示都在", () => {
    const plan = fakePlanFixture();
    const summary = renderJianyingDraftSummary({
      ok: true, plan,
      draftDir: "E:/drafts/avw-draft-test", draftId: "D", timelineId: "T",
      issues: []
    });
    expect(summary).toContain("avw-draft-test");
    expect(summary).toContain("跳过 1 个镜头");
    expect(summary).toContain("下一步（必做）：打开剪映");
  });
});

/* ---------------------- 真实加密集成（本机有剪映才跑） ---------------------- */

const jycryptoPath = path.join(repoRoot, "apps", "cli", "vendor", "win-x64", "jycrypto.exe");
const jianyingDir = discoverJianyingDir();

describe.skipIf(
  !fs.existsSync(jycryptoPath) || jianyingDir === null || jianyingIsRunning()
)("jianying draft（D3 真实加密集成）", () => {
  test(
    "生成草稿：密文可解回明文、素材入库、索引注册",
    { timeout: 90000 },
    async () => {
      const profile = await resolveJianyingProfile(jianyingDir!);
      if (profile.issues.length > 0) {
        console.warn("videoeditor.dll 指纹不在支持表内，跳过集成：", profile.issues[0]!.message);
        return;
      }
      const projectRoot = await seedTwoShotProject();
      const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "avw-jy-draft-e2e-"));
      tempRoots.push(sandbox);
      const draftsRoot = path.join(sandbox, "drafts");
      const indexFile = path.join(sandbox, "root_meta_info.json");
      await fs.ensureDir(draftsRoot);
      // 最小合法索引：模拟剪映 root_meta_info.json（含一个既有条目，验证不破坏）。
      await fs.writeFile(indexFile, JSON.stringify({
        all_draft_store: [{
          draft_name: "既有草稿", draft_fold_path: toPosix(path.join(draftsRoot, "old")), draft_id: "OLD",
          draft_root_path: draftsRoot, tm_duration: 1000000
        }],
        draft_ids: 1,
        root_path: sandbox
      }), "utf8");

      const result = await generateJianyingDraft({
        projectRoot,
        jianyingDir: jianyingDir!,
        jycryptoPath,
        draftsRoot,
        indexFilePath: indexFile,
        draftName: "avw-draft-it"
      });
      // 缺素材镜头的占位提示（roughcut-missing-material）应存在但不阻塞。
      expect(result.issues.some((issue) => issue.code === "roughcut-missing-material")).toBe(true);
      const blocking = result.issues.filter((issue) => issue.code !== "roughcut-missing-material");
      expect(blocking).toEqual([]);
      expect(result.ok).toBe(true);
      expect(result.draftDir).toBe(path.join(draftsRoot, "avw-draft-it"));

      // 密文形态 + 可解密回明文。
      const cipher = await fs.readFile(path.join(result.draftDir!, "draft_content.json"), "utf8");
      expect(cipher.trimStart()[0]).not.toBe("{");
      const plainCopy = path.join(sandbox, "verify-plain.json");
      execFileSync(jycryptoPath, ["dec", path.join(result.draftDir!, "draft_content.json"), plainCopy], {
        env: { ...process.env, JY_DIR: jianyingDir! }, timeout: 60000
      });
      const decoded = await fs.readFile(plainCopy, "utf8");
      const expected = await fs.readFile(path.join(result.draftDir!, ".avw", "draft_content.plain.json"), "utf8");
      expect(decoded).toBe(expected);
      const parsed = JSON.parse(decoded) as { duration: number; new_version: string };
      expect(parsed.duration).toBe(5000000);
      expect(parsed.new_version).toBe("189.0.0");

      // 素材实体与明文外围文件。
      await expect(fs.pathExists(path.join(result.draftDir!, "materials", "video", "shot-001_v001_c01.mp4"))).resolves.toBe(true);
      await expect(fs.pathExists(path.join(result.draftDir!, "Timelines", result.timelineId!, "template.json"))).resolves.toBe(true);

      // 索引：新条目在首位，既有条目保留，备份存在。
      const index = JSON.parse(await fs.readFile(indexFile, "utf8")) as { all_draft_store: { draft_name: string }[]; draft_ids: number };
      expect(index.all_draft_store[0]!.draft_name).toBe("avw-draft-it");
      expect(index.all_draft_store.some((entry) => entry.draft_name === "既有草稿")).toBe(true);
      expect(index.draft_ids).toBe(2);
      await expect(fs.pathExists(path.join(result.draftDir!, ".avw", "root_meta_info.backup.json"))).resolves.toBe(true);
    }
  );

  test("目标草稿名已存在时拒绝生成且不覆盖", { timeout: 90000 }, async () => {
    const projectRoot = await seedTwoShotProject();
    const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "avw-jy-draft-exists-"));
    tempRoots.push(sandbox);
    const draftsRoot = path.join(sandbox, "drafts");
    const indexFile = path.join(sandbox, "root_meta_info.json");
    await fs.ensureDir(path.join(draftsRoot, "avw-draft-dup"));
    await fs.writeFile(path.join(draftsRoot, "avw-draft-dup", "keep.txt"), "既有内容", "utf8");
    await fs.writeFile(indexFile, JSON.stringify({ all_draft_store: [], draft_ids: 0 }), "utf8");
    const result = await generateJianyingDraft({
      projectRoot, jianyingDir: jianyingDir!, jycryptoPath, draftsRoot, indexFilePath: indexFile, draftName: "avw-draft-dup"
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "jianying-draft-error")).toBe(true);
    await expect(fs.readFile(path.join(draftsRoot, "avw-draft-dup", "keep.txt"), "utf8")).resolves.toBe("既有内容");
  });
});

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}
