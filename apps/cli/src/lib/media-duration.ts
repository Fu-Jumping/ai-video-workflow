import fs from "node:fs";

/**
 * 媒体时长探测（纯 Node，无外部依赖）。
 *
 * 粗剪顺序表的「成片起止」需要每段视频的真实时长；素材记录里没有时长字段，
 * 这里直接读容器头：MP4（含 MOV/M4V）遍历 box 找 moov/mvhd，WAV 遍历 chunk 用
 * fmt 的字节率与 data 大小推算。只读文件头附近字节，不整读大文件。
 * 解析不了（缺块、损坏、非容器格式）一律返回 undefined，由调用方显示「未知」。
 */

const BOX_HEADER_SIZE = 8;
const LARGE_SIZE_SUFFIX = 1;

interface BoxHeader {
  type: string;
  /** box 总大小（含头）；0 表示直到文件尾（仅顶层合法）。 */
  totalSize: number;
  bodyStart: number;
  bodySize: number;
}

function readBoxHeader(fd: number, offset: number, fileEnd: number): BoxHeader | null {
  if (offset + BOX_HEADER_SIZE > fileEnd) return null;
  const header = Buffer.alloc(BOX_HEADER_SIZE);
  if (fs.readSync(fd, header, 0, BOX_HEADER_SIZE, offset) < BOX_HEADER_SIZE) return null;
  let totalSize = header.readUInt32BE(0);
  const type = header.toString("latin1", 4, 8);
  let bodyStart = offset + BOX_HEADER_SIZE;
  if (totalSize === LARGE_SIZE_SUFFIX) {
    const large = Buffer.alloc(8);
    if (fs.readSync(fd, large, 0, 8, bodyStart) < 8) return null;
    const high = BigInt(large.readUInt32BE(0));
    const low = BigInt(large.readUInt32BE(4));
    totalSize = Number((high << 32n) | low);
    bodyStart += 8;
  } else if (totalSize === 0) {
    totalSize = fileEnd - offset;
  }
  if (totalSize < bodyStart - offset) return null;
  return { type, totalSize, bodyStart, bodySize: offset + totalSize - bodyStart };
}

function findBoxBody(fd: number, containerStart: number, containerEnd: number, wantedType: string, maxBytes = 64): Buffer | null {
  let offset = containerStart;
  while (offset < containerEnd) {
    const header = readBoxHeader(fd, offset, containerEnd);
    if (!header || header.totalSize <= 0) return null;
    if (header.type === wantedType) {
      const body = Buffer.alloc(Math.min(header.bodySize, maxBytes));
      const read = fs.readSync(fd, body, 0, body.length, header.bodyStart);
      return body.subarray(0, read);
    }
    offset += header.totalSize;
  }
  return null;
}

