import fs from "fs-extra";
import path from "node:path";
import type { LibTvFetchLike } from "./types.js";

/**
 * 下载结果：把"没下载"和"下载失败"分开。
 *
 * - saved：真的落盘了；
 * - no-url：节点上没有媒体地址，属于"还没生成完/平台没给产物"，不算失败；
 * - failed：有地址但取不到或写不进本地，记 local-save-failed。
 */
export type LibTvDownloadResult =
  | { status: "saved"; path: string }
  | { status: "no-url" }
  | { status: "failed"; error: string };

export function nodeOutputUrls(node: { data?: { url?: unknown } }): string[] {
  const raw = node.data?.url;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export function firstNodeOutputUrl(node: { data?: { url?: unknown } }): string | undefined {
  return nodeOutputUrls(node)[0];
}

export interface SaveNodeOutputOptions {
  outputDir: string;
  fileNameBase: string;
  /** 默认用全局 fetch；测试注入假 fetch，避免真实网络访问。 */
  fetchImpl?: LibTvFetchLike;
}

/**
 * 把节点产物下载到本地。永远不抛错——调用方按返回的 status 分支处理，
 * 因此下载失败绝不会冒泡成"生成失败"。
 */
export async function saveNodeOutput(
  node: { data?: { url?: unknown } },
  options: SaveNodeOutputOptions
): Promise<LibTvDownloadResult> {
  const urls = nodeOutputUrls(node);
  if (urls.length === 0) return { status: "no-url" };
  const url = urls[0]!;
  try {
    await fs.ensureDir(options.outputDir);
    const fetcher = options.fetchImpl ?? ((target: string) => fetch(target));
    const response = await fetcher(url);
    if (!response.ok) {
      const detail = [response.status, response.statusText].filter((item) => item !== undefined && item !== "").join(" ");
      return { status: "failed", error: `下载失败 ${url}${detail ? ` ${detail}` : ""}` };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const ext = path.extname(new URL(url).pathname) || ".bin";
    const target = path.join(options.outputDir, `${options.fileNameBase}${ext}`);
    await fs.writeFile(target, buffer);
    return { status: "saved", path: target };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : String(error) };
  }
}

/** 从远端 URL 直接保存一份（补下载用）。语义与 saveNodeOutput 一致，只是没有节点包装。 */
export async function saveUrlOutput(
  url: string,
  options: { outputDir: string; fileNameBase: string; fetchImpl?: LibTvFetchLike }
): Promise<LibTvDownloadResult> {
  return saveNodeOutput({ data: { url: [url] } }, options);
}
