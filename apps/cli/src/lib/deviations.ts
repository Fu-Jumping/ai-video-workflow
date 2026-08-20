import fs from "fs-extra";
import path from "node:path";
import { z } from "zod";

import type { VerificationIssue, WorkflowDeviation, WorkflowMode, WorkflowShotMode } from "./types.js";
import { parseYaml, stringifyYaml } from "./yaml.js";

export const DEVIATIONS_FILE = "deviations.yaml";
export const WORKFLOW_MODES: WorkflowMode[] = ["standard", "scene-basis", "minimal-video", "hybrid"];

const deviationSchema = z.object({
  rule: z.string().min(1, { message: "rule must be a non-empty string" }),
  scope: z.string().optional(),
  reason: z.string().optional(),
  confirmed_by: z.string().optional(),
  confirmed_at: z.string().optional()
});

const shotModeSchema = z.object({
  id: z.string().min(1, { message: "shot id must be a non-empty string" }),
  mode: z.enum(WORKFLOW_MODES as [WorkflowMode, ...WorkflowMode[]]),
  reason: z.string().optional()
});

const deviationsFileSchema = z.union([
  z.array(deviationSchema),
  z.object({
    mode: z.enum(WORKFLOW_MODES as [WorkflowMode, ...WorkflowMode[]]).optional(),
    deviations: z.array(deviationSchema).optional(),
    shots: z.array(shotModeSchema).optional()
  })
]);

export interface DeviationsReadResult {
  mode: WorkflowMode;
  deviations: WorkflowDeviation[];
  shots: WorkflowShotMode[];
  issues: VerificationIssue[];
}

function normalizePath(value: string | undefined): string {
  return (value ?? "").replace(/\\/g, "/");
}

/**
 * A deviation scope can be a project-relative file path, a directory prefix, or
 * `path#anchor`. Matching is intentionally coarse: if the scope is a file or a
 * directory prefix, all issues under that path are accepted.
 */
export function deviationScopeMatches(scope: string | undefined, issuePath: string | undefined): boolean {
  if (!scope || scope.trim() === "") {
    return true;
  }
  if (!issuePath) {
    return false;
  }
  const normalizedScope = normalizePath(scope).split("#", 1)[0] ?? "";
  const normalizedIssuePath = normalizePath(issuePath);
  return normalizedIssuePath === normalizedScope || normalizedIssuePath.startsWith(`${normalizedScope}/`);
}

const sceneBasisCodes = new Set([
  "missing-character-triview",
  "invalid-keyframe-mapping",
  "missing-step3-step4-link",
  "broken-step3-step4-link",
  "missing-step4-reference-asset",
  "missing-step5-reference-asset"
]);

const minimalVideoCodes = new Set([
  "invalid-keyframe-mapping",
  "missing-step3-step4-link",
  "broken-step3-step4-link",
  "missing-step4-reference-asset",
  "missing-step5-reference-asset"
]);

export function modeSuppressesIssue(mode: WorkflowMode | undefined, code: string): boolean {
  if (mode === "scene-basis") {
    return sceneBasisCodes.has(code);
  }
  if (mode === "minimal-video") {
    return minimalVideoCodes.has(code);
  }
  return false;
}

export function applyAcceptedDeviations(
  issues: VerificationIssue[],
  deviations: WorkflowDeviation[],
  strict: boolean,
  mode: WorkflowMode = "standard",
  shotModes: WorkflowShotMode[] = [],
  shotByPath: Map<string, string> = new Map()
): { issues: VerificationIssue[]; acceptedDeviations: VerificationIssue[] } {
  if (strict) {
    return { issues, acceptedDeviations: [] };
  }
  const acceptedDeviations: VerificationIssue[] = [];
  const remaining: VerificationIssue[] = [];
  for (const issue of issues) {
    const explicit = deviations.find(
      (deviation) => deviation.rule === issue.code && deviationScopeMatches(deviation.scope, issue.path)
    );
    const normalizedPath = normalizePath(issue.path);
    const shotId = shotByPath.get(normalizedPath);
    const shotMode = shotModes.find((candidate) => candidate.id === shotId);
    const suppressed =
      explicit !== undefined ||
      modeSuppressesIssue(mode, issue.code) ||
      (shotMode !== undefined && modeSuppressesIssue(shotMode.mode, issue.code));
    if (suppressed) {
      acceptedDeviations.push(issue);
    } else {
      remaining.push(issue);
    }
  }
  return { issues: remaining, acceptedDeviations };
}

export async function readDeviations(projectRoot: string): Promise<DeviationsReadResult> {
  const filePath = path.join(projectRoot, DEVIATIONS_FILE);
  if (!(await fs.pathExists(filePath))) {
    return { mode: "standard", deviations: [], shots: [], issues: [] };
  }

  let parsed: unknown;
  try {
    parsed = parseYaml<unknown>(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      mode: "standard",
      deviations: [],
      shots: [],
      issues: [
        {
          code: "invalid-deviations-yaml",
          message: `${DEVIATIONS_FILE} is not valid YAML: ${message}`,
          path: DEVIATIONS_FILE
        }
      ]
    };
  }

  if (parsed === null || parsed === undefined) {
    return { mode: "standard", deviations: [], shots: [], issues: [] };
  }

  const result = deviationsFileSchema.safeParse(parsed);
  if (!result.success) {
    return {
      mode: "standard",
      deviations: [],
      shots: [],
      issues: [
        {
          code: "invalid-deviation-entry",
          message: `${DEVIATIONS_FILE} must be an array of deviations or an object with mode/deviations/shots: ${result.error.issues
            .map((issue) => issue.path.join(".") || "(root)")
            .join(", ")}`,
          path: DEVIATIONS_FILE
        }
      ]
    };
  }

  if (Array.isArray(result.data)) {
    return { mode: "standard", deviations: result.data, shots: [], issues: [] };
  }

  return {
    mode: result.data.mode ?? "standard",
    deviations: result.data.deviations ?? [],
    shots: result.data.shots ?? [],
    issues: []
  };
}