/** mp4/mov/m4v：顶层找 moov，其内找 mvhd；返回 duration/timescale 秒。 */
export function mp4DurationSeconds(filePath: string): number | undefined {
  let fd: number;
  try {
    fd = fs.openSync(filePath, "r");
  } catch {
    return undefined;
  }
  try {
    const fileEnd = fs.fstatSync(fd).size;
    let offset = 0;
    while (offset < fileEnd) {
      const header = readBoxHeader(fd, offset, fileEnd);
      if (!header || header.totalSize <= 0) return undefined;
      if (header.type === "moov") {
        const mvhd = findBoxBody(fd, header.bodyStart, header.bodyStart + header.bodySize, "mvhd");
        if (!mvhd || mvhd.length < 20) return undefined;
        const version = mvhd[0]!;
        if (version === 1) {
          if (mvhd.length < 32) return undefined;
          const timescale = mvhd.readUInt32BE(20);
          const duration = Number(mvhd.readBigUInt64BE(24));
          return timescale > 0 ? duration / timescale : undefined;
        }
        const timescale = mvhd.readUInt32BE(12);
        const duration = mvhd.readUInt32BE(16);
        return timescale > 0 ? duration / timescale : undefined;
      }
      offset += header.totalSize;
    }
    return undefined;
  } catch {
    return undefined;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * mp4/mov/m4v：moov 下各 trak 的 tkhd 里读轨道宽高（16.16 定点）。
 * 取第一个宽高非零的轨道（视频轨；音频轨宽高为零）。剪映草稿的视频素材
 * 记录 width/height 元数据，生成草稿时如实填写、探测不到就不写该字段。
 */
export function mp4VideoTrackSize(filePath: string): { width: number; height: number } | undefined {
  let fd: number;
  try {
    fd = fs.openSync(filePath, "r");
  } catch {
    return undefined;
  }
  try {
    const fileEnd = fs.fstatSync(fd).size;
    let offset = 0;
    while (offset < fileEnd) {
      const header = readBoxHeader(fd, offset, fileEnd);
      if (!header || header.totalSize <= 0) return undefined;
      if (header.type === "moov") {
        const moovEnd = header.bodyStart + header.bodySize;
        let trakOffset = header.bodyStart;
        while (trakOffset < moovEnd) {
          const trak = readBoxHeader(fd, trakOffset, moovEnd);
          if (!trak || trak.totalSize <= 0) return undefined;
          if (trak.type === "trak") {
            // tkhd：version0 时 width/height 在 76/80（16.16 定点），version1 在 88/92。
            const tkhd = findBoxBody(fd, trak.bodyStart, trak.bodyStart + trak.bodySize, "tkhd", 96);
            if (tkhd && tkhd.length >= 84) {
              const version = tkhd[0]!;
              const widthOffset = version === 1 ? 88 : 76;
              if (tkhd.length >= widthOffset + 8) {
                const width = tkhd.readUInt32BE(widthOffset) / 65536;
                const height = tkhd.readUInt32BE(widthOffset + 4) / 65536;
                if (width > 0 && height > 0) return { width, height };
              }
            }
          }
          trakOffset += trak.totalSize;
        }
        return undefined;
      }
      offset += header.totalSize;
    }
    return undefined;
  } catch {
    return undefined;
  } finally {
    fs.closeSync(fd);
  }
}

/** WAV：fmt 块取平均字节率，data 块取字节数，相除得秒。 */
export function wavDurationSeconds(filePath: string): number | undefined {
  let fd: number;
  try {
    fd = fs.openSync(filePath, "r");
  } catch {
    return undefined;
  }
  try {
    const riffHeader = Buffer.alloc(12);
    if (fs.readSync(fd, riffHeader, 0, 12, 0) < 12) return undefined;
    if (riffHeader.toString("latin1", 0, 4) !== "RIFF" || riffHeader.toString("latin1", 8, 12) !== "WAVE") {
      return undefined;
    }
    const fileEnd = fs.fstatSync(fd).size;
    let offset = 12;
    let byteRate: number | undefined;
    let dataSize: number | undefined;
    while (offset + 8 <= fileEnd) {
      const chunkHeader = Buffer.alloc(8);
      if (fs.readSync(fd, chunkHeader, 0, 8, offset) < 8) break;
      const chunkId = chunkHeader.toString("latin1", 0, 4);
      const chunkSize = chunkHeader.readUInt32LE(4);
      if (chunkId === "fmt ") {
        const fmt = Buffer.alloc(Math.min(chunkSize, 20));
        const read = fs.readSync(fd, fmt, 0, fmt.length, offset + 8);
        if (read >= 16) byteRate = fmt.readUInt32LE(8);
      } else if (chunkId === "data") {
        dataSize = chunkSize;
        break;
      }
      offset += 8 + chunkSize + (chunkSize % 2);
    }
    if (!byteRate || !dataSize || byteRate <= 0) return undefined;
    return dataSize / byteRate;
  } catch {
    return undefined;
  } finally {
    fs.closeSync(fd);
  }
}

/** 按扩展名分发；不认识的容器返回 undefined（调用方显示「未知」）。 */
export function mediaDurationSeconds(filePath: string): number | undefined {
  if (/\.(mp4|mov|m4v)$/iu.test(filePath)) return mp4DurationSeconds(filePath);
  if (/\.wav$/iu.test(filePath)) return wavDurationSeconds(filePath);
  return undefined;
}
