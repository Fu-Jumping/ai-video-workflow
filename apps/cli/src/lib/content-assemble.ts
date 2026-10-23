import { createHash } from "node:crypto";
import fs from "fs-extra";
import path from "node:path";

import {
  CONTENT_BLOCK_NAMES,
  CONTENT_INDEX_FILE,
  CONTENT_ROOT_DIRECTORY,
  CONTENT_SHOT_OVERVIEW_FILE,
  CONTENT_STORYBOARD_OVERVIEW_FILE,
  PLATFORM_DISPLAY_NAMES,
  SCENE_OVERVIEW_FILE,
  SHOT_GROUP_OVERVIEW_FILE,
  STEP_DIR_BY_NUMBER
} from "./constants.js";
import {
  buildContentTree,
  getContentBlockBody,
  labeledLine,
  renderAutoBlock,
  renderManualBlock,
  replaceContentBlockBody,
  resolveContentMode,
  shotGroupDirectoryName,
  type ContentTree,
  type ContentTreeGroup,
  type ContentTreeScene,
  type ContentTreeShot
} from "./content-tree.js";
import {
  describeMediaCandidateState,
  listMediaRecords,
  mediaIdentityKey,
  videoPurpose,
  type MediaIdentity,
  type MediaRecord
} from "./media-records.js";
import { readProjectConfig } from "./project-config.js";
import { extractReferenceAssets, type ReferenceAssetToken } from "./reference-assets.js";
import type { ContentMode, Platform, VerificationIssue } from "./types.js";

/* ------------------------------------------------------------------ *
 * 内容树整理：总表、场／组总览、镜头汇总、04／05 完整执行文件、内容树索引
 *
 * 约定：
 * - 自动区块内部第一行是哈希注释，用于判断「自动内容有没有被人手改过」；
 *   刷新时内容不一致默认不覆盖，需显式 force。
 * - 生成结果不含时间戳与随机量，同样输入重复整理结果逐字相同（幂等）。
 * ------------------------------------------------------------------ */

const FENCE = "```";
const BLOCK = CONTENT_BLOCK_NAMES;
const SELECTED_LABEL = "已选用";
const BLOCK_HASH_PATTERN = /^<!--\s*avw:auto:hash=([0-9a-f]{64})\s*-->\n?/u;

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function padNumber(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

function stripTrailingNewlines(value: string): string {
  return value.replace(/\n+$/u, "");
}

/** 相对链接：从 fromRelPath 所在目录指向 toRelPath。 */
function relativeLink(fromRelPath: string, toRelPath: string): string {
  const relative = path.posix.relative(path.posix.dirname(fromRelPath), toRelPath);
  return relative.startsWith(".") ? relative : "./" + relative;
}

function singleLine(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\s+/gu, " ").trim();
}

/** 正文首句：用于总表「本段摘要」。 */
function firstSentence(value: string | null | undefined): string {
  const text = (value ?? "")
    .split("\n")
    .map((line) => line.replace(/^[\s>*\-+]+/u, "").trim())
    .filter((line) => line.length > 0)
    .join(" ");
  const collapsed = singleLine(text);
  if (collapsed.length === 0) return "";
  const matched = /^(.+?[。！？!?])/u.exec(collapsed);
  return matched ? matched[1] : collapsed;
}

/**
 * 分镜总表的「本段摘要」：优先取分镜正文里明确标注的动作行，避免把整段
 * 结构化正文（景别／人物／背景／声音……）压成一格。没有标注行时退回首句。
 */
function storyboardSummary(document: { bodySection: string }): string {
  const labelled = labeledLine(document.bodySection, [
    "本段摘要",
    "画面与动作",
    "本段画面与动作",
    "动作起止",
    "动作与节奏",
    "内容"
  ]);
  return firstSentence(labelled ?? document.bodySection);
}

function tableCell(value: string): string {
  const text = value.replace(/\|/gu, "／").replace(/\n+/gu, " ").trim();
  return text.length > 0 ? text : "—";
}

function shotLabel(shot: ContentTreeShot): string {
  return shot.shotId.replace(/^shot-/u, "镜头-");
}

function storyboardLabel(storyboardId: string): string {
  return storyboardId.replace(/^storyboard-/u, "分镜-");
}

function keyframeLabel(keyframeId: string): string {
  return keyframeId.replace(/^keyframe-/u, "");
}

/* ------------------------------ 生成文件哈希 ------------------------------ */

/** 给整份生成文件加哈希标记（第一行，Markdown 注释不可见）。 */
export function stampGeneratedFile(content: string): string {
  const body = stripTrailingNewlines(content);
  return "<!-- avw:auto:hash=" + sha256(body) + " -->\n" + body + "\n";
}

/** 读整份生成文件里记录的哈希；没有返回 null。 */
export function readGeneratedFileHash(content: string): string | null {
  const matched = /^<!--\s*avw:auto:hash=([0-9a-f]{64})\s*-->\n?/u.exec(content);
  return matched ? matched[1] : null;
}

/** 去掉整份文件的哈希标记行。 */
export function stripGeneratedFileHash(content: string): string {
  return content.replace(/^<!--\s*avw:auto:hash=[0-9a-f]{64}\s*-->\n?/u, "");
}

/** 自动区块内部第一行的哈希；没有返回 null。 */
export function readBlockHash(body: string): string | null {
  const matched = BLOCK_HASH_PATTERN.exec(body);
  return matched ? matched[1] : null;
}

/** 去掉自动区块内部的哈希行，得到真正的内容。 */
export function stripBlockHash(body: string): string {
  return body.replace(BLOCK_HASH_PATTERN, "");
}

/** 自动区块的「内层正文」：第一行是内容哈希，后面是真正的内容。 */
export function hashedBlockBody(body: string): string {
  const normalized = stripTrailingNewlines(body);
  return "<!-- avw:auto:hash=" + sha256(normalized) + " -->\n" + normalized;
}

/** 渲染带哈希的自动区块（含首尾标记）：区块内部第一行记录内容哈希。 */
export function renderHashedAutoBlock(name: string, body: string): string {
  return renderAutoBlock(name, hashedBlockBody(body));
}

