import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { mediaDurationSeconds, mp4DurationSeconds, mp4VideoTrackSize, wavDurationSeconds } from "../src/lib/media-duration.js";

const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await fs.rmSync(root, { recursive: true, force: true });
  }
});

function makeTempFile(name: string, bytes: Buffer): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "avw-media-duration-"));
  tempRoots.push(root);
  const filePath = path.join(root, name);
  fs.writeFileSync(filePath, bytes);
  return filePath;
}

function mp4WithMvhd(timescale: number, duration: number, version: 0 | 1 = 0): Buffer {
  const mvhdBody =
    version === 1
      ? Buffer.concat([
          Buffer.from([0x01, 0, 0, 0]),
          Buffer.alloc(16),
          (() => {
            const b = Buffer.alloc(4);
            b.writeUInt32BE(timescale);
            return b;
          })(),
          (() => {
            const b = Buffer.alloc(8);
            b.writeBigUInt64BE(BigInt(duration));
            return b;
          })()
        ])
      : Buffer.concat([
          Buffer.from([0x00, 0, 0, 0]),
          Buffer.alloc(8),
          (() => {
            const b = Buffer.alloc(4);
            b.writeUInt32BE(timescale);
            return b;
          })(),
          (() => {
            const b = Buffer.alloc(4);
            b.writeUInt32BE(duration);
            return b;
          })()
        ]);
  const mvhd = Buffer.concat([(() => { const b = Buffer.alloc(4); b.writeUInt32BE(mvhdBody.length + 8); return b; })(), Buffer.from("mvhd"), mvhdBody]);
  const moovHeader = Buffer.alloc(8);
  moovHeader.writeUInt32BE(mvhd.length + 8);
  moovHeader.write("moov", 4);
  const moov = Buffer.concat([moovHeader, mvhd]);
  const ftypHeader = Buffer.alloc(8);
  ftypHeader.writeUInt32BE(16);
  ftypHeader.write("ftyp", 4);
  const ftypBody = Buffer.from("isomiso2");
  return Buffer.concat([ftypHeader, ftypBody, moov]);
}

describe("mediaDurationSeconds", () => {
  test("mp4：mvhd version 0 按 timescale 换算秒", () => {
    const file = makeTempFile("clip.mp4", mp4WithMvhd(1000, 4500));
    expect(mp4DurationSeconds(file)).toBeCloseTo(4.5, 6);
  });

  test("mp4：mvhd version 1（64 位时长）也能解析", () => {
    const file = makeTempFile("clip-v1.mp4", mp4WithMvhd(25, 100, 1));
    expect(mp4DurationSeconds(file)).toBeCloseTo(4, 6);
  });

  test("wav：data 字节除以 fmt 字节率得秒", () => {
    const sampleRate = 8000;
    const seconds = 2;
    const fmt = Buffer.alloc(16);
    fmt.writeUInt16LE(1, 0); // PCM
    fmt.writeUInt16LE(1, 2); // 单声道
    fmt.writeUInt32LE(sampleRate, 4);
    fmt.writeUInt32LE(sampleRate, 8); // byteRate = rate * 1 * 8bit
    fmt.writeUInt16LE(1, 12); // block align
    fmt.writeUInt16LE(8, 14); // bits per sample
    const data = Buffer.alloc(sampleRate * seconds);
    const fmtChunk = Buffer.concat([Buffer.from("fmt "), (() => { const b = Buffer.alloc(4); b.writeUInt32LE(fmt.length); return b; })(), fmt]);
    const dataChunk = Buffer.concat([Buffer.from("data"), (() => { const b = Buffer.alloc(4); b.writeUInt32LE(data.length); return b; })(), data]);
    const riff = Buffer.concat([Buffer.from("RIFF"), (() => { const b = Buffer.alloc(4); b.writeUInt32LE(4 + fmtChunk.length + dataChunk.length); return b; })(), Buffer.from("WAVE")]);
    const file = makeTempFile("clip.wav", Buffer.concat([riff, fmtChunk, dataChunk]));
    expect(wavDurationSeconds(file)).toBeCloseTo(2, 6);
    expect(mediaDurationSeconds(file)).toBeCloseTo(2, 6);
  });

  test("损坏或非容器文件返回 undefined 而不抛错", () => {
    const garbage = makeTempFile("broken.mp4", Buffer.from("not a movie"));
    expect(mediaDurationSeconds(garbage)).toBeUndefined();
    const text = makeTempFile("note.txt", Buffer.from("hello"));
    expect(mediaDurationSeconds(text)).toBeUndefined();
    expect(mediaDurationSeconds(path.join(os.tmpdir(), "avw-media-duration-missing.mp4"))).toBeUndefined();
  });
});

describe("mp4VideoTrackSize（D3 草稿素材宽高）", () => {
  function box(type: string, body: Buffer): Buffer {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(body.length + 8);
    header.write(type, 4);
    return Buffer.concat([header, body]);
  }

  /** version0 tkhd：width/height 在 76/80（16.16 定点）。 */
  function tkhdBody(width: number, height: number, version: 0 | 1 = 0): Buffer {
    const fixed = (value: number) => {
      const b = Buffer.alloc(4);
      b.writeUInt32BE(Math.round(value * 65536));
      return b;
    };
    const head = Buffer.alloc(version === 1 ? 36 : 24);
    head[0] = version;
    const tail = Buffer.concat([Buffer.alloc(8), Buffer.alloc(2), Buffer.alloc(2), Buffer.alloc(2), Buffer.alloc(2), Buffer.alloc(36)]);
    return Buffer.concat([head, tail, fixed(width), fixed(height)]);
  }

  function mp4WithTracks(width: number | null, height: number | null): Buffer {
    const mvhdBody = Buffer.concat([Buffer.from([0x00, 0, 0, 0]), Buffer.alloc(8), (() => { const b = Buffer.alloc(4); b.writeUInt32BE(1000); return b; })(), (() => { const b = Buffer.alloc(4); b.writeUInt32BE(3000); return b; })()]);
    const audioTkhd = tkhdBody(0, 0);
    const parts = [box("mvhd", mvhdBody), box("trak", box("tkhd", audioTkhd))];
    if (width !== null && height !== null) {
      parts.push(box("trak", box("tkhd", tkhdBody(width, height))));
    }
    const moov = box("moov", Buffer.concat(parts));
    const ftyp = box("ftyp", Buffer.from("isomiso2"));
    return Buffer.concat([ftyp, moov]);
  }

  test("取第一个宽高非零轨道（跳过音频轨）", () => {
    const file = makeTempFile("sized.mp4", mp4WithTracks(640, 360));
    expect(mp4VideoTrackSize(file)).toEqual({ width: 640, height: 360 });
  });

  test("只有零宽高轨道（无视频轨）返回 undefined", () => {
    const file = makeTempFile("audio-only.mp4", mp4WithTracks(null, null));
    expect(mp4VideoTrackSize(file)).toBeUndefined();
  });

  test("没有 moov/trak 的最小 mp4 返回 undefined", () => {
    const file = makeTempFile("bare.mp4", mp4WithMvhd(1000, 2000));
    expect(mp4VideoTrackSize(file)).toBeUndefined();
  });
});
