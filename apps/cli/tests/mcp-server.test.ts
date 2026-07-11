import path from "node:path";
import { describe, expect, test } from "vitest";

import { buildMcpContext } from "../src/lib/mcp/context.js";
import { buildMcpPrompts } from "../src/lib/mcp/prompts.js";
import { buildMcpResources } from "../src/lib/mcp/resources.js";
import { createAiVideoMcpServer } from "../src/lib/mcp/server.js";
import { buildMcpTools } from "../src/lib/mcp/tools.js";

const exampleRoot = path.resolve(__dirname, "..", "..", "..", "examples", "official-mini-film");

describe("MCP resources", () => {
  test("exposes stable project and shot resource URIs", async () => {
    const context = await buildMcpContext({ projectRoot: exampleRoot, pack: "official-ai-video" });
    const resources = buildMcpResources(context);

    expect(resources.map((resource) => resource.uri)).toEqual(
      expect.arrayContaining([
        "ai-video-workflow://project/summary",
        "ai-video-workflow://project/config",
        "ai-video-workflow://pack/official-ai-video/overview",
        "ai-video-workflow://workflow/steps",
        "ai-video-workflow://workflow/step/1",
        "ai-video-workflow://workflow/step/6",
        "ai-video-workflow://shots/index",
        "ai-video-workflow://shots/shot-001",
        "ai-video-workflow://handoff/project",
        "ai-video-workflow://verification/commands"
      ])
    );
    expect(JSON.stringify(resources)).not.toMatch(/[A-Z]:\\\\|[A-Z]:\\\/|file:\/\/|vscode:\/\//);
  });
});

describe("MCP prompts", () => {
  test("exposes handoff prompts that preserve source edit boundaries", () => {
    const prompts = buildMcpPrompts();

    expect(prompts.map((prompt) => prompt.name)).toEqual(
      expect.arrayContaining([
        "review_project",
        "inspect_shot",
        "revise_storyboard",
        "revise_image_prompt",
        "revise_video_prompt",
        "verify_project"
      ])
    );
    expect(JSON.stringify(prompts)).toContain("Do not edit Obsidian projections");
    expect(JSON.stringify(prompts)).toContain("Step 4");
  });
});

describe("MCP tools", () => {
  test("exposes only read-only MCP tools", () => {
    const tools = buildMcpTools({
      projectRoot: exampleRoot,
      pack: "official-ai-video",
      ide: "codex"
    });

    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["get_project_summary", "list_shots", "get_shot_context", "run_project_verify"])
    );
    expect(tools.map((tool) => tool.name)).not.toEqual(
      expect.arrayContaining(["write_file", "sync_project", "export_obsidian", "run_libtv"])
    );
  });

  test("returns shot context by shot id without writing files", async () => {
    const tools = buildMcpTools({
      projectRoot: exampleRoot,
      pack: "official-ai-video",
      ide: "codex"
    });
    const tool = tools.find((candidate) => candidate.name === "get_shot_context");

    await expect(tool?.handler({ shotId: "shot-001" })).resolves.toEqual(
      expect.objectContaining({
        id: "shot-001",
        sourcePaths: expect.objectContaining({
          imagePrompt: "04_image_prompts/shot-001-keyframe.md"
        })
      })
    );
    await expect(tool?.handler({ shotId: "missing-shot" })).rejects.toThrow("Unknown shotId: missing-shot");
  });
});

describe("MCP server", () => {
  test("creates a read-only MCP server from the project context", async () => {
    const server = await createAiVideoMcpServer({
      projectRoot: exampleRoot,
      pack: "official-ai-video",
      ide: "codex"
    });

    expect(server.server).toBeDefined();
    expect(server.isConnected()).toBe(false);
  });
});