export async function writeDeviations(
  projectRoot: string,
  deviations: WorkflowDeviation[],
  mode: WorkflowMode = "standard",
  shots: WorkflowShotMode[] = []
): Promise<void> {
  const data = { mode, deviations, shots };
  await fs.writeFile(path.join(projectRoot, DEVIATIONS_FILE), stringifyYaml(data), "utf8");
}

export async function addDeviation(
  projectRoot: string,
  input: Pick<WorkflowDeviation, "rule" | "scope" | "reason" | "confirmed_by">
): Promise<{ mode: WorkflowMode; deviations: WorkflowDeviation[]; shots: WorkflowShotMode[] }> {
  const current = await readDeviations(projectRoot);
  if (current.issues.length > 0) {
    throw new Error(`${current.issues[0].code}: ${current.issues[0].message}`);
  }
  const next: WorkflowDeviation = {
    rule: input.rule.trim(),
    ...(input.scope?.trim() ? { scope: input.scope.trim() } : {}),
    ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
    ...(input.confirmed_by?.trim() ? { confirmed_by: input.confirmed_by.trim() } : {}),
    confirmed_at: new Date().toISOString()
  };
  if (!next.rule) {
    throw new Error("Deviation rule must not be empty");
  }
  const alreadyExists = current.deviations.some(
    (deviation) =>
      deviation.rule === next.rule &&
      normalizePath(deviation.scope) === normalizePath(next.scope)
  );
  if (alreadyExists) {
    throw new Error(`Deviation already exists: ${next.rule}${next.scope ? ` (${next.scope})` : ""}`);
  }
  const deviations = [...current.deviations, next];
  await writeDeviations(projectRoot, deviations, current.mode, current.shots);
  return { mode: current.mode, deviations, shots: current.shots };
}

export async function removeDeviation(
  projectRoot: string,
  rule: string,
  scope?: string
): Promise<{ mode: WorkflowMode; deviations: WorkflowDeviation[]; shots: WorkflowShotMode[] }> {
  const current = await readDeviations(projectRoot);
  if (current.issues.length > 0) {
    throw new Error(`${current.issues[0].code}: ${current.issues[0].message}`);
  }
  const deviations = current.deviations.filter(
    (deviation) => !(deviation.rule === rule && (scope === undefined || normalizePath(scope) === normalizePath(deviation.scope)))
  );
  if (deviations.length === current.deviations.length) {
    throw new Error(`Deviation not found: ${rule}${scope ? ` (${scope})` : ""}`);
  }
  await writeDeviations(projectRoot, deviations, current.mode, current.shots);
  return { mode: current.mode, deviations, shots: current.shots };
}

export async function setWorkflowMode(projectRoot: string, mode: WorkflowMode): Promise<DeviationsReadResult> {
  const current = await readDeviations(projectRoot);
  if (current.issues.length > 0) {
    throw new Error(`${current.issues[0].code}: ${current.issues[0].message}`);
  }
  await writeDeviations(projectRoot, current.deviations, mode, current.shots);
  return { ...current, mode };
}

export async function setShotMode(
  projectRoot: string,
  shotId: string,
  mode: WorkflowMode,
  reason?: string
): Promise<DeviationsReadResult> {
  const current = await readDeviations(projectRoot);
  if (current.issues.length > 0) {
    throw new Error(`${current.issues[0].code}: ${current.issues[0].message}`);
  }
  const without = current.shots.filter((shot) => shot.id !== shotId);
  const shots = [...without, { id: shotId, mode, ...(reason?.trim() ? { reason: reason.trim() } : {}) }];
  await writeDeviations(projectRoot, current.deviations, current.mode, shots);
  return { ...current, shots };
}

export async function removeShotMode(projectRoot: string, shotId: string): Promise<DeviationsReadResult> {
  const current = await readDeviations(projectRoot);
  if (current.issues.length > 0) {
    throw new Error(`${current.issues[0].code}: ${current.issues[0].message}`);
  }
  const shots = current.shots.filter((shot) => shot.id !== shotId);
  if (shots.length === current.shots.length) {
    throw new Error(`Shot mode not found: ${shotId}`);
  }
  await writeDeviations(projectRoot, current.deviations, current.mode, shots);
  return { ...current, shots };
}

export function renderDeviations(result: Pick<DeviationsReadResult, "mode" | "deviations" | "shots">): string {
  const lines: string[] = [`Mode: ${result.mode}`];
  if (result.deviations.length === 0) {
    lines.push("No deviations registered.");
  } else {
    lines.push("Deviations:");
    for (const [index, deviation] of result.deviations.entries()) {
      lines.push(
        `${index + 1}. ${deviation.rule}${deviation.scope ? ` [${deviation.scope}]` : ""}${deviation.reason ? ` — ${deviation.reason}` : ""}${deviation.confirmed_at ? ` (${deviation.confirmed_at})` : ""}`
      );
    }
  }
  if (result.shots.length > 0) {
    lines.push("Shot modes:");
    for (const shot of result.shots) {
      lines.push(`- ${shot.id}: ${shot.mode}${shot.reason ? ` — ${shot.reason}` : ""}`);
    }
  }
  return lines.join("\n");
}
