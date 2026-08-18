import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { buildMcpContext } from "../src/lib/mcp/context.js";
import { buildMcpPrompts } from "../src/lib/mcp/prompts.js";
import { buildMcpResources } from "../src/lib/mcp/resources.js";
import { createAiVideoMcpServer } from "../src/lib/mcp/server.js";
import { buildMcpTools } from "../src/lib/mcp/tools.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

async function createChineseMcpProject(): Promise<string> {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-video-workflow-mcp-server-cn-"));
  tempRoots.push(projectRoot);
  await fs.writeFile(
    path.join(projectRoot, "project.config.yaml"),
    [
      "pack: official-ai-video",
      "ide: codex",
      "platforms:",
      "  image:",
      "    default: openai",
      "  video:",
      "    default: seedance",
      "workflow:",
      "  enhanced_flow:",
      "    enabled: true"
    ].join("\n"),
    "utf8"
  );
  for (const dir of ["01_概念策划", "02_世界设定", "03_分镜脚本", "04_图片提示词", "05_视频提示词", "06_执行计划"]) {
    await fs.ensureDir(path.join(projectRoot, dir));
  }
  for (const step of ["03_分镜脚本", "04_图片提示词", "05_视频提示词"]) {
    await fs.ensureDir(path.join(projectRoot, step, "镜头组-001"));
  }
  await fs.writeFile(path.join(projectRoot, "03_分镜脚本", "镜头组-001", "00_镜头组说明.md"), "# 镜头组 001\n", "utf8");
  await fs.writeFile(
    path.join(projectRoot, "03_分镜脚本", "镜头组-001", "镜头-001.md"),
    [
      "# 镜头 001",
      "",
      "- 图片提示词：[镜头-001-关键帧](../../04_图片提示词/镜头组-001/镜头-001-关键帧-01.md)",
      "- 视频提示词：[镜头-001](../../05_视频提示词/镜头组-001/镜头-001.md)"
    ].join("\n"),
    "utf8"
  );
  await fs.writeFile(path.join(projectRoot, "04_图片提示词", "镜头组-001", "镜头-001-关键帧-01.md"), "# 镜头 001 关键帧\n", "utf8");
  await fs.writeFile(path.join(projectRoot, "05_视频提示词", "镜头组-001", "镜头-001.md"), "# 镜头 001 视频\n", "utf8");
  return projectRoot;
}

describe("MCP resources", () => {
  test("exposes stable project and shot resource URIs", async () => {
    const projectRoot = await createChineseMcpProject();
    const context = await buildMcpContext({ projectRoot, pack: "official-ai-video" });
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
    expect(JSON.stringify(resources)).not.toMatch(/[A-Z]:\\|[A-Z]:\/|file:\/\/|vscode:\/\//);
    expect(JSON.stringify(resources)).toContain("_views/obsidian");
    expect(JSON.stringify(resources)).toContain("观看层");
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
    expect(JSON.stringify(prompts)).toContain("不要把 _views/obsidian 下的 Obsidian 投影");
    expect(JSON.stringify(prompts)).toContain("_views/obsidian");
    expect(JSON.stringify(prompts)).toContain("不能替代步骤文件");
    expect(JSON.stringify(prompts)).toContain("步骤四");
  });
});

describe("MCP tools", () => {
  test("exposes only read-only MCP tools", async () => {
    const projectRoot = await createChineseMcpProject();
    const tools = buildMcpTools({
      projectRoot,
      pack: "official-ai-video",
      ide: "codex"
    });

    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["get_project_summary", "list_shots", "get_shot_context", "run_project_verify"])
    );
    expect(tools.map((tool) => tool.name)).not.toEqual(
      expect.arrayContaining(["write_file", "sync_project", "export_obsidian", "write_obsidian_view", "run_libtv"])
    );
  });

  test("returns shot context by shot id without writing files", async () => {
    const projectRoot = await createChineseMcpProject();
    const tools = buildMcpTools({
      projectRoot,
      pack: "official-ai-video",
      ide: "codex"
    });
    const tool = tools.find((candidate) => candidate.name === "get_shot_context");

    await expect(tool?.handler({ shotId: "shot-001" })).resolves.toEqual(
      expect.objectContaining({
        id: "shot-001",
        groupId: "group-001",
        sourcePaths: expect.objectContaining({
          imagePrompt: "04_图片提示词/镜头组-001/镜头-001-关键帧-01.md",
          imagePrompts: ["04_图片提示词/镜头组-001/镜头-001-关键帧-01.md"]
        })
      })
    );
    await expect(tool?.handler({ shotId: "missing-shot" })).rejects.toThrow("Unknown shotId: missing-shot");
  });
});

describe("MCP server", () => {
  test("creates a read-only MCP server from the project context", async () => {
    const projectRoot = await createChineseMcpProject();
    const server = await createAiVideoMcpServer({
      projectRoot,
      pack: "official-ai-video",
      ide: "codex"
    });

    expect(server.server).toBeDefined();
    expect(server.isConnected()).toBe(false);
  });

  test("reports the CLI package version as the MCP server version", async () => {
    const projectRoot = await createChineseMcpProject();
    const server = await createAiVideoMcpServer({
      projectRoot,
      pack: "official-ai-video",
      ide: "codex"
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const serverInfo = await client.getServerVersion();
    expect(serverInfo.name).toBe("ai-video-workflow");
    expect(serverInfo.version).toBe("0.1.0");

    await client.close();
  }, 20000);
});