/** 判断已有自动区块是否被人手改过：哈希与内容不一致即视为改过。 */
export function autoBlockDrifted(body: string): boolean {
  const recorded = readBlockHash(body);
  if (!recorded) return false;
  return sha256(stripTrailingNewlines(stripBlockHash(body))) !== recorded;
}

/* ------------------------------ 素材状态 ------------------------------ */

export interface MaterialIndex {
  records: Map<string, MediaRecord>;
}

function identityKey(category: MediaIdentity["category"], objectId: string, purpose: string): string {
  return mediaIdentityKey({ category, objectId, purpose });
}

export async function loadMaterialIndex(projectRoot: string): Promise<MaterialIndex> {
  const records = new Map<string, MediaRecord>();
  for (const record of await listMediaRecords(projectRoot)) {
    records.set(mediaIdentityKey(record.identity), record);
  }
  return { records };
}

function recordState(record: MediaRecord | undefined): string | null {
  if (!record) return null;
  const selected = record.currentSelection
    ? record.candidates.find((candidate) => String(candidate.candidate) === String(record.currentSelection))
    : undefined;
  const candidate = selected ?? record.candidates[record.candidates.length - 1];
  if (!candidate) return null;
  return describeMediaCandidateState(candidate);
}

export function keyframeStatusText(index: MaterialIndex, shot: ContentTreeShot, keyframeId: string): string {
  return recordState(index.records.get(identityKey("keyframe", shot.shotId, keyframeId))) ?? "未生成";
}

export function videoStatusText(index: MaterialIndex, shot: ContentTreeShot): string {
  return recordState(index.records.get(identityKey("video", shot.shotId, videoPurpose))) ?? "未生成";
}

export function shotKeyframeIds(shot: ContentTreeShot): string[] {
  return shot.storyboards.flatMap((storyboard) => storyboard.document.keyframes.map((keyframe) => keyframe.id));
}

function keyframeSummaryText(index: MaterialIndex, shot: ContentTreeShot): string {
  const ids = shotKeyframeIds(shot);
  if (ids.length === 0) return "无独立关键帧";
  const states = ids.map((id) => keyframeStatusText(index, shot, id));
  const pending = states.filter((state) => state !== SELECTED_LABEL).length;
  if (pending === 0) return String(ids.length) + " 张（已选用）";
  if (pending === ids.length) return String(ids.length) + " 张（未生成）";
  return String(ids.length) + " 张（" + String(ids.length - pending) + " 张已选用，其余待处理）";
}

/** 总表「本轮待看事项」：只列自动可判的缺口，人工判断写在人工摘要区块。 */
function pendingHints(index: MaterialIndex, shot: ContentTreeShot): string {
  const hints: string[] = [];
  if (shot.storyboards.length === 0) hints.push("还没有分镜");
  if (!shot.assembly.text) hints.push("整镜正文未拼装");
  const keyframes = shotKeyframeIds(shot);
  if (keyframes.length === 0) hints.push("没有关键帧");
  else if (keyframes.some((id) => keyframeStatusText(index, shot, id) !== SELECTED_LABEL)) hints.push("关键帧待选定");
  if (videoStatusText(index, shot) !== SELECTED_LABEL) hints.push("视频待选定");
  if (!shot.document.displayName) hints.push("缺展示名");
  return hints.length > 0 ? hints.join("、") : "—";
}

/* ------------------------------ 顺序与总表 ------------------------------ */

export function orderedShots(tree: ContentTree): ContentTreeShot[] {
  return [...tree.shots].sort((left, right) => {
    const leftOrder = left.document.watchOrder ?? left.document.shotNumber;
    const rightOrder = right.document.watchOrder ?? right.document.shotNumber;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.shotId.localeCompare(right.shotId);
  });
}

function watchOrderLabel(shot: ContentTreeShot): string {
  return String(shot.document.watchOrder ?? shot.document.shotNumber);
}

/** 00_镜头总表.md 的自动区块内容：一行一镜。 */
export function renderShotOverviewBody(tree: ContentTree, index: MaterialIndex): string {
  const lines = [
    "| 顺序 | 镜头 | 所属场与组 | 内容 | 目标时长 | 分镜数 | 关键帧 | 视频 | 本轮待看事项 | 打开 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"
  ];
  for (const shot of orderedShots(tree)) {
    lines.push(
      "| " +
        [
          watchOrderLabel(shot),
          shotLabel(shot),
          shot.sceneId + " / " + shot.groupId,
          tableCell(singleLine(shot.document.displayName) || "（未写展示名）"),
          tableCell(shot.document.targetDuration ?? "—"),
          String(shot.storyboards.length),
          tableCell(keyframeSummaryText(index, shot)),
          tableCell(videoStatusText(index, shot)),
          tableCell(pendingHints(index, shot)),
          "[打开](" + relativeLink(tree.shotOverviewRelPath, shot.relPath) + ")"
        ].join(" | ") +
        " |"
    );
  }
  return lines.join("\n");
}

/** 01_分镜总表.md 的自动区块内容：一行一分镜。 */
export function renderStoryboardOverviewBody(tree: ContentTree, index: MaterialIndex): string {
  const lines = [
    "| 顺序 | 分镜 | 所属镜头 | 景别与拍法 | 本段摘要 | 关键帧 | 视频提示词 | 打开 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |"
  ];
  let order = 0;
  for (const shot of orderedShots(tree)) {
    for (const storyboard of shot.storyboards) {
      order += 1;
      const document = storyboard.document;
      const keyframeText =
        document.keyframes.length === 0
          ? "无独立关键帧"
          : document.keyframes.map((keyframe) => keyframe.id).join("、");
      lines.push(
        "| " +
          [
            String(order),
            storyboardLabel(document.storyboardId),
            shotLabel(shot),
            tableCell(document.shotSize ?? "—"),
            tableCell(storyboardSummary(document)),
            tableCell(keyframeText),
            document.videoPromptSegment ? "已写" : "未写",
            "[打开](" + relativeLink(tree.storyboardOverviewRelPath, storyboard.relPath) + ")"
          ].join(" | ") +
          " |"
      );
    }
  }
  return lines.join("\n");
}

