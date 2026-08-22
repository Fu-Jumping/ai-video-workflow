import { describe, expect, test } from "vitest";
import { HttpLibTvBackend } from "../src/lib/libtv/http-backend.js";
import type { LibTvApiClient } from "../src/lib/libtv/api.js";

describe("libtv deleteNode connection cleanup", () => {
  test("deletes connections first, then the node, in separate batches", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const fakeClient = {
      async getProjectDetail(projectUuid: string) {
        return {
          projectUuid,
          nodes: [{ id: "n1", name: "Node", type: "video", data: {} }],
          edges: [{ id: "e1", source: "a", target: "n1", sourceHandle: "source", targetHandle: "target" }]
        };
      },
      async batchNodes(body: Record<string, unknown>) {
        calls.push(body);
        return {};
      }
    } as unknown as LibTvApiClient;

    const backend = new HttpLibTvBackend(fakeClient);
    await backend.deleteNode("p1", "n1");

    expect(calls).toHaveLength(2);
    expect(calls[0]?.nodes).toEqual({});
    expect((calls[0]?.connections as { delete?: unknown[] })?.delete).toHaveLength(1);
    expect((calls[1]?.nodes as { delete?: unknown[] })?.delete).toHaveLength(1);
    expect(calls[1]?.connections).toEqual({});
  });
});
