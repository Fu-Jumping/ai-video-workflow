import fs from "fs-extra";
import path from "node:path";
import { describe, expect, test } from "vitest";

const allowedSyncDirections = ["runtime-mirror", "one-way-project-to-adapter", "read-only-context"];

interface AgentAdapterContract {
  adapterId?: unknown;
  displayName?: unknown;
  inputs?: unknown;
  outputs?: unknown;
  syncDirection?: unknown;
  sourceOfTruth?: unknown;
  handoffSurfaces?: unknown;
  verificationCommands?: unknown;
  forbiddenWrites?: unknown;
  failureBehavior?: unknown;
}

function fixturePath(fileName: string): string {
  return path.resolve(__dirname, "fixtures", "agent-adapters", fileName);
}

function schemaPath(): string {
  return path.resolve(__dirname, "..", "..", "..", "schemas", "agent-adapter-contract.schema.json");
}

function expectStringArray(value: unknown): asserts value is string[] {
  expect(Array.isArray(value)).toBe(true);
  expect((value as unknown[]).every((item) => typeof item === "string" && item.length > 0)).toBe(true);
}

describe("agent adapter contract", () => {
  test("keeps the schema aligned with the required contract fields", async () => {
    const schema = await fs.readJson(schemaPath()) as {
      required?: string[];
      properties?: Record<string, unknown>;
    };

    expect(schema.required).toEqual(
      expect.arrayContaining(["adapterId", "displayName", "inputs", "outputs", "syncDirection", "sourceOfTruth", "failureBehavior"])
    );
    expect(schema.properties).toHaveProperty("handoffSurfaces");
    expect(schema.properties).toHaveProperty("verificationCommands");
    expect(schema.properties).toHaveProperty("forbiddenWrites");
  });

  test("documents Codex as a runtime-mirror adapter without replacing Step files", async () => {
    const contract = await fs.readJson(fixturePath("codex.contract.json")) as AgentAdapterContract;

    expect(contract.adapterId).toBe("codex");
    expect(contract.displayName).toBe("Codex");
    expect(contract.syncDirection).toBe("runtime-mirror");
    expect(allowedSyncDirections).toContain(contract.syncDirection);
    expect(contract.sourceOfTruth).toBe("project-step-files");
    expect(typeof contract.failureBehavior).toBe("string");
    expect((contract.failureBehavior as string).length).toBeGreaterThan(0);

    expectStringArray(contract.inputs);
    expectStringArray(contract.outputs);
    expectStringArray(contract.handoffSurfaces);
    expectStringArray(contract.verificationCommands);
    expectStringArray(contract.forbiddenWrites);

    expect(contract.outputs).toEqual(expect.arrayContaining([".codex/ai-video-workflow/", ".codex/skills/"]));
    expect(contract.verificationCommands).toEqual(expect.arrayContaining(["ai-video-workflow verify --project <path> --ide codex"]));
    expect(contract.forbiddenWrites).toEqual(expect.arrayContaining([".obsidian/", "absolute links"]));
  });
});
