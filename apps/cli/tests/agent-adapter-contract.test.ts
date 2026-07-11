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
  sharedEntryPoints?: unknown;
  generatedSurfaces?: unknown;
  userOwnedSurfaces?: unknown;
  privateRuntimeSurfaces?: unknown;
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
    expect(schema.properties).toHaveProperty("sharedEntryPoints");
    expect(schema.properties).toHaveProperty("generatedSurfaces");
    expect(schema.properties).toHaveProperty("userOwnedSurfaces");
    expect(schema.properties).toHaveProperty("privateRuntimeSurfaces");
    expect(schema.properties).toHaveProperty("verificationCommands");
    expect(schema.properties).toHaveProperty("forbiddenWrites");
  });

  test("documents every adapter fixture without replacing Step files", async () => {
    const fixtureNames = (await fs.readdir(fixturesRoot())).filter((fileName) => fileName.endsWith(".contract.json"));
    expect(fixtureNames).toEqual(
      expect.arrayContaining(["codex.contract.json", "claude-code.contract.json", "trae.contract.json", "mcp.contract.json", "cherry-studio.contract.json"])
    );

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

  test("documents Trae adapter output locations", async () => {
    const contract = await fs.readJson(fixturePath("trae.contract.json")) as AgentAdapterContract;

    expect(contract.adapterId).toBe("trae");
    expect(contract.syncDirection).toBe("runtime-mirror");
    expect(contract.sourceOfTruth).toBe("project-step-files");

    expect(contract.outputs).toEqual(expect.arrayContaining([".trae/rules/", ".trae/specs/ai-video-workflow/", ".trae/documents/ai-video-workflow/", ".trae/skills/"]));
    expect(contract.outputs).not.toContain("AGENTS.md");
    expectStringArray(contract.sharedEntryPoints);
    expect(contract.sharedEntryPoints).toEqual(expect.arrayContaining(["AGENTS.md", "docs/ai-workspace/README.md"]));
    expect(contract.handoffSurfaces).toEqual(expect.arrayContaining(["AGENTS.md", ".trae/rules/ai-video-workflow.md"]));
    expect(contract.verificationCommands).toEqual(expect.arrayContaining(["ai-video-workflow verify --project <path> --ide trae"]));
    expect(contract.forbiddenWrites).toEqual(expect.arrayContaining([".obsidian/", "CLAUDE.md", "absolute links"]));
  });

  test("documents MCP adapter as read-only context", async () => {
    const contract = await fs.readJson(fixturePath("mcp.contract.json")) as AgentAdapterContract;

    expect(contract.adapterId).toBe("mcp");
    expect(contract.syncDirection).toBe("read-only-context");
    expect(contract.sourceOfTruth).toBe("project-step-files");
    expect(contract.outputs).toEqual(expect.arrayContaining(["MCP resources", "MCP prompts", "read-only MCP tools"]));
    expect(contract.forbiddenWrites).toEqual(
      expect.arrayContaining([
        "01_concept/",
        "02_setting/",
        "03_storyboard/",
        "04_image_prompts/",
        "05_video_prompts/",
        "06_execution_plan/",
        "Workflow/",
        "Shots/",
        "Canvas/",
        "Bases/",
        ".obsidian/",
        ".codex/",
        ".cursor/",
        ".claude/",
        ".trae/",
        "absolute links"
      ])
    );
  });

  test("documents Cherry Studio as a read-only working-directory adapter", async () => {
    const contract = await fs.readJson(fixturePath("cherry-studio.contract.json")) as AgentAdapterContract;

    expect(contract.adapterId).toBe("cherry-studio");
    expect(contract.syncDirection).toBe("read-only-context");
    expect(contract.sourceOfTruth).toBe("project-step-files");
    expect(contract.outputs).toEqual(expect.arrayContaining(["working directory context", "documentation guidance"]));
    expectStringArray(contract.sharedEntryPoints);
    expectStringArray(contract.userOwnedSurfaces);
    expectStringArray(contract.privateRuntimeSurfaces);
    expect(contract.sharedEntryPoints).toEqual(expect.arrayContaining(["AGENTS.md", "docs/ai-workspace/README.md"]));
    expect(contract.userOwnedSurfaces).toEqual(expect.arrayContaining(["soul.md", "USER.md", "memory/", "MEMORY_FILE_PATH"]));
    expect(contract.forbiddenWrites).toEqual(
      expect.arrayContaining(["soul.md", "USER.md", "SOUL.md", "memory/", "MEMORY_FILE_PATH", "Cherry Studio global memory", "@cherry/memory", "absolute links"])
    );
  });
});
