import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { applyPlan } from "../src/lib/libtv/apply.js";
import { MockLibTvBackend } from "../src/lib/libtv/mock-backend.js";
import { readState, writeBinding } from "../src/lib/libtv/project-binding.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

describe("libtv apply with mock backend", () => {
  test("creates keyframes, requires approval before videos, and approves", async () => {
    const repoRoot = path.resolve(__dirname, "..", "..", "..");
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "avw-libtv-apply-"));
    tempRoots.push(projectRoot);
    await fs.copy(path.join(repoRoot, "examples", "官方示例-云上早市"), projectRoot);
    await writeBinding(projectRoot, { projectUuid: "mock-project" });

    const backend = new MockLibTvBackend();
    const keyframes = await applyPlan(projectRoot, backend, { only: ["keyframes"] });
    expect(keyframes.state.keyframes).toHaveLength(3);
    for (const item of keyframes.state.keyframes) {
      expect(item.status).toBe("pending-approval");
    }

    const videosBefore = await applyPlan(projectRoot, backend, { only: ["videos"] });
    expect(videosBefore.state.videos).toHaveLength(0);
    expect(videosBefore.actions.some((action) => action.includes("关键帧未通过人工待审"))).toBe(true);

    const state = await readState(projectRoot);
    expect(state).not.toBeNull();
    for (const item of state!.keyframes) {
      item.status = "approved";
    }
    await fs.writeJson(path.join(projectRoot, ".libtv", "state.json"), state, { spaces: 2 });

    const videosAfter = await applyPlan(projectRoot, backend, { only: ["videos"] });
    expect(videosAfter.state.videos).toHaveLength(3);
  });
});
