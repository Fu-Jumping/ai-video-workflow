import fs from "fs-extra";
import path from "node:path";
import { z } from "zod";

import { DEFAULT_PACK, SUPPORTED_IDES, SUPPORTED_PLATFORMS } from "./constants.js";
import type { ProjectConfig, VerificationIssue } from "./types.js";
import { parseYaml } from "./yaml.js";

const projectConfigSchema = z.object({
  pack: z.literal(DEFAULT_PACK),
  ide: z.enum(SUPPORTED_IDES as [typeof SUPPORTED_IDES[number], ...typeof SUPPORTED_IDES]),
  platforms: z.object({
    image: z.object({
      default: z.enum(SUPPORTED_PLATFORMS as [typeof SUPPORTED_PLATFORMS[number], ...typeof SUPPORTED_PLATFORMS])
    }),
    video: z.object({
      default: z.enum(SUPPORTED_PLATFORMS as [typeof SUPPORTED_PLATFORMS[number], ...typeof SUPPORTED_PLATFORMS])
    })
  }),
  workflow: z.object({
    enhanced_flow: z.object({
      enabled: z.boolean()
    })
  })
});

export interface ProjectConfigReadResult {
  config: ProjectConfig | null;
  issues: VerificationIssue[];
}

function formatZodIssue(issue: z.ZodIssue): string {
  const fieldPath = issue.path.length > 0 ? issue.path.join(".") : "project.config.yaml";
  return `${fieldPath}: ${issue.message}`;
}

export async function readProjectConfig(projectRoot: string): Promise<ProjectConfigReadResult> {
  const configPath = path.join(projectRoot, "project.config.yaml");
  if (!(await fs.pathExists(configPath))) {
    return {
      config: null,
      issues: [{ code: "missing-config", message: "Missing project.config.yaml", path: "project.config.yaml" }]
    };
  }

  let parsed: unknown;
  try {
    parsed = parseYaml<unknown>(await fs.readFile(configPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      config: null,
      issues: [
        {
          code: "invalid-project-config-yaml",
          message: `project.config.yaml is not valid YAML: ${message}`,
          path: "project.config.yaml"
        }
      ]
    };
  }

  const result = projectConfigSchema.safeParse(parsed);
  if (!result.success) {
    return {
      config: null,
      issues: result.error.issues.map((issue) => ({
        code: "invalid-project-config",
        message: `Invalid project.config.yaml: ${formatZodIssue(issue)}`,
        path: "project.config.yaml"
      }))
    };
  }

  return { config: result.data, issues: [] };
}
