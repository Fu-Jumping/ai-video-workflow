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

function fixturesRoot(): string {
  return path.resolve(__dirname, "fixtures", "agent-adapters");
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

  test("documents every adapter fixture as a runtime mirror without replacing Step files", async () => {
    const fixtureNames = (await fs.readdir(fixturesRoot())).filter((fileName) => fileName.endsWith(".contract.json"));
    expect(fixtureNames).toEqual(expect.arrayContaining(["codex.contract.json", "claude-code.contract.json"]));

    for (const fixtureName of fixtureNames) {
      const contract = await fs.readJson(fixturePath(fixtureName)) as AgentAdapterContract;

      expect(typeof contract.adapterId, `${fixtureName} adapterId`).toBe("string");
      expect(typeof contract.displayName, `${fixtureName} displayName`).toBe("string");
      expect(allowedSyncDirections, `${fixtureName} syncDirection`).toContain(contract.syncDirection);
      expect(contract.sourceOfTruth, `${fixtureName} sourceOfTruth`).toBe("project-step-files");
      expect(typeof contract.failureBehavior, `${fixtureName} failureBehavior`).toBe("string");
      expect((contract.failureBehavior as string).length, `${fixtureName} failureBehavior`).toBeGreaterThan(0);

      expectStringArray(contract.inputs);
      expectStringArray(contract.outputs);
      expectStringArray(contract.handoffSurfaces);
      expectStringArray(contract.verificationCommands);
      expectStringArray(contract.forbiddenWrites);

      expect(contract.forbiddenWrites, `${fixtureName} forbiddenWrites`).toEqual(expect.arrayContaining([".obsidian/", "absolute links"]));
    }
  });

  test("documents Codex adapter output locations", async () => {
    const contract = await fs.readJson(fixturePath("codex.contract.json")) as AgentAdapterContract;

    expect(contract.adapterId).toBe("codex");
    expect(contract.syncDirection).toBe("runtime-mirror");
    expect(contract.sourceOfTruth).toBe("project-step-files");

    expect(contract.outputs).toEqual(expect.arrayContaining([".codex/ai-video-workflow/", ".codex/skills/"]));
    expect(contract.verificationCommands).toEqual(expect.arrayContaining(["ai-video-workflow verify --project <path> --ide codex"]));
    expect(contract.forbiddenWrites).toEqual(expect.arrayContaining([".obsidian/", "absolute links"]));
  });

  test("documents Claude Code adapter output locations", async () => {
    const contract = await fs.readJson(fixturePath("claude-code.contract.json")) as AgentAdapterContract;

    expect(contract.adapterId).toBe("claude-code");
    expect(contract.syncDirection).toBe("runtime-mirror");
    expect(contract.sourceOfTruth).toBe("project-step-files");

    expect(contract.outputs).toEqual(expect.arrayContaining(["CLAUDE.md", ".claude/commands/", ".claude/ai-video-workflow/", ".claude/skills/"]));
    expect(contract.handoffSurfaces).toEqual(expect.arrayContaining(["CLAUDE.md", ".claude/commands/ai-video-workflow.md"]));
    expect(contract.verificationCommands).toEqual(expect.arrayContaining(["ai-video-workflow verify --project <path> --ide claude-code"]));
    expect(contract.forbiddenWrites).toEqual(expect.arrayContaining([".obsidian/", "absolute links"]));
  });
});