/** 场总览里的镜头组表。 */
export function renderSceneGroupTable(scene: ContentTreeScene, tree: ContentTree): string {
  const lines = ["| 镜头组 | 内容 | 镜头数 | 打开 |", "| --- | --- | --- | --- |"];
  for (const group of scene.groups) {
    const names = group.shots.map((shot) => singleLine(shot.document.displayName) || shotLabel(shot)).join("、");
    lines.push(
      "| " +
        [
          group.groupId,
          tableCell(names.length > 0 ? names : "（还没有镜头）"),
          String(group.shots.length),
          "[打开](" + relativeLink(scene.overviewRelPath, group.overviewRelPath) + ")"
        ].join(" | ") +
        " |"
    );
  }
  return lines.join("\n");
}

/** 镜头组总览里的镜头表。 */
export function renderGroupShotTable(group: ContentTreeGroup, tree: ContentTree): string {
  const lines = ["| 顺序 | 镜头 | 内容 | 分镜数 | 打开 |", "| --- | --- | --- | --- | --- |"];
  const shots = [...group.shots].sort((left, right) => {
    const leftOrder = left.document.watchOrder ?? left.document.shotNumber;
    const rightOrder = right.document.watchOrder ?? right.document.shotNumber;
    return leftOrder - rightOrder || left.shotId.localeCompare(right.shotId);
  });
  for (const shot of shots) {
    lines.push(
      "| " +
        [
          watchOrderLabel(shot),
          shotLabel(shot),
          tableCell(singleLine(shot.document.displayName) || "（未写展示名）"),
          String(shot.storyboards.length),
          "[打开](" + relativeLink(group.overviewRelPath, shot.relPath) + ")"
        ].join(" | ") +
        " |"
    );
  }
  return lines.join("\n");
}

/* ------------------------------ 镜头汇总三块 ------------------------------ */

/** 镜头汇总「一、下辖分镜速览」。 */
export function renderShotSegmentDigest(shot: ContentTreeShot): string {
  const lines = ["| 顺序 | 分镜 | 动作与拍法（一句话） | 关键帧 | 打开 |", "| --- | --- | --- | --- | --- |"];
  for (const storyboard of shot.storyboards) {
    const document = storyboard.document;
    lines.push(
      "| " +
        [
          String(document.storyboardNumber),
          storyboardLabel(document.storyboardId),
          tableCell(storyboardSummary(document)),
          tableCell(document.keyframes.length > 0 ? document.keyframes.map((entry) => entry.id).join("、") : "无"),
          "[打开](" + relativeLink(shot.relPath, storyboard.relPath) + ")"
        ].join(" | ") +
        " |"
    );
  }
  return lines.join("\n");
}

/** 镜头汇总「二、图片提示词」：按关键帧逐个给可复制正文。 */
export function renderShotImagePrompts(shot: ContentTreeShot): string {
  const parts: string[] = [];
  for (const storyboard of shot.storyboards) {
    for (const keyframe of storyboard.document.keyframes) {
      parts.push("### " + keyframe.id + "（对应分镜 " + String(keyframe.mappedSegment ?? "?") + "）");
      if (keyframe.moment) parts.push("> 关键时刻：" + keyframe.moment);
      parts.push("");
      parts.push(FENCE + "text");
      parts.push(stripTrailingNewlines(keyframe.prompt ?? "（本段关键帧提示词尚未写）"));
      parts.push(FENCE);
      parts.push("");
    }
  }
  if (parts.length === 0) {
    return "本镜没有独立关键帧。若后续决定补关键帧，另起关键帧编号，不复用已删除的编号。";
  }
  return stripTrailingNewlines(parts.join("\n"));
}

/** 镜头汇总「三、完整视频提示词」的自动区块：按分镜序号拼装。 */
export function renderShotSegments(shot: ContentTreeShot): string {
  if (shot.assembly.segments.length === 0) {
    return "（分镜视频提示词片段还没写齐，暂不能拼装整镜正文。）";
  }
  return shot.assembly.segments.map((segment) => stripTrailingNewlines(segment.text)).join("\n\n");
}

/* ------------------------------ 参考资产 ------------------------------ */

export function shotReferenceAssets(shot: ContentTreeShot): ReferenceAssetToken[] {
  const tokens: ReferenceAssetToken[] = [];
  const seen = new Set<string>();
  const sources: string[] = [shot.document.raw];
  for (const storyboard of shot.storyboards) {
    sources.push(storyboard.document.bodySection);
    sources.push(storyboard.document.videoPromptSegment ?? "");
    for (const keyframe of storyboard.document.keyframes) {
      sources.push(keyframe.prompt ?? "");
    }
  }
  for (const source of sources) {
    for (const token of extractReferenceAssets(source)) {
      if (seen.has(token.token)) continue;
      seen.add(token.token);
      tokens.push(token);
    }
  }
  return tokens;
}

/* ------------------------------ 04／05 完整执行文件 ------------------------------ */

function platformExecutionBlock(platform: Platform): string[] {
  if (platform === "midjourney") {
    return [
      "| 项目 | 值 |",
      "| --- | --- |",
      "| 图片平台 | " + PLATFORM_DISPLAY_NAMES.midjourney + " |",
      "| 版本参数 | --v 8.2 |",
      "| 画幅参数 | --ar 16:9 |",
      "| 风格参数 | --style raw |",
      "| 风格化强度 | --stylize 200（不得超过 1000） |",
      "",
      FENCE + "text",
      "--v 8.2 --ar 16:9 --style raw --stylize 200",
      FENCE
    ];
  }
  return [
    "| 项目 | 值 |",
    "| --- | --- |",
    "| 图片平台 | " + PLATFORM_DISPLAY_NAMES["gpt-image-2"] + " |",
    "| 执行模型 | gpt-image-2（LibTV 接口名 lib-image-2） |",
    "| 画幅 | 16:9 |",
    "| 参考图 | 按「参考资产」一栏的上传顺序使用 |",
    "",
    FENCE + "text",
    "model=gpt-image-2; lib-image-2; aspect=16:9",
    FENCE
  ];
}

