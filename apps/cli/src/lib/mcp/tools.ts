import type { Ide } from "../types.js";
import { verifyProject } from "../verify.js";
import { buildMcpContext } from "./context.js";

export interface BuildMcpToolsOptions {
  projectRoot: string;
  pack: string;
  ide: Ide;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  readOnly: true;
  handler: (input?: Record<string, unknown>) => Promise<unknown>;
}

export function buildMcpTools(options: BuildMcpToolsOptions): McpToolDefinition[] {
  const tools: McpToolDefinition[] = [
    {
      name: "get_project_summary",
      description: "Return the read-only MCP project summary.",
      readOnly: true,
      handler: async () => buildMcpContext({ projectRoot: options.projectRoot, pack: options.pack })
    },
    {
      name: "list_shots",
      description: "Return shot ids, titles, and source path references.",
      readOnly: true,
      handler: async () => {
        const context = await buildMcpContext({ projectRoot: options.projectRoot, pack: options.pack });
        return context.shots;
      }
    },
    {
      name: "get_shot_context",
      description: "Return read-only context for one shot.",
      readOnly: true,
      handler: async (input) => {
        const shotId = typeof input?.shotId === "string" ? input.shotId : "";
        const context = await buildMcpContext({ projectRoot: options.projectRoot, pack: options.pack });
        const shot = context.shots.find((candidate) => candidate.id === shotId);
        if (!shot) {
          throw new Error(`Unknown shotId: ${shotId}`);
        }
        return shot;
      }
    },
    {
      name: "run_project_verify",
      description: "Run project verification and return issues without repairing files.",
      readOnly: true,
      handler: async () => verifyProject({ projectRoot: options.projectRoot, ide: options.ide, pack: options.pack })
    }
  ];

  return tools.sort((a, b) => a.name.localeCompare(b.name));
}
