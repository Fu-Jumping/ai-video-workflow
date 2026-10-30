import { describe, expect, test } from "vitest";

import {
  deriveCandidateHumanState,
  humanReviewStateLabels,
  primaryMediaCandidate,
  summarizeHumanReviewStates,
  type HumanReviewState
} from "../src/lib/media-human-state.js";
import type { MediaCandidateRecord, MediaIdentity, MediaRecord } from "../src/lib/media-records.js";
import { mediaCandidateKey, recordHumanReviewState } from "../src/lib/obsidian/media-viewer.js";

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

const identity: MediaIdentity = { category: "character", objectId: "角色-001", purpose: "造型-01" };

describe("人工审核四态", () => {
  test("标签逐字固定为四句白话", () => {
    expect(humanReviewStateLabels).toEqual({
      "not-ready": "还没准备好",
      waiting: "等你看",
      accepted: "你已接受",
      "needs-recheck": "改过了需要重看"
    });
  });

  test("未生成、未下载、下载失败、未选用的未审候选都是还没准备好", () => {
    expect(deriveCandidateHumanState({ candidate: candidate() })).toBe("not-ready");
    expect(
      deriveCandidateHumanState({ candidate: candidate({ selected: true, platformStatus: "not-generated" }) })
    ).toBe("not-ready");
    expect(
      deriveCandidateHumanState({
        candidate: candidate({ selected: true, downloadStatus: "not-downloaded" }),
        currentSha256: "hash"
      })
    ).toBe("not-ready");
    expect(
      deriveCandidateHumanState({
        candidate: candidate({ selected: true, platformStatus: "failed", downloadStatus: "failed" }),
        currentSha256: "hash"
      })
    ).toBe("not-ready");
    expect(
      deriveCandidateHumanState({
        candidate: candidate({ selected: true, downloadStatus: "unknown", platformStatus: "unknown" }),
        currentSha256: "hash"
      })
    ).toBe("not-ready");
  });

  test("已审不可用永远是还没准备好", () => {
    expect(
      deriveCandidateHumanState({
        candidate: candidate({ reviewStatus: "rejected", selected: true, sha256: "hash" }),
        currentSha256: "hash"
      })
    ).toBe("not-ready");
  });

  test("已选用、已下载、文件存在的未审候选是等你看", () => {
    expect(
      deriveCandidateHumanState({ candidate: candidate({ selected: true }), currentSha256: "current-hash" })
    ).toBe("waiting");
  });

  test("已审可用且文件仍在是已接受；没有记录哈希时按当前文件视为已接受", () => {
    expect(
      deriveCandidateHumanState({
        candidate: candidate({ reviewStatus: "accepted", sha256: "same-hash" }),
        currentSha256: "same-hash"
      })
    ).toBe("accepted");
    expect(
      deriveCandidateHumanState({ candidate: candidate({ reviewStatus: "accepted" }), currentSha256: "any-hash" })
    ).toBe("accepted");
  });

  test("已审可用但文件被替换成别的内容是改过了需要重看", () => {
    expect(
      deriveCandidateHumanState({
        candidate: candidate({ reviewStatus: "accepted", sha256: "old-hash" }),
        currentSha256: "new-hash"
      })
    ).toBe("needs-recheck");
  });

  test("已审可用的文件不存在时退回还没准备好，而不是你已接受", () => {
    expect(
      deriveCandidateHumanState({ candidate: candidate({ reviewStatus: "accepted", sha256: "old-hash" }) })
    ).toBe("not-ready");
  });
});

describe("人工审核四态汇总", () => {
  test("空数组按还没准备好处理", () => {
    expect(summarizeHumanReviewStates([])).toBe("not-ready");
  });

  test("优先级：改过了需要重看 > 等你看 > 还没准备好 > 你已接受", () => {
    const pairs: Array<[HumanReviewState[], HumanReviewState]> = [
      [["accepted", "not-ready"], "not-ready"],
      [["accepted", "waiting"], "waiting"],
      [["waiting", "needs-recheck"], "needs-recheck"],
      [["not-ready", "accepted"], "not-ready"],
      [["accepted", "accepted"], "accepted"],
      [["needs-recheck", "accepted", "waiting", "not-ready"], "needs-recheck"]
    ];
    for (const [states, expected] of pairs) {
      expect(summarizeHumanReviewStates(states)).toBe(expected);
    }
  });

  test("旧的历史候选不参与汇总，只看主候选", () => {
    const current = candidate({ version: 1, fileName: "角色-001_造型-01_v001_c01.png", reviewStatus: "accepted", selected: true });
    const legacy = candidate({ version: 2, fileName: "角色-001_造型-01_v002_c01.png", selected: false });
    const record: MediaRecord = {
      identity,
      displayName: "女主",
      source: "generated",
      currentSelection: current.fileName,
      candidates: [current, legacy],
      createdAt: "2026-10-24T00:00:00.000Z",
      updatedAt: "2026-10-24T00:00:00.000Z"
    };
    expect(primaryMediaCandidate(record)).toBe(current);

    const humanStates = new Map<string, HumanReviewState>([
      [mediaCandidateKey(identity, current.fileName), "accepted"],
      [mediaCandidateKey(identity, legacy.fileName), "waiting"]
    ]);
    // 主候选已接受，镜头汇总就应是已接受；旧候选的“等你看”不能把镜头拖回等待。
    expect(recordHumanReviewState(record, humanStates)).toBe("accepted");
    // 反证：如果错误地把全部候选都喂进汇总，会得到等你看。
    expect(summarizeHumanReviewStates([...humanStates.values()])).toBe("waiting");
  });

  test("没有当前选用时退回标记为选用的候选；都没有则记一条还没准备好", () => {
    const selected = candidate({ fileName: "b.png", selected: true });
    const record: MediaRecord = {
      identity,
      displayName: "女主",
      source: "generated",
      candidates: [candidate({ fileName: "a.png" }), selected],
      createdAt: "2026-10-24T00:00:00.000Z",
      updatedAt: "2026-10-24T00:00:00.000Z"
    };
    expect(primaryMediaCandidate(record)).toBe(selected);

    const empty: MediaRecord = {
      identity,
      displayName: "女主",
      source: "generated",
      candidates: [candidate()],
      createdAt: "2026-10-24T00:00:00.000Z",
      updatedAt: "2026-10-24T00:00:00.000Z"
    };
    expect(primaryMediaCandidate(empty)).toBeUndefined();
    expect(recordHumanReviewState(empty, new Map())).toBe("not-ready");
    expect(summarizeHumanReviewStates(["not-ready"])).toBe("not-ready");
  });
});