/** 04 执行文件相对路径：04_图片提示词/镜头组-NNN/镜头-NNN-关键帧-NN.md。 */
export function step4FileRelPath(shot: ContentTreeShot, keyframeId: string): string {
  return toPosix(
    path.join(
      STEP_DIR_BY_NUMBER[4],
      shotGroupDirectoryName(shot.groupId),
      shotLabel(shot) + "-关键帧-" + keyframeLabel(keyframeId) + ".md"
    )
  );
}

/** 05 执行文件相对路径：05_视频提示词/镜头组-NNN/镜头-NNN.md。 */
export function step5FileRelPath(shot: ContentTreeShot): string {
  return toPosix(path.join(STEP_DIR_BY_NUMBER[5], shotGroupDirectoryName(shot.groupId), shotLabel(shot) + ".md"));
}

/** 03 内容树索引相对路径：03_分镜脚本/00_内容树索引.md。 */
export function contentIndexRelPath(): string {
  return toPosix(path.join(STEP_DIR_BY_NUMBER[3], CONTENT_INDEX_FILE));
}

/** 单关键帧的 04 完整执行文件正文（保持 Step 4 文件合同三件套）。 */
export function renderStep4File(
  shot: ContentTreeShot,
  storyboardRelPath: string,
  keyframeId: string,
  platform: Platform,
  index: MaterialIndex
): string | null {
  const storyboard = shot.storyboards.find((entry) => entry.relPath === storyboardRelPath);
  if (!storyboard) return null;
  const keyframe = storyboard.document.keyframes.find((entry) => entry.id === keyframeId);
  if (!keyframe) return null;

  const relPath = step4FileRelPath(shot, keyframeId);
  const assets = shotReferenceAssets(shot);
  const chinese = stripTrailingNewlines(keyframe.prompt ?? "");
  const copyable = stripTrailingNewlines(keyframe.copyablePrompt ?? keyframe.prompt ?? "");

  const lines: string[] = [
    "# " + shotLabel(shot) + " 关键帧 " + keyframeLabel(keyframeId) + "：图片提示词",
    "",
    "## 快速导读",
    "",
    "- **画面内容**：" + (keyframe.moment ?? "见中文完整版本。"),
    "- **机位关系**：" + (storyboard.document.shotSize ?? "见本段分镜。"),
    "- **主体状态**：" +
      (labeledLine(storyboard.document.bodySection, ["人物与位置", "主体状态", "画面与动作"]) ??
        (singleLine(shot.document.displayName) || shotLabel(shot)) + " 的当前状态以本段分镜为准。"),
    "",
    "## 维护元信息",
    "",
    "- 镜头组：" + shot.groupId,
    "- 镜头编号：" + shot.shotId,
    "- 对应分镜：分镜 " + String(keyframe.mappedSegment ?? "?"),
    "- 关键时刻：" + (keyframe.moment ?? "（未写）"),
    "- 来源：[" + storyboardLabel(storyboard.document.storyboardId) + "](" + relativeLink(relPath, storyboard.relPath) + ")",
    "",
    "## 中文完整版本",
    "",
    FENCE + "text",
    chinese.length > 0 ? chinese : "（本段关键帧提示词尚未写）",
    FENCE,
    "",
    "## 可复制提示词",
    "",
    FENCE + "text",
    copyable.length > 0 ? copyable : "（本段关键帧可复制提示词尚未写）",
    FENCE,
    "",
    "## 负面约束",
    "",
    "- 避免：现代城市天际线、现代服装、塑料质感与过度磨皮。",
    "- 避免：画面出现文字、水印、平台角标或分屏拼贴。",
    "- 避免：改变已定角色三视图的脸型、发型与服装主色。",
    "",
    "## 平台执行参数",
    "",
    ...platformExecutionBlock(platform),
    "",
    "## 参考资产",
    "",
    assets.length > 0
      ? assets.map((token) => "- " + token.token).join("\n")
      : "本段不引用额外参考资产；只使用项目内已登记的角色三视图与场景图。",
    "",
    "## 中文自检",
    "",
    "- [ ] 提示词里没有绝对路径、账号或密钥。",
    "- [ ] 关键帧对应的分镜与实际分镜一致。",
    "- [ ] 参考资产按上传顺序写在上面，且与分镜里的 @ 引用一致。",
    "",
    "> 素材状态：" + keyframeStatusText(index, shot, keyframe.id) + "。本文件由内容树生成，改提示词请改对应的分镜文件。"
  ];
  return lines.join("\n") + "\n";
}

