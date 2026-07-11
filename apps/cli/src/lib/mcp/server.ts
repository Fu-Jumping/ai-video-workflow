import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult, GetPromptResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import type { Ide } from "../types.js";
import { buildMcpContext } from "./context.js";
import { buildMcpPrompts, type McpPromptDefinition } from "./prompts.js";
import { buildMcpResources, type McpResourceDefinition } from "./resources.js";
import { buildMcpTools, type McpToolDefinition } from "./tools.js";

export interface CreateAiVideoMcpServerOptions {
  projectRoot: string;
  pack: string;
  ide: Ide;
}

function textResourceResult(resource: McpResourceDefinition): ReadResourceResult {
  return {
    contents: [
      {
        uri: resource.uri,
        mimeType: resource.mimeType,
        text: resource.text
      }
    ]
  };
}

function promptResult(prompt: McpPromptDefinition, args: Record<string, unknown> = {}): GetPromptResult {
  const rendered = prompt.template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => String(args[key] ?? `<${key}>`));
  return {
    description: prompt.description,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: rendered
        }
      }
    ]
  };
}

function toolResult(value: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}

function registerResources(server: McpServer, resources: McpResourceDefinition[]): void {
  for (const resource of resources) {
    server.registerResource(
      resource.name,
      resource.uri,
      {
        title: resource.name,
        mimeType: resource.mimeType
      },
      () => textResourceResult(resource)
    );
  }
}

function registerPrompts(server: McpServer, prompts: McpPromptDefinition[]): void {
  for (const prompt of prompts) {
    const argsSchema = Object.fromEntries(
      prompt.arguments.map((argument) => {
        const schema = z.string().describe(argument.description);
        return [argument.name, argument.required ? schema : schema.optional()];
      })
    );
    server.registerPrompt(
      prompt.name,
      {
        title: prompt.name,
        description: prompt.description,
        argsSchema
      },
      (args) => promptResult(prompt, args)
    );
  }
}

function registerTools(server: McpServer, tools: McpToolDefinition[]): void {
  for (const tool of tools) {
    const inputSchema = tool.name === "get_shot_context" ? { shotId: z.string().describe("Shot id such as shot-001.") } : undefined;
    server.registerTool(
      tool.name,
      {
        title: tool.name,
        description: tool.description,
        inputSchema,
        annotations: {
          readOnlyHint: true
        }
      },
      async (input) => toolResult(await tool.handler(input as Record<string, unknown>))
    );
  }
}

export async function createAiVideoMcpServer(options: CreateAiVideoMcpServerOptions): Promise<McpServer> {
  const context = await buildMcpContext({ projectRoot: options.projectRoot, pack: options.pack });
  const server = new McpServer({
    name: "ai-video-workflow",
    version: "0.5.0"
  });

  registerResources(server, buildMcpResources(context));
  registerPrompts(server, buildMcpPrompts());
  registerTools(server, buildMcpTools(options));

  return server;
}

export async function startMcpServer(options: CreateAiVideoMcpServerOptions): Promise<void> {
  const server = await createAiVideoMcpServer(options);
  await server.connect(new StdioServerTransport());
}
