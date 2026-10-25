import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "fs-extra";
import path from "node:path";

import { mp4VideoTrackSize } from "./media-duration.js";
import { mediaOutputDirectory, videoPurpose } from "./media-records.js";
import { checkRoughCutPlan, rowShotObjectId, type RoughCutRow } from "./roughcut.js";
import type { VerificationIssue } from "./types.js";

/* ------------------------------------------------------------------ *
 * 剪映原生草稿生成（D3，D17 决策 2026-10-25）。
 *
 * 路线：程序构造明文草稿 JSON → 用自带 jycrypto（调剪映 videoeditor.dll
 * 的 EncryptUtils）加密 → 全新目录落盘 → 注册 root_meta_info.json 索引。
 * 经真实剪映 11.6.0.14552 验证（avw-d4-fresh 实验，2026-10-25 用户确认）。
 *
 * 铁律：
 * - 全新身份：每次生成全部 id 新造，绝不复用已有草稿的 id（云草稿按 id
 *   匹配，复用会被云端旧版本覆盖——D0 阶段「幽灵恢复」的真相）。
 * - 写入前剪映必须完全退出（运行时锁文件并重写草稿目录）。
 * - videoeditor.dll 按版本指纹绑定；不匹配明确报错，不静默降级。
 * - 文件写成功不算结论：命令输出必须提示用户在真实剪映里打开核对。
 * ------------------------------------------------------------------ */

/** 已验证的剪映版本指纹（videoeditor.dll SHA-256 → 草稿结构版本）。 */
export interface JianyingVersionProfile {
  jianying: string;
  sha256: string;
  newVersion: string;
  appVersion: string;
}

export const SUPPORTED_JIANYING_VERSIONS: readonly JianyingVersionProfile[] = [
  {
    jianying: "11.6.0.14552",
    sha256: "8CFCBB612CCD946DF974428977B1902736C1DE0AE561E20C26CBD4EA86099CB1",
    newVersion: "189.0.0",
    appVersion: "11.6.0"
  }
];

/** 剪映草稿索引（root_meta_info.json）的默认位置。 */
export function defaultJianyingIndexFilePath(): string {
  const localAppData = process.env["LOCALAPPDATA"];
  if (!localAppData) return "";
  return path.join(localAppData, "JianyingPro", "User Data", "Projects", "com.lveditor.draft", "root_meta_info.json");
}