/** 单镜的 05 完整执行文件正文（可复制提示词与镜头汇总逐字一致）。 */
export function renderStep5File(shot: ContentTreeShot, platform: Platform, index: MaterialIndex): string {
  const relPath = step5FileRelPath(shot);
  const assets = shotReferenceAssets(shot);
  const displayName = singleLine(shot.document.displayName) || shotLabel(shot);
  const targetDuration = shot.document.targetDuration ?? "15 秒";
  const keyframeIds = shotKeyframeIds(shot);
  const keyframeLink =
    keyframeIds.length > 0
      ? keyframeIds
          .map((id) => "[" + "关键帧 " + keyframeLabel(id) + "](" + relativeLink(relPath, step4FileRelPath(shot, id)) + ")")
          .join("、")
      : "无独立关键帧";

  const lines: string[] = [
    "# " + shotLabel(shot) + "：" + displayName,
    "",
    "## 元信息",
    "",
    "- 镜头组：" + shot.groupId,
    "- 镜头编号：" + shot.shotId,
    "- 场景事件范围：" + shot.sceneId + " / " + shot.groupId,
    "- 目标时长：" + targetDuration,
    "- 分镜数量：" + String(shot.storyboards.length) + "（1—6 段）",
    "- 关键帧文件：" + keyframeLink,
    "",
    "## 平台执行设置",
    "",
    "| 项目 | 值 |",
    "| --- | --- |",
    "| 默认视频平台 | " + PLATFORM_DISPLAY_NAMES[platform] + "（" + platform + "） |",
    "| 执行模型 | Seedance 2.0 |",
    "| 参考模式 | 全能参考模式 |",
    "| 输入方式 | 关键帧图片 + 文字提示词 |",
    "| 目标时长 | " + targetDuration + " |",
    "| 画幅 | 16:9 |",
    "| 参考素材 | " + (assets.length > 0 ? assets.map((token) => token.token).join("、") : "无额外参考素材") + " |",
    "| 素材上传顺序 | 先上传关键帧，再上传角色三视图与场景图，最后上传道具参考 |",
    "| 负面约束 | 见文末「负面约束」，逐条粘贴到平台 |",
    "",
    "## 参考素材映射",
    "",
    assets.length > 0
      ? assets.map((token) => "- " + token.token + "：按上传顺序绑定到本镜对应主体或场景。").join("\n")
      : "本镜只使用项目内已登记的角色三视图与场景图，无额外参考素材。",
    "",
    "## 可复制提示词",
    "",
    FENCE + "text",
    stripTrailingNewlines(shot.assembly.text ?? "（分镜视频提示词片段还没写齐，暂不能生成整镜正文。）"),
    FENCE,
    "",
    "## 负面约束",
    "",
    "- 无配乐、无字幕。",
    "- 画面里不要出现文字、字幕条、水印或平台角标。",
    "- 不得把本镜「" + displayName + "」拍成与分镜描述无关的场景或动作。",
    "- 不得改变角色三视图已定的脸型、发型与服装主色。",
    "- 不得超过 " + targetDuration + "。",
    "- 不得超过 6 个连续编号的镜头段。",
    "",
    "## 自检",
    "",
    "- [ ] 上面「可复制提示词」与镜头汇总文件里的整镜正文逐字一致。",
    "- [ ] 镜头 1 到镜头 " + String(shot.storyboards.length) + " 的段落数量与分镜数一致。",
    "- [ ] 参考素材按上传顺序排列，且与分镜里的 @ 引用一致。",
    "- [ ] 已写明无配乐、无字幕。",
    "",
    "> 素材状态：" + videoStatusText(index, shot) + "。本文件由内容树生成，改提示词请改对应的分镜文件。"
  ];
  return lines.join("\n") + "\n";
}

/** 03_分镜脚本/00_内容树索引.md 正文：只做索引，不复制正文。 */
export function renderContentIndex(tree: ContentTree): string {
  const indexRelPath = contentIndexRelPath();
  const lines: string[] = [
    "# 内容树索引",
    "",
    "> 本文件只是索引。正文唯一事实源在「" + CONTENT_ROOT_DIRECTORY + "/」，这里不复制正文，避免出现两套原文。",
    "",
    "## 总表",
    "",
    "- [镜头总表](" + relativeLink(indexRelPath, tree.shotOverviewRelPath) + ")",
    "- [分镜总表](" + relativeLink(indexRelPath, tree.storyboardOverviewRelPath) + ")",
    "",
    "## 场与镜头组",
    ""
  ];
  for (const scene of tree.scenes) {
    lines.push("### " + scene.sceneId);
    lines.push("");
    lines.push("- [场总览](" + relativeLink(indexRelPath, scene.overviewRelPath) + ")");
    for (const group of scene.groups) {
      lines.push("- [镜头组 " + group.groupId + "](" + relativeLink(indexRelPath, group.overviewRelPath) + ")");
    }
    lines.push("");
  }
  lines.push("## 镜头与分镜");
  lines.push("");
  for (const shot of orderedShots(tree)) {
    lines.push("### " + shotLabel(shot));
    lines.push("");
    lines.push("- [镜头汇总](" + relativeLink(indexRelPath, shot.relPath) + ")");
    for (const storyboard of shot.storyboards) {
      lines.push("- [" + storyboardLabel(storyboard.document.storyboardId) + "](" + relativeLink(indexRelPath, storyboard.relPath) + ")");
    }
    lines.push("");
  }
  return lines.join("\n") + "\n";
}

/* ------------------------------ 区块合并与写盘 ------------------------------ */

export interface BlockSpec {
  name: string;
  body: string;
}

export interface FileAssemblyResult {
  relPath: string;
  content: string;
  changed: boolean;
  created: boolean;
  /** 因手改而未覆盖的区块名。 */
  skippedBlocks: string[];
}

function blockOrder(content: string, names: readonly string[]): string[] {
  const present = names.filter((name) => getContentBlockBody(content, name) !== null);
  return present;
}

/**
 * 把一批自动区块合并进一份文件。
 *
 * - 区块已存在且未被手改：替换为新内容（幂等）。
 * - 区块已存在但哈希不符（被人手改）：默认保留原内容并记 skippedBlocks；force 时覆盖。
 * - 区块不存在：追加到文件末尾。
 */
function mergeAutoBlocks(
  content: string,
  specs: readonly BlockSpec[],
  force: boolean,
  relPath: string,
  issues: VerificationIssue[]
): FileAssemblyResult {
  let next = content;
  const skippedBlocks: string[] = [];
  const changedBlocks: string[] = [];

  for (const spec of specs) {
    const existingBody = getContentBlockBody(next, spec.name);
    if (existingBody === null) {
      const trimmed = next.replace(/\n+$/u, "");
      const rendered = renderHashedAutoBlock(spec.name, spec.body);
      next = trimmed.length > 0 ? trimmed + "\n\n" + rendered + "\n" : rendered + "\n";
      changedBlocks.push(spec.name);
      continue;
    }
    if (autoBlockDrifted(existingBody) && !force) {
      skippedBlocks.push(spec.name);
      issues.push({
        code: "content-summary-manual-drift",
        message:
          "「" + relPath + "」的自动区块「" + spec.name + "」被手工改过；刷新默认不覆盖。要覆盖请显式加 --force（覆盖前会备份到 .tmp/）。",
        path: relPath
      });
      continue;
    }
    const replaced = replaceContentBlockBody(next, spec.name, hashedBlockBody(spec.body));
    if (replaced === null) continue;
    if (replaced !== next) changedBlocks.push(spec.name);
    next = replaced;
  }

  return {
    relPath,
    content: next,
    changed: changedBlocks.length > 0,
    created: false,
    skippedBlocks
  };
}

interface WritePlan {
  relPath: string;
  content: string;
  /** true = 整份生成文件（带文件级哈希）。 */
  generated: boolean;
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : value + "\n";
}

async function readIfExists(absPath: string): Promise<string | null> {
  return (await fs.pathExists(absPath)) ? await fs.readFile(absPath, "utf8") : null;
}

async function backupFile(projectRoot: string, relPath: string, backupRoot: string): Promise<void> {
  const absPath = path.join(projectRoot, relPath);
  if (!(await fs.pathExists(absPath))) return;
  const target = path.join(projectRoot, backupRoot, relPath);
  await fs.ensureDir(path.dirname(target));
  await fs.copyFile(absPath, target);
}

/* ------------------------------ 骨架（仅在文件不存在时使用） ------------------------------ */

function shotOverviewSkeleton(): string {
  return [
    "# 镜头总表",
    "",
    "> 一行一个镜头，用来看故事的连续顺序、时长与材料情况。下面的表是自动生成的；要补自己的话，写在「人工摘要」区块里。",
    "",
    renderAutoBlock(BLOCK.shotOverview, "| 顺序 | 镜头 | 所属场与组 | 内容 | 目标时长 | 分镜数 | 关键帧 | 视频 | 本轮待看事项 | 打开 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"),
    "",
    renderManualBlock(BLOCK.manualSummary, "（这里写你自己对整片节奏的判断，自动刷新不会覆盖。）"),
    ""
  ].join("\n");
}

function storyboardOverviewSkeleton(): string {
  return [
    "# 分镜总表",
    "",
    "> 一行一个分镜，用来看每一段画面、关键帧与视频提示词的状态。下面的表是自动生成的；要补自己的话，写在「人工摘要」区块里。",
    "",
    renderAutoBlock(BLOCK.storyboardOverview, "| 顺序 | 分镜 | 所属镜头 | 景别与拍法 | 本段摘要 | 关键帧 | 视频提示词 | 打开 |\n| --- | --- | --- | --- | --- | --- | --- | --- |"),
    "",
    renderManualBlock(BLOCK.manualSummary, "（这里写你自己对分镜节奏的判断，自动刷新不会覆盖。）"),
    ""
  ].join("\n");
}

function sceneOverviewSkeleton(sceneId: string): string {
  return [
    "# " + sceneId + " 场总览",
    "",
    "> 这一场包含哪些镜头组、观看顺序如何。下面的表是自动生成的。",
    "",
    "## 这一场讲什么",
    "",
    "（写这一场在故事里的位置与作用。）",
    "",
    "## 所属镜头组",
    "",
    renderAutoBlock(BLOCK.sceneGroups, "| 镜头组 | 内容 | 镜头数 | 打开 |\n| --- | --- | --- | --- |"),
    ""
  ].join("\n");
}

function groupOverviewSkeleton(groupId: string): string {
  return [
    "# " + groupId + " 镜头组总览",
    "",
    "> 这一组包含哪些镜头、观看顺序如何。下面的表是自动生成的。",
    "",
    "## 这一组讲什么",
    "",
    "（写这一组在故事里的位置与作用。）",
    "",
    "## 所属镜头",
    "",
    renderAutoBlock(BLOCK.groupShots, "| 顺序 | 镜头 | 内容 | 分镜数 | 打开 |\n| --- | --- | --- | --- | --- |"),
    ""
  ].join("\n");
}

/* ------------------------------ 整理入口 ------------------------------ */

export interface AssembleOptions {
  /** 覆盖被手改过的自动区块（覆盖前备份到 backupDir）。 */
  force?: boolean;
  /** 只计算不写盘（迁移预览与 dry-run 用）。 */
  dryRun?: boolean;
  /** 备份目录，默认 .tmp/content-backup。 */
  backupDir?: string;
  /** 不写备份（新建项目首次整理时没有旧内容可备份）。 */
  skipBackup?: boolean;
}

export interface AssembleChange {
  relPath: string;
  kind: "create" | "update" | "unchanged";
  /** 变动的区块名（整份生成文件为 ["（整份文件）"]）。 */
  blocks: string[];
}

export interface AssembleResult {
  ok: boolean;
  mode: ContentMode;
  changes: AssembleChange[];
  issues: VerificationIssue[];
}

function platformDefaults(config: { platforms?: { image: { default: Platform }; video: { default: Platform } } } | null): {
  image: Platform;
  video: Platform;
} {
  return {
    image: config?.platforms?.image.default ?? "gpt-image-2",
    video: config?.platforms?.video.default ?? "seedance"
  };
}

/**
 * 从内容树整理出两张总表、场／组总览、镜头汇总三块、04／05 完整执行文件与 03 索引。
 *
 * 幂等：同样输入重复整理，文件内容逐字不变。
 */