/** 从注册表 uninstall 项找剪映安装根（含 uninst.exe 的 JianyingPro 目录）。 */
function jianyingInstallRootFromRegistry(): string | null {
  const hives = [
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall"
  ];
  for (const hive of hives) {
    try {
      const output = execFileSync("reg", ["query", hive, "/s", "/f", "JianyingPro", "/d"], {
        encoding: "latin1", windowsHide: true, timeout: 15000
      });
      for (const line of output.split("\n")) {
        // 匹配 DisplayIcon/UninstallString 数据里的 …\JianyingPro\uninst.exe（可能带引号）。
        const match = /[A-Za-z]:\\[^"\r\n]*?JianyingPro\\uninst\.exe/u.exec(line);
        if (match !== null) return path.dirname(match[0]);
      }
    } catch {
      // 该 hive 不存在或 reg 失败：继续下一个。
    }
  }
  return null;
}

/**
 * 自动发现剪映版本目录（含 videoeditor.dll）：环境变量 AVW_JIANYING_DIR →
 * 注册表安装根下版本号最大的子目录。找不到返回 null，由调用方提示 --jianying-dir。
 */
export function discoverJianyingDir(): string | null {
  const fromEnv = process.env["AVW_JIANYING_DIR"];
  if (fromEnv !== undefined && fromEnv !== "") return fromEnv;
  const root = jianyingInstallRootFromRegistry();
  if (root === null) return null;
  let candidates: { version: number[]; dir: string }[] = [];
  try {
    candidates = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^\d+\.\d+\.\d+\.\d+$/u.test(entry.name))
      .map((entry) => ({ version: entry.name.split(".").map((part) => Number.parseInt(part, 10)), dir: path.join(root, entry.name) }))
      .filter((entry) => fs.existsSync(path.join(entry.dir, "videoeditor.dll")));
  } catch {
    return null;
  }
  if (candidates.length === 0) return null;
  candidates.sort((left, right) => {
    for (let index = 0; index < 4; index += 1) {
      const diff = (left.version[index] ?? 0) - (right.version[index] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  });
  return candidates[candidates.length - 1]!.dir;
}

/** 从索引内容推断草稿根目录（任一条目的 draft_root_path 或 draft_fold_path 的父目录）。 */
export async function draftsRootFromIndex(indexFilePath: string): Promise<string | null> {
  try {
    const index = JSON.parse(await fs.readFile(indexFilePath, "utf8")) as {
      all_draft_store?: { draft_root_path?: string; draft_fold_path?: string }[];
    };
    const first = index.all_draft_store?.[0];
    if (first?.draft_root_path !== undefined && first.draft_root_path !== "") return first.draft_root_path;
    if (first?.draft_fold_path !== undefined && first.draft_fold_path !== "") return path.dirname(first.draft_fold_path);
  } catch {
    // 索引读不了：返回 null，由调用方要求 --drafts-root。
  }
  return null;
}

export interface DraftSegment {
  row: RoughCutRow;
  /** 项目内素材绝对路径。 */
  sourceAbsolutePath: string;
  durationMicros: number;
  targetStartMicros: number;
  videoSize: { width: number; height: number } | undefined;
}

export interface DraftPlan {
  draftName: string;
  segments: DraftSegment[];
  /** 被跳过的镜头及原因（缺素材/文件缺失/时长未知）。 */
  skipped: { shotKey: string; reason: string }[];
  totalDurationMicros: number;
  issues: VerificationIssue[];
}

export interface GenerateDraftOptions {
  projectRoot: string;
  /** 剪映版本目录（含 videoeditor.dll 与自带 CRT）。 */
  jianyingDir: string;
  /** jycrypto 可执行文件路径（apps/cli/vendor/win-x64/jycrypto.exe）。 */
  jycryptoPath: string;
  /** 剪映草稿根目录（<draftsRoot>/<draftName> 将被创建）。 */
  draftsRoot: string;
  /** root_meta_info.json 全路径。 */
  indexFilePath: string;
  draftName?: string;
  canvasWidth?: number;
  canvasHeight?: number;
}

export interface DraftResult {
  ok: boolean;
  plan: DraftPlan | null;
  draftDir: string | null;
  draftId: string | null;
  timelineId: string | null;
  issues: VerificationIssue[];
}

function uuidUpper(): string {
  return randomUUID().toUpperCase();
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

/** 计划阶段：从顺序表挑出可生成的段（已审可用/未审试用、文件在、时长可探）。 */
export async function buildDraftPlan(projectRoot: string, draftName?: string): Promise<DraftPlan> {
  const issues: VerificationIssue[] = [];
  const checked = await checkRoughCutPlan(projectRoot);
  const blocking = checked.issues.filter((issue) => issue.code === "roughcut-plan-mismatch");
  if (blocking.length > 0) {
    return { draftName: draftName ?? defaultDraftName(), segments: [], skipped: [], totalDurationMicros: 0, issues: [...checked.issues] };
  }
  // 缺素材提示照常带回（不阻塞），顺序不一致才在上面拦截。
  issues.push(...checked.issues.filter((issue) => issue.code !== "roughcut-plan-mismatch"));

  const segments: DraftSegment[] = [];
  const skipped: { shotKey: string; reason: string }[] = [];
  let cursorMicros = 0;
  for (const row of checked.rows) {
    if (row.videoFile === null) {
      skipped.push({ shotKey: row.shotKey, reason: "缺素材（顺序表已标占位）" });
      continue;
    }
    if (row.durationSeconds === undefined) {
      skipped.push({ shotKey: row.shotKey, reason: "视频时长探测失败（容器缺 moov/mvhd？）" });
      issues.push({
        code: "jianying-draft-skip",
        message: "镜头「" + row.shotKey + "」的视频「" + row.videoFile + "」时长无法探测，本轮跳过；请检查文件是否为有效 mp4。",
        path: row.videoFile
      });
      continue;
    }
    const identity = { category: "video" as const, objectId: rowShotObjectId(row.shotKey), purpose: videoPurpose };
    const absPath = path.join(projectRoot, mediaOutputDirectory(identity), row.videoFile);
    if (!(await fs.pathExists(absPath))) {
      skipped.push({ shotKey: row.shotKey, reason: "选用文件在项目里不存在（" + mediaOutputDirectory(identity) + "）" });
      issues.push({
        code: "jianying-draft-skip",
        message: "镜头「" + row.shotKey + "」的选用文件「" + row.videoFile + "」不存在，本轮跳过。",
        path: row.videoFile
      });
      continue;
    }
    segments.push({
      row,
      sourceAbsolutePath: absPath,
      durationMicros: Math.round(row.durationSeconds * 1_000_000),
      targetStartMicros: cursorMicros,
      videoSize: mp4VideoTrackSize(absPath)
    });
    cursorMicros += Math.round(row.durationSeconds * 1_000_000);
  }
  return { draftName: draftName ?? defaultDraftName(), segments, skipped, totalDurationMicros: cursorMicros, issues };
}

export function defaultDraftName(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return "avw-draft-" + String(now.getFullYear()) + pad(now.getMonth() + 1) + pad(now.getDate()) + "-" + pad(now.getHours()) + pad(now.getMinutes());
}

/* ------------------------- 明文草稿 JSON 构造 ------------------------- */

interface DraftIds {
  draftId: string;
  timelineId: string;
  projectId: string;
  trackId: string;
}

interface BuildJsonContext {
  ids: DraftIds;
  nowMicros: number;
  canvas: { width: number; height: number };
  profile: JianyingVersionProfile;
  draftDir: string;
  draftsRoot: string;
  draftName: string;
  totalDurationMicros: number;
  materialsSizeBytes: number;
}

export function buildDraftJson(plan: DraftPlan, ctx: BuildJsonContext): { content: Record<string, unknown>; meta: Record<string, unknown>; project: Record<string, unknown> } {
  const videoMaterials: Record<string, unknown>[] = [];
  const speeds: Record<string, unknown>[] = [];
  const canvases: Record<string, unknown>[] = [];
  const soundChannelMappings: Record<string, unknown>[] = [];
  const segments: Record<string, unknown>[] = [];
  const metaMaterials: Record<string, unknown>[] = [];

  for (const segment of plan.segments) {
    const materialId = uuidUpper();
    const fileName = segment.row.videoFile!;
    const video: Record<string, unknown> = {
      type: "video",
      id: materialId,
      path: toPosix(segment.sourceAbsolutePath),
      material_name: fileName,
      duration: segment.durationMicros,
      crop: {
        lower_left_x: 0, lower_left_y: 1, lower_right_x: 1, lower_right_y: 1,
        upper_left_x: 0, upper_left_y: 0, upper_right_x: 1, upper_right_y: 0
      },
      crop_ratio: "free",
      crop_scale: 1.0,
      extra_type_option: 0,
      local_material_id: "",
      material_id: "",
      category_name: "local",
      check_flag: 63487,
      reverse_int: 0,
      is_unified_beauty_mode: true,
      unique_id: uuidUpper(),
      is_ai_generate_content: false
    };
    if (segment.videoSize !== undefined) {
      video["width"] = segment.videoSize.width;
      video["height"] = segment.videoSize.height;
    }
    videoMaterials.push(video);

    const speedId = uuidUpper();
    const canvasId = uuidUpper();
    const scmId = uuidUpper();
    speeds.push({ id: speedId, type: "speed", mode: 0, speed: 1.0 });
    canvases.push({
      id: canvasId, type: "canvas_color", album_image: "", color: "#000000",
      image: "", image_id: "", image_name: "", source_platform: 0
    });
    soundChannelMappings.push({
      id: scmId, type: "none", audio_channel_mapping: 0, is_config_open: false, output_channel_layout: 0
    });
    segments.push({
      id: uuidUpper(),
      material_id: materialId,
      target_timerange: { start: segment.targetStartMicros, duration: segment.durationMicros },
      source_timerange: { start: 0, duration: segment.durationMicros },
      render_timerange: { start: 0, duration: segment.durationMicros },
      clip: { scale: { x: 1.0, y: 1.0 }, transform: { x: 0.0, y: 0.0 }, flip: {} },
      uniform_scale: {},
      extra_material_refs: [speedId, canvasId, scmId],
      render_index: 0,
      track_render_index: 0,
      enable_lut: false,
      enable_adjust: false,
      enable_hsl: false,
      responsive_layout: {},
      enable_adjust_mask: false,
      hdr_settings: { intensity: 1.0, mode: 1, lce_gain: 0.5, lce_threshold: 0.05 },
      source: "segmentsourcenormal"
    });
    metaMaterials.push({
      ai_group_type: "", create_time: -1, duration: segment.durationMicros, enter_from: 0,
      extra_info: fileName, file_Path: toPosix(segment.sourceAbsolutePath),
      height: segment.videoSize?.height ?? 0, id: uuidUpper(),
      import_time: -1, import_time_ms: -1, item_source: 1,
      material_color_tag: "", md5: "", metetype: "none",
      roughcut_time_range: { duration: -1, start: -1 },
      sub_time_range: { duration: -1, start: -1 }, type: 0,
      width: segment.videoSize?.width ?? 0
    });
  }

  const platform = {
    os: "windows", app_id: 3704, device_id: "", hard_disk_id: "", mac_address: "",
    os_version: "10.0.26300", app_version: ctx.profile.appVersion, app_version_channel: "local",
    language: "zh-Hans", s_version: "", resolution: ctx.canvas.width + "x" + ctx.canvas.height
  };
  const content = {
    id: ctx.ids.timelineId,
    version: 360000,
    new_version: ctx.profile.newVersion,
    duration: ctx.totalDurationMicros,
    config: {},
    canvas_config: { width: ctx.canvas.width, height: ctx.canvas.height },
    tracks: [{ type: "mixed", id: ctx.ids.trackId, attribute: 0, flag: 0, segments }],
    materials: {
      videos: videoMaterials,
      texts: [],
      speeds,
      canvases,
      sound_channel_mappings: soundChannelMappings,
      material_animations: [],
      beats: [],
      placeholder_infos: [],
      material_colors: [],
      loudnesses: [],
      vocal_separations: []
    },
    keyframes: {},
    platform,
    last_modified_platform: platform,
    mixed_track_mode_on: true,
    render_index_track_mode_on: true,
    path: "",
    uneven_animation_template_info: {},
    smart_ads_info: {},
    function_assistant_info: { enabled: false }
  };
  const meta = {
    cloud_draft_cover: false,
    cloud_draft_sync: false,
    cloud_package_completed_time: "",
    draft_cloud_capcut_purchase_info: "",
    draft_cloud_last_action_download: false,
    draft_cloud_package_type: "",
    draft_cloud_purchase_info: "",
    draft_cloud_template_id: "",
    draft_cloud_tutorial_info: "",
    draft_cloud_videocut_purchase_info: "",
    draft_cover: "draft_cover.jpg",
    draft_deeplink_url: "",
    draft_enterprise_info: { draft_enterprise_extra: "", draft_enterprise_id: "", draft_enterprise_name: "", enterprise_material: [] },
    draft_fold_path: toPosix(ctx.draftDir),
    draft_has_unfinished_aigc_video_effect: false,
    draft_id: ctx.ids.draftId,
    draft_is_ae_produce: false,
    draft_is_ai_packaging_used: false,
    draft_is_ai_shorts: false,
    draft_is_ai_translate: false,
    draft_is_article_video_draft: false,
    draft_is_cloud_temp_draft: false,
    draft_is_from_deeplink: "false",
    draft_is_infinite_canvas_draft: false,
    draft_is_invisible: false,
    draft_is_pippit_draft: false,
    draft_is_web_article_video: false,
    draft_materials: [{ type: 0, value: metaMaterials }],
    draft_materials_copied_info: [],
    draft_name: ctx.draftName,
    draft_need_rename_folder: false,
    draft_new_version: "",
    draft_removable_storage_device: "",
    draft_root_path: ctx.draftsRoot,
    draft_segment_extra_info: [],
    draft_timeline_materials_size_: ctx.materialsSizeBytes,
    draft_type: "",
    draft_web_article_video_enter_from: "",
    pippit_avatar_url: "", pippit_extra_info: "", pippit_id: "", pippit_user_name: "",
    tm_draft_cloud_completed: "", tm_draft_cloud_entry_id: -1, tm_draft_cloud_modified: 0,
    tm_draft_cloud_parent_entry_id: -1, tm_draft_cloud_space_id: -1, tm_draft_cloud_user_id: -1,
    tm_draft_create: ctx.nowMicros,
    tm_draft_modified: ctx.nowMicros,
    tm_draft_removed: 0,
    tm_duration: ctx.totalDurationMicros
  };
  const project = {
    config: { color_space: -1, hdr_vivid: false, mixed_track_mode_on: false, render_index_track_mode_on: false, use_float_render: false },
    create_time: ctx.nowMicros,
    id: ctx.ids.projectId,
    main_timeline_id: ctx.ids.timelineId,
    timelines: [{ create_time: ctx.nowMicros, id: ctx.ids.timelineId, is_marked_delete: false, name: "时间线01", update_time: ctx.nowMicros }],
    update_time: ctx.nowMicros,
    version: 0
  };
  return { content, meta, project };
}

/* ------------------------------ 引擎调用 ------------------------------ */

async function sha256File(filePath: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex").toUpperCase()));
    stream.on("error", reject);
  });
}

/** 校验剪映版本目录：videoeditor.dll 存在且指纹在支持表内。 */
export async function resolveJianyingProfile(jianyingDir: string): Promise<{ profile: JianyingVersionProfile; issues: VerificationIssue[] }> {
  const issues: VerificationIssue[] = [];
  const dllPath = path.join(jianyingDir, "videoeditor.dll");
  if (!(await fs.pathExists(dllPath))) {
    issues.push({
      code: "jianying-draft-error",
      message: "目录「" + jianyingDir + "」里没有 videoeditor.dll；请用 --jianying-dir 指定剪映的版本目录（形如 …\\JianyingPro\\11.6.0.14552）。",
      path: jianyingDir
    });
    return { profile: SUPPORTED_JIANYING_VERSIONS[0]!, issues };
  }
  const digest = await sha256File(dllPath);
  const profile = SUPPORTED_JIANYING_VERSIONS.find((entry) => entry.sha256 === digest);
  if (profile === undefined) {
    issues.push({
      code: "jianying-draft-error",
      message: "videoeditor.dll 指纹（SHA-256 " + digest + "）不在已验证支持表内（当前支持剪映 " +
        SUPPORTED_JIANYING_VERSIONS.map((entry) => entry.jianying).join("、") + "）。剪映可能升级了，请勿继续生成；需先按 vendor/README.md 重新适配。",
      path: dllPath
    });
    return { profile: SUPPORTED_JIANYING_VERSIONS[0]!, issues };
  }
  return { profile, issues };
}

/** 剪映是否在运行（写入前必须完全退出）。 */
export function jianyingIsRunning(): boolean {
  try {
    const output = execFileSync("tasklist", ["/FO", "CSV", "/NH"], { encoding: "latin1", windowsHide: true, timeout: 15000 }).toLowerCase();
    return output.includes("jianying");
  } catch {
    // tasklist 本身失败时按「未知」处理为不运行，避免误伤；真正写锁冲突会被后续步骤暴露。
    return false;
  }
}

function runJycrypto(jycryptoPath: string, jianyingDir: string, args: string[]): { ok: boolean; output: string } {
  try {
    const result = spawnSync(jycryptoPath, args, {
      env: { ...process.env, JY_DIR: jianyingDir },
      windowsHide: true,
      timeout: 60000,
      encoding: "utf8"
    });
    const output = ((result.stdout ?? "") + (result.stderr ?? "")).trim();
    return { ok: result.status === 0, output };
  } catch (error) {
    return { ok: false, output: String(error) };
  }
}

/* ------------------------------ 主流程 ------------------------------ */

/**
 * 生成剪映原生草稿（D3）：明文构造 → jycrypto 加密 → 全新目录落盘 → 注册索引。
 * 落盘前拒绝覆盖任何已存在内容；索引改动前把原文件备份进草稿目录的 .avw/。
 */
export async function generateJianyingDraft(options: GenerateDraftOptions): Promise<DraftResult> {
  const issues: VerificationIssue[] = [];
  const fail = (plan: DraftPlan | null): DraftResult => ({ ok: false, plan, draftDir: null, draftId: null, timelineId: null, issues });

  if (jianyingIsRunning()) {
    issues.push({
      code: "jianying-draft-error",
      message: "剪映正在运行（检测到进程）。运行中的剪映会锁住并重写草稿目录；请先完全退出剪映（含托盘）再生成。",
      path: options.draftsRoot
    });
    return fail(null);
  }
  if (!(await fs.pathExists(options.jycryptoPath))) {
    issues.push({
      code: "jianying-draft-error",
      message: "找不到加解密工具「" + options.jycryptoPath + "」；工具随 CLI 分发（apps/cli/vendor/win-x64/jycrypto.exe），缺失请重新安装或用 --jycrypto 指定路径。",
      path: options.jycryptoPath
    });
    return fail(null);
  }
  const { profile, issues: profileIssues } = await resolveJianyingProfile(options.jianyingDir);
  if (profileIssues.length > 0) return fail(null);
  issues.push(...profileIssues);

  const plan = await buildDraftPlan(options.projectRoot, options.draftName);
  const blocking = plan.issues.filter((issue) => issue.code === "roughcut-plan-mismatch");
  if (blocking.length > 0) {
    issues.push(...blocking);
    return fail(plan);
  }
  if (plan.segments.length === 0) {
    issues.push({
      code: "jianying-draft-error",
      message: "没有任何可生成的时间线段（全部镜头缺素材或不可用）；先补齐素材或刷新顺序表（roughcut plan）。",
      path: options.projectRoot
    });
    return fail(plan);
  }
  issues.push(...plan.issues);

  const draftDir = path.join(options.draftsRoot, plan.draftName);
  if (await fs.pathExists(draftDir)) {
    issues.push({
      code: "jianying-draft-error",
      message: "草稿目录已存在：" + draftDir + "；为不覆盖任何已有内容，本次未生成。请换 --name 或先在剪映里删掉旧草稿。",
      path: draftDir
    });
    return fail(plan);
  }
  if (!(await fs.pathExists(options.indexFilePath))) {
    issues.push({
      code: "jianying-draft-error",
      message: "找不到剪映草稿索引「" + options.indexFilePath + "」；请确认剪映草稿位置（root_meta_info.json）后用 --index-file 指定。",
      path: options.indexFilePath
    });
    return fail(plan);
  }

  const materialsSize = plan.segments.reduce(async (sumPromise, segment) => {
    const sum = await sumPromise;
    try {
      return sum + (await fs.stat(segment.sourceAbsolutePath)).size;
    } catch {
      return sum;
    }
  }, Promise.resolve(0));
  const ctx: BuildJsonContext = {
    ids: { draftId: uuidUpper(), timelineId: uuidUpper(), projectId: uuidUpper(), trackId: uuidUpper() },
    nowMicros: Date.now() * 1000,
    canvas: { width: options.canvasWidth ?? 1920, height: options.canvasHeight ?? 1080 },
    profile,
    draftDir,
    draftsRoot: options.draftsRoot,
    draftName: plan.draftName,
    totalDurationMicros: plan.totalDurationMicros,
    materialsSizeBytes: await materialsSize
  };
  const json = buildDraftJson(plan, ctx);
  const contentText = JSON.stringify(json.content);
  const metaText = JSON.stringify(json.meta);
  const templateText = JSON.stringify({ ...json.content, is_minimal_draft: false });

  // 加密自检先行：引擎不可用就不动任何文件。
  const selfCheck = runJycrypto(options.jycryptoPath, options.jianyingDir, ["self"]);
  if (!selfCheck.ok || !selfCheck.output.includes("match=1")) {
    issues.push({
      code: "jianying-draft-error",
      message: "加解密引擎自检失败（" + selfCheck.output + "）；请确认剪映目录完整且版本未变。",
      path: options.jianyingDir
    });
    return fail(plan);
  }

  // 落盘：明文副本与索引备份都收进草稿目录的 .avw/，便于排查与回滚。
  const plainDir = path.join(draftDir, ".avw");
  await fs.ensureDir(plainDir);
  await fs.ensureDir(path.join(draftDir, "Timelines", ctx.ids.timelineId));
  await fs.ensureDir(path.join(draftDir, "materials", "video"));
  await fs.ensureDir(path.join(draftDir, "common_attachment"));
  await fs.ensureDir(path.join(draftDir, ".backup", ctx.ids.timelineId));
  await fs.ensureDir(path.join(draftDir, ".backup", "projectBackUp"));

  const plainContentPath = path.join(plainDir, "draft_content.plain.json");
  const plainMetaPath = path.join(plainDir, "draft_meta_info.plain.json");
  await fs.writeFile(plainContentPath, contentText, "utf8");
  await fs.writeFile(plainMetaPath, metaText, "utf8");

  const encContent = runJycrypto(options.jycryptoPath, options.jianyingDir, ["enc", plainContentPath, path.join(draftDir, "draft_content.json")]);
  if (!encContent.ok || !encContent.output.includes("roundtrip=1")) {
    issues.push({ code: "jianying-draft-error", message: "草稿正文加密失败：" + encContent.output, path: draftDir });
    await fs.remove(draftDir).catch(() => undefined);
    return fail(plan);
  }
  const encMeta = runJycrypto(options.jycryptoPath, options.jianyingDir, ["enc", plainMetaPath, path.join(draftDir, "draft_meta_info.json")]);
  if (!encMeta.ok || !encMeta.output.includes("roundtrip=1")) {
    issues.push({ code: "jianying-draft-error", message: "草稿元信息加密失败：" + encMeta.output, path: draftDir });
    await fs.remove(draftDir).catch(() => undefined);
    return fail(plan);
  }
  await fs.copy(path.join(draftDir, "draft_content.json"), path.join(draftDir, "draft_content.json.bak"));
  await fs.copy(path.join(draftDir, "draft_content.json"), path.join(draftDir, "template-2.tmp"));
  await fs.writeFile(path.join(draftDir, "Timelines", ctx.ids.timelineId, "template.json"), templateText, "utf8");
  await fs.writeFile(path.join(draftDir, "template.json"), templateText, "utf8");
  await fs.writeFile(path.join(draftDir, "Timelines", "project.json"), JSON.stringify(json.project), "utf8");
  await fs.copy(path.join(draftDir, "Timelines", "project.json"), path.join(draftDir, "Timelines", "project.json.bak"));

  for (const segment of plan.segments) {
    await fs.copy(segment.sourceAbsolutePath, path.join(draftDir, "materials", "video", segment.row.videoFile!));
  }

  const nowSeconds = Math.floor(ctx.nowMicros / 1_000_000);
  await fs.writeFile(
    path.join(draftDir, "draft_settings"),
    "[General]\ndraft_create_time=" + nowSeconds + "\ndraft_last_edit_time=" + nowSeconds +
    "\nreal_edit_seconds=0\nreal_edit_keys=0\ncloud_last_modify_platform=\n",
    "utf8"
  );
  await fs.writeFile(path.join(draftDir, "timeline_layout.json"), JSON.stringify({
    activeTimeline: ctx.ids.timelineId,
    dockItems: [{ dockIndex: 0, ratio: 1, timelineIds: [ctx.ids.timelineId], timelineNames: ["时间线01"] }],
    layoutOrientation: 1
  }), "utf8");
  await fs.writeFile(path.join(draftDir, "draft_virtual_store.json"), JSON.stringify({
    draft_materials: [],
    draft_virtual_store: [
      { type: 0, value: [] },
      { type: 1, value: [] },
      { type: 2, value: [{ id: "", is_encrypted: true, is_hidden: true, path: "draft_content.json" }] }
    ]
  }), "utf8");
  await fs.writeFile(path.join(draftDir, "key_value.json"), "{}", "utf8");
  await fs.writeFile(path.join(draftDir, "performance_opt_info.json"), '{"open":false,"tasks":[]}', "utf8");
  await fs.writeFile(path.join(draftDir, "draft_agency_config.json"),
    '{"is_auto_agency_enabled":false,"is_auto_agency_popup":false,"is_single_agency_mode":false,"marterials":null,"use_converter":false,"video_resolution":720}', "utf8");
  await fs.writeFile(path.join(draftDir, "draft_biz_config.json"), "", "utf8");
  await fs.writeFile(path.join(draftDir, "attachment_pc_common.json"),
    '{"ai_packaging_infos":[],"ai_packaging_report_info":{"caption_id_list":[],"commercial_material":"","material_source":"","method":"","page_from":"","style":"","task_id":"","text_style":"","tos_id":"","video_category":""},"broll":{"ai_packaging_infos":[],"ai_packaging_report_info":{"caption_id_list":[],"commercial_material":"","material_source":"","method":"","page_from":"","style":"","task_id":"","text_style":"","tos_id":"","video_category":""}},"commercial_music_category_ids":[],"pc_feature_flag":0,"recognize_tasks":[],"template_item_infos":[],"unlock_template_ids":[]}', "utf8");
  await fs.writeFile(path.join(draftDir, "common_attachment", "attachment_id_mapping.json"),
    '{"id_mapping":{"mapping":[],"next_index":1000,"version":"1.0.0"}}', "utf8");
  await fs.writeFile(path.join(draftDir, "common_attachment", "attachment_pc_timeline.json"),
    '{"reference_lines_config":{"horizontal_lines":[],"is_lock":false,"is_visible":false,"vertical_lines":[]},"safe_area_type":0}', "utf8");
  for (const name of ["attachment_action_scene.json", "attachment_plugin_draft.json", "attachment_script_video.json"]) {
    await fs.writeFile(path.join(draftDir, "common_attachment", name), "", "utf8");
  }

  // 索引注册：原索引先备份到草稿目录 .avw/，再原子替换。
  const indexRaw = await fs.readFile(options.indexFilePath, "utf8");
  await fs.writeFile(path.join(plainDir, "root_meta_info.backup.json"), indexRaw, "utf8");
  let rootIndex: { all_draft_store?: unknown[]; draft_ids?: number };
  try {
    rootIndex = JSON.parse(indexRaw) as { all_draft_store?: unknown[]; draft_ids?: number };
  } catch {
    issues.push({ code: "jianying-draft-error", message: "剪映草稿索引不是合法 JSON（" + options.indexFilePath + "）；为不破坏索引，本次未注册（草稿目录已生成，可手工登记）。", path: options.indexFilePath });
    return { ok: false, plan, draftDir, draftId: ctx.ids.draftId, timelineId: ctx.ids.timelineId, issues };
  }
  const entries = Array.isArray(rootIndex.all_draft_store) ? rootIndex.all_draft_store as Record<string, unknown>[] : [];
  entries.unshift({
    cloud_draft_cover: false,
    cloud_draft_sync: false,
    draft_cloud_last_action_download: false,
    draft_cloud_purchase_info: "",
    draft_cloud_template_id: "",
    draft_cloud_tutorial_info: "",
    draft_cloud_videocut_purchase_info: "",
    draft_cover: toPosix(path.join(draftDir, "draft_cover.jpg")),
    draft_fold_path: toPosix(draftDir),
    draft_id: ctx.ids.draftId,
    draft_is_ai_shorts: false,
    draft_is_cloud_temp_draft: false,
    draft_is_infinite_canvas_draft: false,
    draft_is_invisible: false,
    draft_is_pippit_draft: false,
    draft_is_web_article_video: false,
    draft_json_file: toPosix(path.join(draftDir, "draft_content.json")),
    draft_name: plan.draftName,
    draft_new_version: "",
    draft_root_path: options.draftsRoot,
    draft_timeline_materials_size: ctx.materialsSizeBytes,
    draft_type: "",
    draft_web_article_video_enter_from: "",
    pippit_avatar_url: "", pippit_extra_info: "", pippit_id: "", pippit_user_name: "",
    streaming_edit_draft_ready: true,
    tm_draft_cloud_completed: "",
    tm_draft_cloud_entry_id: -1,
    tm_draft_cloud_modified: 0,
    tm_draft_cloud_parent_entry_id: -1,
    tm_draft_cloud_space_id: -1,
    tm_draft_cloud_user_id: -1,
    tm_draft_create: ctx.nowMicros,
    tm_draft_modified: ctx.nowMicros,
    tm_draft_removed: 0,
    tm_duration: ctx.totalDurationMicros
  });
  rootIndex.all_draft_store = entries;
  rootIndex.draft_ids = entries.length;
  await fs.writeFile(options.indexFilePath, JSON.stringify(rootIndex), "utf8");

  // 缺素材/跳过是信息性提示（交付物里如实标注），不算失败；错误级 issue 才压低 ok。
  const failed = issues.some((issue) => issue.code === "jianying-draft-error" || issue.code === "roughcut-plan-mismatch");
  return { ok: !failed, plan, draftDir, draftId: ctx.ids.draftId, timelineId: ctx.ids.timelineId, issues };
}

/** 命令行摘要；结尾固定提示人工终审（文件写成功不等于结论）。 */
export function renderJianyingDraftSummary(result: DraftResult): string {
  const lines: string[] = [];
  if (result.plan === null) {
    lines.push("剪映草稿生成未开始：前置条件不满足。");
  } else {
    lines.push("草稿名：" + result.plan.draftName);
    for (const segment of result.plan.segments) {
      lines.push(
        "  " + String(segment.row.cutOrder).padStart(2, " ") + ". " + segment.row.shotKey + "｜" + segment.row.videoFile +
        "｜" + (segment.durationMicros / 1_000_000).toFixed(1) + " 秒"
      );
    }
    lines.push("合计 " + (result.plan.totalDurationMicros / 1_000_000).toFixed(1) + " 秒（" + result.plan.segments.length + " 段）");
    if (result.plan.skipped.length > 0) {
      lines.push("跳过 " + result.plan.skipped.length + " 个镜头：");
      for (const skip of result.plan.skipped) {
        lines.push("  - " + skip.shotKey + "：" + skip.reason);
      }
    }
  }
  if (result.draftDir !== null) {
    lines.push("草稿目录：" + result.draftDir);
    lines.push("已注册剪映索引（原索引备份在草稿目录 .avw/ 下）。");
    lines.push("下一步（必做）：打开剪映 → 首页应出现「" + (result.plan?.draftName ?? "") + "」→ 打开核对顺序、时长与素材；这一步人工确认之前，产物按未验证对待。");
  }
  if (result.issues.length > 0) {
    lines.push("需要注意 " + String(result.issues.length) + " 条：");
    for (const issue of result.issues) {
      lines.push("  ! [" + issue.code + "] " + issue.message);
    }
  }
  return lines.join("\n");
}