export async function assembleContentTree(projectRoot: string, options: AssembleOptions = {}): Promise<AssembleResult> {
  const issues: VerificationIssue[] = [];
  const changes: AssembleChange[] = [];
  const backupDir = options.backupDir ?? path.join(".tmp", "content-backup");
  const force = options.force === true;
  const dryRun = options.dryRun === true;

  const resolution = await resolveContentMode(projectRoot);
  if (resolution.mode !== "content-tree") {
    return { ok: false, mode: resolution.mode, changes, issues: resolution.issues };
  }
  if (!resolution.contentRootExists) {
    return { ok: false, mode: resolution.mode, changes, issues: resolution.issues };
  }

  const tree = await buildContentTree(projectRoot);
  const index = await loadMaterialIndex(projectRoot);
  const { config } = await readProjectConfig(projectRoot);
  const platforms = platformDefaults(config);

  const plans: WritePlan[] = [];
  const blockPlans: Array<{ relPath: string; skeleton: string; specs: BlockSpec[] }> = [];

  blockPlans.push({
    relPath: tree.shotOverviewRelPath,
    skeleton: shotOverviewSkeleton(),
    specs: [{ name: BLOCK.shotOverview, body: renderShotOverviewBody(tree, index) }]
  });
  blockPlans.push({
    relPath: tree.storyboardOverviewRelPath,
    skeleton: storyboardOverviewSkeleton(),
    specs: [{ name: BLOCK.storyboardOverview, body: renderStoryboardOverviewBody(tree, index) }]
  });
  for (const scene of tree.scenes) {
    blockPlans.push({
      relPath: scene.overviewRelPath,
      skeleton: sceneOverviewSkeleton(scene.sceneId),
      specs: [{ name: BLOCK.sceneGroups, body: renderSceneGroupTable(scene, tree) }]
    });
    for (const group of scene.groups) {
      blockPlans.push({
        relPath: group.overviewRelPath,
        skeleton: groupOverviewSkeleton(group.groupId),
        specs: [{ name: BLOCK.groupShots, body: renderGroupShotTable(group, tree) }]
      });
    }
  }
  for (const shot of tree.shots) {
    blockPlans.push({
      relPath: shot.relPath,
      skeleton: "",
      specs: [
        { name: BLOCK.shotSegmentDigest, body: renderShotSegmentDigest(shot) },
        { name: BLOCK.shotImagePrompts, body: renderShotImagePrompts(shot) },
        { name: BLOCK.shotSegments, body: renderShotSegments(shot) }
      ]
    });
  }

  for (const plan of blockPlans) {
    const absPath = path.join(projectRoot, plan.relPath);
    const existing = await readIfExists(absPath);
    if (existing === null) {
      if (plan.skeleton.length === 0) {
        issues.push({
          code: "content-tree-incomplete",
          message: "「" + plan.relPath + "」不存在，无法刷新它的自动区块。",
          path: plan.relPath
        });
        continue;
      }
      let content = plan.skeleton;
      for (const spec of plan.specs) {
        const replaced = replaceContentBlockBody(content, spec.name, hashedBlockBody(spec.body));
        if (replaced !== null) content = replaced;
      }
      plans.push({ relPath: plan.relPath, content: ensureTrailingNewline(content), generated: false });
      changes.push({ relPath: plan.relPath, kind: "create", blocks: plan.specs.map((spec) => spec.name) });
      continue;
    }

    const merged = mergeAutoBlocks(existing, plan.specs, force, plan.relPath, issues);
    if (merged.changed) {
      plans.push({ relPath: plan.relPath, content: ensureTrailingNewline(merged.content), generated: false });
      changes.push({
        relPath: plan.relPath,
        kind: "update",
        blocks: plan.specs.map((spec) => spec.name).filter((name) => !merged.skippedBlocks.includes(name))
      });
    } else {
      changes.push({ relPath: plan.relPath, kind: "unchanged", blocks: [] });
    }
  }

  for (const shot of tree.shots) {
    for (const storyboard of shot.storyboards) {
      for (const keyframe of storyboard.document.keyframes) {
        const relPath = step4FileRelPath(shot, keyframe.id);
        const content = renderStep4File(shot, storyboard.relPath, keyframe.id, platforms.image, index);
        if (content) plans.push({ relPath, content: stampGeneratedFile(content), generated: true });
      }
    }
    const step5RelPath = step5FileRelPath(shot);
    plans.push({ relPath: step5RelPath, content: stampGeneratedFile(renderStep5File(shot, platforms.video, index)), generated: true });
  }
  plans.push({ relPath: contentIndexRelPath(), content: stampGeneratedFile(renderContentIndex(tree)), generated: true });

  for (const plan of plans) {
    if (plan.generated) {
      const absPath = path.join(projectRoot, plan.relPath);
      const existing = await readIfExists(absPath);
      if (existing === null) {
        changes.push({ relPath: plan.relPath, kind: "create", blocks: ["（整份文件）"] });
        continue;
      }
      const recorded = readGeneratedFileHash(existing);
      const current = stripGeneratedFileHash(existing);
      const next = stripGeneratedFileHash(plan.content);
      if (recorded === null) {
        if (current === next) {
          changes.push({ relPath: plan.relPath, kind: "unchanged", blocks: [] });
          continue;
        }
        if (!force) {
          issues.push({
            code: "content-summary-manual-drift",
            message:
              "「" + plan.relPath + "」没有生成标记，像是人工写的；刷新默认不覆盖。要覆盖请显式加 --force（覆盖前会备份到 .tmp/）。",
            path: plan.relPath
          });
          changes.push({ relPath: plan.relPath, kind: "unchanged", blocks: [] });
          continue;
        }
        changes.push({ relPath: plan.relPath, kind: "update", blocks: ["（整份文件）"] });
        continue;
      }
      if (recorded !== sha256(stripTrailingNewlines(current))) {
        if (!force) {
          issues.push({
            code: "content-summary-manual-drift",
            message:
              "「" + plan.relPath + "」生成后被手工改过；刷新默认不覆盖。要覆盖请显式加 --force（覆盖前会备份到 .tmp/）。",
            path: plan.relPath
          });
          changes.push({ relPath: plan.relPath, kind: "unchanged", blocks: [] });
          continue;
        }
        changes.push({ relPath: plan.relPath, kind: "update", blocks: ["（整份文件）"] });
        continue;
      }
      if (current === next) {
        changes.push({ relPath: plan.relPath, kind: "unchanged", blocks: [] });
        continue;
      }
      changes.push({ relPath: plan.relPath, kind: "update", blocks: ["（整份文件）"] });
      continue;
    }
    changes.push({ relPath: plan.relPath, kind: "create", blocks: [] });
  }

  if (!dryRun) {
    const changedPlans = plans.filter((plan) => {
      const change = changes.find((entry) => entry.relPath === plan.relPath);
      return change !== undefined && change.kind !== "unchanged";
    });
    for (const plan of changedPlans) {
      if (!options.skipBackup) {
        await backupFile(projectRoot, plan.relPath, backupDir);
      }
      const absPath = path.join(projectRoot, plan.relPath);
      await fs.ensureDir(path.dirname(absPath));
      await fs.writeFile(absPath, plan.content, "utf8");
    }
  }

  // 汇总 changes 里重复登记的项合并成一条（同一文件只保留最具体的一次）。
  const merged = new Map<string, AssembleChange>();
  for (const change of changes) {
    const existing = merged.get(change.relPath);
    if (!existing || (existing.kind === "unchanged" && change.kind !== "unchanged")) {
      merged.set(change.relPath, change);
    }
  }

  return {
    ok: issues.every((issue) => issue.code !== "content-tree-incomplete"),
    mode: resolution.mode,
    changes: [...merged.values()].sort((left, right) => left.relPath.localeCompare(right.relPath)),
    issues
  };
}

/* ------------------------------ 一致性检查 ------------------------------ */

export interface ConsistencyCheckResult {
  issues: VerificationIssue[];
}

function extractCopyablePrompt(content: string): string | null {
  const section = /^##\s*可复制提示词\s*$([\s\S]*?)(?=^##\s|$(?![\s\S]))/mu.exec(content);
  if (!section) return null;
  const fenced = new RegExp("\u0060{3,}[^\\n]*\\n([\\s\\S]*?)\u0060{3,}", "u").exec(section[1]);
  return fenced ? stripTrailingNewlines(fenced[1]) : null;
}

/**
 * 内容树、汇总与执行文件三者的一致性检查。
 *
 * 只报差异，不写盘；用于 verify 与整理后的自检。
 */
export async function checkContentConsistency(projectRoot: string): Promise<ConsistencyCheckResult> {
  const issues: VerificationIssue[] = [];
  const resolution = await resolveContentMode(projectRoot);
  if (resolution.mode !== "content-tree") return { issues: resolution.issues };
  issues.push(...resolution.issues);
  if (!resolution.contentRootExists) return { issues };

  const tree = await buildContentTree(projectRoot);
  const index = await loadMaterialIndex(projectRoot);

  const overviewSpecs: Array<{ relPath: string; name: string; body: string }> = [
    { relPath: tree.shotOverviewRelPath, name: BLOCK.shotOverview, body: renderShotOverviewBody(tree, index) },
    { relPath: tree.storyboardOverviewRelPath, name: BLOCK.storyboardOverview, body: renderStoryboardOverviewBody(tree, index) }
  ];
  for (const scene of tree.scenes) {
    overviewSpecs.push({ relPath: scene.overviewRelPath, name: BLOCK.sceneGroups, body: renderSceneGroupTable(scene, tree) });
    for (const group of scene.groups) {
      overviewSpecs.push({ relPath: group.overviewRelPath, name: BLOCK.groupShots, body: renderGroupShotTable(group, tree) });
    }
  }
  for (const shot of tree.shots) {
    overviewSpecs.push({ relPath: shot.relPath, name: BLOCK.shotSegmentDigest, body: renderShotSegmentDigest(shot) });
    overviewSpecs.push({ relPath: shot.relPath, name: BLOCK.shotImagePrompts, body: renderShotImagePrompts(shot) });
    overviewSpecs.push({ relPath: shot.relPath, name: BLOCK.shotSegments, body: renderShotSegments(shot) });
  }

  for (const spec of overviewSpecs) {
    const absPath = path.join(projectRoot, spec.relPath);
    if (!(await fs.pathExists(absPath))) continue;
    const content = await fs.readFile(absPath, "utf8");
    const body = getContentBlockBody(content, spec.name);
    if (body === null) continue;
    const expected = stripTrailingNewlines(spec.body);
    const actual = stripTrailingNewlines(stripBlockHash(body));
    if (actual !== expected) {
      issues.push({
        code: "content-summary-stale",
        message:
          "「" + spec.relPath + "」的自动区块「" + spec.name + "」与内容树不一致；正文改过之后要重新整理（content assemble）。",
        path: spec.relPath
      });
    }
  }

  for (const shot of tree.shots) {
    const step5RelPath = step5FileRelPath(shot);
    const absPath = path.join(projectRoot, step5RelPath);
    if (!(await fs.pathExists(absPath))) {
      issues.push({
        code: "content-execution-stale",
        message: "镜头 " + shotLabel(shot) + " 缺少 05 执行文件「" + step5RelPath + "」；请重新整理。",
        path: step5RelPath
      });
      continue;
    }
    const content = await fs.readFile(absPath, "utf8");
    const copyable = extractCopyablePrompt(content);
    const expected = shot.assembly.text;
    if (copyable === null) {
      issues.push({
        code: "content-summary-execution-mismatch",
        message: "「" + step5RelPath + "」没有「## 可复制提示词」区块；05 必须保持 Step 5 文件合同五区块。",
        path: step5RelPath
      });
      continue;
    }
    if (expected !== null && copyable !== expected) {
      issues.push({
        code: "content-summary-execution-mismatch",
        message:
          "「" + step5RelPath + "」的可复制提示词与镜头汇总的整镜正文不是逐字一致；请重新整理，不要手改执行文件。",
        path: step5RelPath
      });
    }
  }

  const indexRelPath = contentIndexRelPath();
  if (!(await fs.pathExists(path.join(projectRoot, indexRelPath)))) {
    issues.push({
      code: "content-index-missing",
      message: "缺少「" + indexRelPath + "」；03_分镜脚本 需要一份指向内容树的索引。",
      path: indexRelPath
    });
  }

  return { issues };
}

/** 整理结果的可读摘要（命令行输出用）。 */
export function renderAssembleSummary(result: AssembleResult): string {
  const lines: string[] = [];
  const created = result.changes.filter((change) => change.kind === "create");
  const updated = result.changes.filter((change) => change.kind === "update");
  const unchanged = result.changes.filter((change) => change.kind === "unchanged");
  lines.push("内容树整理结果");
  lines.push("  新增 " + String(created.length) + " 个文件，更新 " + String(updated.length) + " 个文件，未变 " + String(unchanged.length) + " 个文件。");
  for (const change of created) lines.push("  + " + change.relPath);
  for (const change of updated) lines.push("  * " + change.relPath);
  if (result.issues.length > 0) {
    lines.push("  需要注意 " + String(result.issues.length) + " 条：");
    for (const issue of result.issues) {
      lines.push("  ! [" + issue.code + "] " + issue.message);
    }
  }
  return lines.join("\n");
}
