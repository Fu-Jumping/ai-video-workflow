import fs from "fs-extra";
import path from "node:path";

import { CliUserError } from "./cli-errors.js";
import { STEP_DIR_BY_NUMBER } from "./constants.js";
import { exportObsidianVault } from "./obsidian/export.js";
import { projectionManifestPath, readProjectionManifest, renderProjectionManifest } from "./obsidian/manifest.js";
import { frontmatterValue } from "./obsidian/properties.js";
import { shotLookupDirectory, stageReviewPath, userNotesDirectory } from "./obsidian/routes.js";
import type { ObsidianExportResult, ObsidianProjectionManifest, ObsidianProjectionManifestEntry } from "./obsidian/types.js";
import { readWorkflowProjectConfig } from "./project-root.js";
import { syncProject } from "./sync.js";
import type { Ide, VerificationIssue } from "./types.js";
import { verifyObsidianVault } from "./obsidian/verify.js";
import { resolveInProjectObsidianView } from "./view-layer.js";

export type CleanViewKind = "workflow-notes" | "shot-pages" | "canvas" | "base" | "dashboard" | "obsidian-ui";
type CleanViewSummaryKind = CleanViewKind | "manifest" | "other";
export type CleanViewOperationStatus = "would-remove" | "removed" | "missing";

export interface CleanViewPropertyFilter {
  key: string;
  value: string;
}

export interface CleanViewFilter {
  kinds?: CleanViewKind[];
  steps?: number[];
  shots?: string[];
  dirs?: string[];
  properties?: CleanViewPropertyFilter[];
}

export interface CleanViewFilterInput {
  kinds?: string[];
  steps?: string[];
  shots?: string[];
  dirs?: string[];
  properties?: string[];
}

export interface CleanViewOperation {
  status: CleanViewOperationStatus;
  vaultPath: string;
}

export interface CleanViewResult {
  projectRoot: string;
  vaultRoot: string;
  dryRun: boolean;
  filter: CleanViewFilter;
  noOpReason?: string;
  operations: CleanViewOperation[];
  preservedUntrackedFiles: string[];
  removedEmptyDirs: string[];
  manifestUpdated: boolean;
}

export interface RebuildViewOptions {
  repoRoot: string;
  projectRoot: string;
  ide?: Ide;
  dryRun?: boolean;
  includeObsidianUi?: boolean;
  includePluginRecipes?: boolean;
  skipSync?: boolean;
  filter?: CleanViewFilter;
}

export interface RebuildViewResult {
  projectRoot: string;
  vaultRoot: string;
  ide: Ide;
  dryRun: boolean;
  syncPlanned: boolean;
  syncRan: boolean;
  clean: CleanViewResult;
  exportResult: ObsidianExportResult;
  verificationIssues: VerificationIssue[];
}

const generatedViewPathExtensions = /\.(md|base|canvas|json)$/i;
const cleanViewKinds = ["workflow-notes", "shot-pages", "canvas", "base", "dashboard", "obsidian-ui"] as const;
const cleanViewKindLabels: Record<CleanViewSummaryKind, string> = {
  "workflow-notes": "workflow-notes",
  "shot-pages": "shot-pages",
  canvas: "canvas",
  base: "base",
  dashboard: "dashboard",
  "obsidian-ui": "obsidian-ui",
  manifest: "manifest",
  other: "other-generated"
};
const unsafeVaultPathPattern = /(^|[^A-Za-z])[A-Za-z]:[\\/]|^[a-z][a-z0-9+.-]*:/i;

function isSafeRelativeVaultPath(value: string): boolean {
  return (
    value.length > 0 &&
    !value.includes("\\") &&
    !value.startsWith("/") &&
    !path.isAbsolute(value) &&
    !unsafeVaultPathPattern.test(value) &&
    !value.startsWith("../") &&
    !value.includes("/../") &&
    !value.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")
  );
}

function uniqueSorted<T extends string | number>(values: T[] | undefined): T[] | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }
  return [...new Set(values)].sort((left, right) => String(left).localeCompare(String(right))) as T[];
}

function splitCsv(values: string[] | undefined): string[] {
  return (values ?? []).flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean);
}

function isCleanViewKind(value: string): value is CleanViewKind {
  return (cleanViewKinds as readonly string[]).includes(value);
}

function normalizeStep(value: string): number {
  if (!/^\d+$/.test(value.trim())) {
    throw new CliUserError(`Invalid clean-view step: ${value}. Expected a number from 0 to 7.`);
  }
  const step = Number.parseInt(value, 10);
  if (step < 0 || step > 7) {
    throw new CliUserError(`Invalid clean-view step: ${value}. Expected a number from 0 to 7.`);
  }
  return step;
}

function normalizeShotId(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^(?:(?:shot|镜头)[-_ ]?)?(\d+)$/i);
  if (!match) {
    throw new CliUserError(`Invalid clean-view shot: ${value}. Expected shot-001 or a number such as 1.`);
  }
  const shotNumber = Number.parseInt(match[1], 10);
  if (shotNumber < 1) {
    throw new CliUserError(`Invalid clean-view shot: ${value}. Expected shot-001 or a number such as 1.`);
  }
  return `shot-${String(shotNumber).padStart(3, "0")}`;
}

function normalizeVaultDir(value: string): string {
  const trimmed = value.trim().replace(/\/+$/g, "");
  if (!trimmed) {
    throw new CliUserError("Invalid clean-view dir: directory must not be empty.");
  }
  if (trimmed.includes("\\") || trimmed.startsWith("/") || unsafeVaultPathPattern.test(trimmed)) {
    throw new CliUserError(`Invalid clean-view dir: ${value}. Use a vault-relative path with forward slashes.`);
  }
  const segments = trimmed.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw new CliUserError(`Invalid clean-view dir: ${value}. Path segments must not be empty, . or ...`);
  }
  return segments.join("/");
}

function normalizePropertyFilter(value: string): CleanViewPropertyFilter {
  const separatorIndex = value.indexOf("=");
  if (separatorIndex <= 0) {
    throw new CliUserError(`Invalid clean-view property filter: ${value}. Expected 字段=值.`);
  }
  const key = value.slice(0, separatorIndex).trim();
  const propertyValue = value.slice(separatorIndex + 1).trim();
  if (!key || !propertyValue) {
    throw new CliUserError(`Invalid clean-view property filter: ${value}. Field and value must both be present.`);
  }
  return { key, value: propertyValue };
}

export function parseCleanViewFilter(input: CleanViewFilterInput = {}): CleanViewFilter {
  const kinds = splitCsv(input.kinds).map((kind) => {
    if (!isCleanViewKind(kind)) {
      throw new CliUserError(`Invalid clean-view kind: ${kind}. Expected one of: ${cleanViewKinds.join(", ")}.`);
    }
    return kind;
  });
  return {
    kinds: uniqueSorted(kinds),
    steps: uniqueSorted(splitCsv(input.steps).map(normalizeStep)),
    shots: uniqueSorted(splitCsv(input.shots).map(normalizeShotId)),
    dirs: uniqueSorted(splitCsv(input.dirs).map(normalizeVaultDir)),
    properties: splitCsv(input.properties).map(normalizePropertyFilter)
  };
}

function hasActiveFilter(filter: CleanViewFilter | undefined): boolean {
  return Boolean(
    filter?.kinds?.length || filter?.steps?.length || filter?.shots?.length || filter?.dirs?.length || filter?.properties?.length
  );
}

function renderFilterSummary(filter: CleanViewFilter): string[] {
  const lines: string[] = [];
  if (filter.kinds?.length) {
    lines.push(`  - kind: ${filter.kinds.join(", ")}`);
  }
  if (filter.steps?.length) {
    lines.push(`  - step: ${filter.steps.join(", ")}`);
  }
  if (filter.shots?.length) {
    lines.push(`  - shot: ${filter.shots.join(", ")}`);
  }
  if (filter.dirs?.length) {
    lines.push(`  - dir: ${filter.dirs.join(", ")}`);
  }
  if (filter.properties?.length) {
    lines.push(`  - property: ${filter.properties.map((item) => `${item.key}=${item.value}`).join(", ")}`);
  }
  return lines;
}

function quoteCliArg(value: string): string {
  return `"${value.replace(/"/g, "\\\"")}"`;
}

function cleanViewFilterArgs(filter: CleanViewFilter): string[] {
  const args: string[] = [];
  for (const value of filter.kinds ?? []) {
    args.push("--kind", value);
  }
  for (const value of filter.steps ?? []) {
    args.push("--step", String(value));
  }
  for (const value of filter.shots ?? []) {
    args.push("--shot", value);
  }
  for (const value of filter.dirs ?? []) {
    args.push("--dir", quoteCliArg(value));
  }
  for (const value of filter.properties ?? []) {
    args.push("--property", quoteCliArg(`${value.key}=${value.value}`));
  }
  return args;
}

function normalizeCleanViewFilter(filter: CleanViewFilter | undefined): CleanViewFilter {
  const kinds = filter?.kinds?.map((kind) => {
    if (!isCleanViewKind(kind)) {
      throw new CliUserError(`Invalid clean-view kind: ${kind}. Expected one of: ${cleanViewKinds.join(", ")}.`);
    }
    return kind;
  });
  return {
    kinds: uniqueSorted(kinds),
    steps: uniqueSorted(filter?.steps?.map((step) => normalizeStep(String(step)))),
    shots: uniqueSorted(filter?.shots?.map(normalizeShotId)),
    dirs: uniqueSorted(filter?.dirs?.map(normalizeVaultDir)),
    properties: filter?.properties?.map((property) => normalizePropertyFilter(`${property.key}=${property.value}`)) ?? []
  };
}

function vaultFsPath(vaultRoot: string, vaultPath: string): string {
  if (!isSafeRelativeVaultPath(vaultPath)) {
    throw new CliUserError(`Unsafe Obsidian view path in projection manifest: ${vaultPath}`);
  }
  const resolvedRoot = path.resolve(vaultRoot);
  const resolvedPath = path.resolve(resolvedRoot, ...vaultPath.split("/"));
  const relative = path.relative(resolvedRoot, resolvedPath);
  if (relative.length === 0 || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new CliUserError(`Unsafe Obsidian view path in projection manifest: ${vaultPath}`);
  }
  return resolvedPath;
}

async function listFiles(root: string, current = root): Promise<string[]> {
  if (!(await fs.pathExists(current))) {
    return [];
  }
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(root, fullPath)));
    } else if (entry.isFile()) {
      files.push(path.relative(root, fullPath).replace(/\\/g, "/"));
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

async function containsGitDirectory(root: string): Promise<boolean> {
  if (!(await fs.pathExists(root))) {
    return false;
  }
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.name === ".git") {
      return true;
    }
    if (await containsGitDirectory(path.join(root, entry.name))) {
      return true;
    }
  }
  return false;
}

function assertManifestShape(manifest: ObsidianProjectionManifest | null, vaultRoot: string): ObsidianProjectionManifest {
  if (!manifest) {
    throw new CliUserError(
      `Cannot clean Obsidian view without ${projectionManifestPath}: ${vaultRoot}`,
      "Run incremental export, or inspect the directory manually before using destructive cleanup."
    );
  }
  if (manifest.generator !== "ai-video-workflow" || !Array.isArray(manifest.files)) {
    throw new CliUserError(`Invalid Obsidian projection manifest: ${path.join(vaultRoot, projectionManifestPath)}`);
  }
  for (const entry of manifest.files) {
    if (!entry.vaultPath || !isSafeRelativeVaultPath(entry.vaultPath) || (entry.sourcePath && !isSafeRelativeVaultPath(entry.sourcePath))) {
      throw new CliUserError(`Invalid Obsidian projection manifest entry path: ${path.join(vaultRoot, projectionManifestPath)}`);
    }
  }
  return manifest;
}

function cleanableManifestEntries(manifest: ObsidianProjectionManifest): ObsidianProjectionManifestEntry[] {
  const entries = new Map<string, ObsidianProjectionManifestEntry>();
  for (const entry of manifest.files) {
    if (entry.vaultPath && generatedViewPathExtensions.test(entry.vaultPath)) {
      entries.set(entry.vaultPath, entry);
    }
  }
  return [...entries.values()].sort((left, right) => left.vaultPath.localeCompare(right.vaultPath));
}

function kindForVaultPath(vaultPath: string): CleanViewKind | undefined {
  if (vaultPath.endsWith(".canvas")) {
    return "canvas";
  }
  if (vaultPath.endsWith(".base")) {
    return "base";
  }
  if (vaultPath.startsWith(".obsidian/")) {
    return "obsidian-ui";
  }
  if (vaultPath.startsWith("01_阶段审核/") && vaultPath.endsWith(".md")) {
    return "workflow-notes";
  }
  if (vaultPath.startsWith(`${shotLookupDirectory}/单镜头/`) && vaultPath.endsWith(".md")) {
    return "shot-pages";
  }
  if (vaultPath.endsWith(".md") && !vaultPath.startsWith(`${userNotesDirectory}/`)) {
    return "dashboard";
  }
  return undefined;
}

function entryKind(entry: ObsidianProjectionManifestEntry): CleanViewKind | undefined {
  return kindForVaultPath(entry.vaultPath);
}

function summaryKindForVaultPath(vaultPath: string): CleanViewSummaryKind {
  if (vaultPath === projectionManifestPath) {
    return "manifest";
  }
  return kindForVaultPath(vaultPath) ?? "other";
}

function pathMatchesShot(value: string | undefined, shotId: string): boolean {
  if (!value) {
    return false;
  }
  if (value.toLowerCase().includes(shotId.toLowerCase())) {
    return true;
  }
  const shotNumber = shotId.match(/(\d+)$/)?.[1] ?? "";
  const numeric = String(Number.parseInt(shotNumber, 10));
  return new RegExp(`(?:shot|镜头)[-_ ]?0*${numeric}(?:\\D|$)`, "i").test(value);
}

function entryMatchesStep(entry: ObsidianProjectionManifestEntry, step: number): boolean {
  const sourceDir = STEP_DIR_BY_NUMBER[step];
  return Boolean(
    (sourceDir && entry.sourcePath?.startsWith(`${sourceDir}/`)) ||
      entry.vaultPath.startsWith(`${stageReviewPath(step)}/`)
  );
}

function entryMatchesDir(entry: ObsidianProjectionManifestEntry, dir: string): boolean {
  return entry.vaultPath === dir || entry.vaultPath.startsWith(`${dir}/`);
}

function readFrontmatter(content: string): Record<string, string> | null {
  if (!content.startsWith("---\n")) {
    return null;
  }
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) {
    return null;
  }
  const frontmatter = content.slice(4, end);
  const values: Record<string, string> = {};
  for (const line of frontmatter.split(/\r?\n/)) {
    const match = line.match(/^([^:\r\n]+):\s*(.*)$/u);
    if (match) {
      values[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
    }
  }
  return values;
}

async function entryFrontmatter(vaultRoot: string, entry: ObsidianProjectionManifestEntry): Promise<Record<string, string> | null> {
  if (!entry.vaultPath.endsWith(".md")) {
    return null;
  }
  const fullPath = vaultFsPath(vaultRoot, entry.vaultPath);
  if (!(await fs.pathExists(fullPath))) {
    return null;
  }
  return readFrontmatter(await fs.readFile(fullPath, "utf8"));
}

async function entryMatchesShot(vaultRoot: string, entry: ObsidianProjectionManifestEntry, shotId: string): Promise<boolean> {
  if (pathMatchesShot(entry.vaultPath, shotId) || pathMatchesShot(entry.sourcePath, shotId)) {
    return true;
  }
  const frontmatter = await entryFrontmatter(vaultRoot, entry);
  return frontmatterValue(frontmatter ?? {}, "shotId") === shotId;
}

async function entryMatchesProperties(vaultRoot: string, entry: ObsidianProjectionManifestEntry, properties: CleanViewPropertyFilter[] | undefined): Promise<boolean> {
  if (!properties || properties.length === 0) {
    return true;
  }
  const frontmatter = await entryFrontmatter(vaultRoot, entry);
  if (!frontmatter) {
    return false;
  }
  return properties.every((property) => frontmatter[property.key] === property.value);
}

async function filterCleanableEntries(
  vaultRoot: string,
  entries: ObsidianProjectionManifestEntry[],
  filter: CleanViewFilter
): Promise<ObsidianProjectionManifestEntry[]> {
  const filtered: ObsidianProjectionManifestEntry[] = [];
  for (const entry of entries) {
    const kind = entryKind(entry);
    if (filter.kinds?.length && (!kind || !filter.kinds.includes(kind))) {
      continue;
    }
    if (filter.steps?.length && !filter.steps.some((step) => entryMatchesStep(entry, step))) {
      continue;
    }
    if (filter.shots?.length && !(await Promise.all(filter.shots.map((shot) => entryMatchesShot(vaultRoot, entry, shot)))).some(Boolean)) {
      continue;
    }
    if (filter.dirs?.length && !filter.dirs.some((dir) => entryMatchesDir(entry, dir))) {
      continue;
    }
    if (!(await entryMatchesProperties(vaultRoot, entry, filter.properties))) {
      continue;
    }
    filtered.push(entry);
  }
  return filtered;
}

function parentDirsForVaultPaths(vaultRoot: string, vaultPaths: string[]): string[] {
  const dirs = new Set<string>();
  for (const vaultPath of vaultPaths) {
    let current = path.dirname(vaultFsPath(vaultRoot, vaultPath));
    while (current.startsWith(vaultRoot) && current !== path.dirname(vaultRoot)) {
      dirs.add(current);
      if (current === vaultRoot) {
        break;
      }
      current = path.dirname(current);
    }
  }
  return [...dirs].sort((left, right) => right.length - left.length);
}

async function removeEmptyDirs(vaultRoot: string, vaultPaths: string[]): Promise<string[]> {
  const removed: string[] = [];
  for (const dir of parentDirsForVaultPaths(vaultRoot, vaultPaths)) {
    if (!(await fs.pathExists(dir))) {
      continue;
    }
    try {
      await fs.rmdir(dir);
      removed.push(path.relative(vaultRoot, dir).replace(/\\/g, "/") || ".");
    } catch {
      // Directory still contains user-authored or preserved files.
    }
  }
  return removed;
}

async function readCleanManifest(vaultRoot: string): Promise<ObsidianProjectionManifest> {
  try {
    return assertManifestShape(await readProjectionManifest(vaultRoot), vaultRoot);
  } catch (error) {
    if (error instanceof CliUserError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new CliUserError(`Cannot read Obsidian projection manifest: ${message}`);
  }
}

export async function cleanInProjectObsidianView({
  projectRoot,
  dryRun = false,
  filter
}: {
  projectRoot: string;
  dryRun?: boolean;
  filter?: CleanViewFilter;
}): Promise<CleanViewResult> {
  const resolvedProjectRoot = path.resolve(projectRoot);
  const normalizedFilter = normalizeCleanViewFilter(filter);
  await readWorkflowProjectConfig(resolvedProjectRoot);
  const vaultRoot = resolveInProjectObsidianView(resolvedProjectRoot);
  if (!(await fs.pathExists(vaultRoot))) {
    return {
      projectRoot: resolvedProjectRoot,
      vaultRoot,
      dryRun,
      filter: normalizedFilter,
      noOpReason: "Obsidian view does not exist",
      operations: [],
      preservedUntrackedFiles: [],
      removedEmptyDirs: [],
      manifestUpdated: false
    };
  }
  const stat = await fs.stat(vaultRoot);
  if (!stat.isDirectory()) {
    throw new CliUserError(`Obsidian view path must be a directory: ${vaultRoot}`);
  }
  if (await containsGitDirectory(vaultRoot)) {
    throw new CliUserError("Refusing to clean an Obsidian view containing .git");
  }

  const manifest = await readCleanManifest(vaultRoot);
  const activeFilter = hasActiveFilter(normalizedFilter);
  const allCleanableEntries = cleanableManifestEntries(manifest);
  const matchedEntries = activeFilter ? await filterCleanableEntries(vaultRoot, allCleanableEntries, normalizedFilter) : allCleanableEntries;
  const cleanablePaths = matchedEntries.map((entry) => entry.vaultPath);
  const allGeneratedPathSet = new Set([...allCleanableEntries.map((entry) => entry.vaultPath), projectionManifestPath]);
  const existingFiles = await listFiles(vaultRoot);
  const preservedUntrackedFiles = existingFiles.filter((file) => !allGeneratedPathSet.has(file));
  const operations: CleanViewOperation[] = [];

  if (!activeFilter) {
    cleanablePaths.push(projectionManifestPath);
  }

  if (activeFilter && cleanablePaths.length === 0) {
    return {
      projectRoot: resolvedProjectRoot,
      vaultRoot,
      dryRun,
      filter: normalizedFilter,
      noOpReason: "No generated files matched the clean filters",
      operations: [],
      preservedUntrackedFiles,
      removedEmptyDirs: [],
      manifestUpdated: false
    };
  }

  for (const vaultPath of cleanablePaths) {
    const fullPath = vaultFsPath(vaultRoot, vaultPath);
    if (!(await fs.pathExists(fullPath))) {
      operations.push({ status: "missing", vaultPath });
      continue;
    }
    operations.push({ status: dryRun ? "would-remove" : "removed", vaultPath });
    if (!dryRun) {
      await fs.remove(fullPath);
    }
  }

  const removedEmptyDirs = dryRun ? [] : await removeEmptyDirs(vaultRoot, cleanablePaths);
  let manifestUpdated = false;
  if (activeFilter && !dryRun) {
    const removedPathSet = new Set(matchedEntries.map((entry) => entry.vaultPath));
    const nextManifest: ObsidianProjectionManifest = {
      ...manifest,
      files: manifest.files.filter((entry) => !removedPathSet.has(entry.vaultPath))
    };
    await fs.writeFile(vaultFsPath(vaultRoot, projectionManifestPath), renderProjectionManifest(nextManifest), "utf8");
    manifestUpdated = true;
  }
  return {
    projectRoot: resolvedProjectRoot,
    vaultRoot,
    dryRun,
    filter: normalizedFilter,
    operations,
    preservedUntrackedFiles,
    removedEmptyDirs,
    manifestUpdated
  };
}

function formatCount(label: string, count: number): string {
  return `- ${label}: ${count}`;
}

function groupedOperationLines(operations: CleanViewOperation[]): string[] {
  const groups = new Map<CleanViewSummaryKind, string[]>();
  for (const operation of operations) {
    const kind = summaryKindForVaultPath(operation.vaultPath);
    groups.set(kind, [...(groups.get(kind) ?? []), operation.vaultPath]);
  }
  const lines = ["- matched generated files by type:"];
  const sortedGroups = [...groups.entries()].sort((left, right) => cleanViewKindLabels[left[0]].localeCompare(cleanViewKindLabels[right[0]]));
  for (const [kind, paths] of sortedGroups) {
    lines.push(`  - ${cleanViewKindLabels[kind]}: ${paths.length}`);
    for (const vaultPath of paths.slice(0, 5)) {
      lines.push(`    - ${vaultPath}`);
    }
    if (paths.length > 5) {
      lines.push(`    - ... ${paths.length - 5} more`);
    }
  }
  return lines;
}

function renderCleanViewNextCommand(result: CleanViewResult): string {
  return [
    "node apps/cli/dist/index.js",
    "clean-view",
    "--project",
    quoteCliArg(result.projectRoot),
    ...cleanViewFilterArgs(result.filter)
  ].join(" ");
}

export function renderCleanViewSummary(result: CleanViewResult): string {
  const lines = [
    result.dryRun ? "Obsidian view clean dry-run:" : "Obsidian view clean:",
    `- vault: ${result.vaultRoot}`
  ];
  if (hasActiveFilter(result.filter)) {
    lines.push("- filters:", ...renderFilterSummary(result.filter));
  }
  if (result.noOpReason) {
    lines.push(`- no-op: ${result.noOpReason}`);
    return lines.join("\n");
  }
  const wouldRemove = result.operations.filter((operation) => operation.status === "would-remove").length;
  const removed = result.operations.filter((operation) => operation.status === "removed").length;
  const missing = result.operations.filter((operation) => operation.status === "missing").length;
  lines.push(formatCount(result.dryRun ? "would remove generated files" : "removed generated files", result.dryRun ? wouldRemove : removed));
  lines.push(formatCount("missing manifest entries", missing));
  lines.push(formatCount("preserved untracked files", result.preservedUntrackedFiles.length));
  if (result.dryRun && wouldRemove > 0) {
    lines.push("- cleanup risk: low; only manifest-tracked generated files are targeted");
    lines.push("- boundary: source Step files and untracked notes are preserved");
    lines.push(...groupedOperationLines(result.operations.filter((operation) => operation.status === "would-remove")));
    lines.push(`- next command: ${renderCleanViewNextCommand(result)}`);
  }
  if (result.manifestUpdated) {
    lines.push("- manifest: updated for partial clean");
  }
  if (result.preservedUntrackedFiles.length > 0) {
    for (const file of result.preservedUntrackedFiles.slice(0, 5)) {
      lines.push(`  - ${file}`);
    }
    if (result.preservedUntrackedFiles.length > 5) {
      lines.push(`  - ... ${result.preservedUntrackedFiles.length - 5} more`);
    }
  }
  if (result.removedEmptyDirs.length > 0) {
    lines.push(formatCount("removed empty directories", result.removedEmptyDirs.length));
  }
  return lines.join("\n");
}

export function renderRebuildViewSummary(result: RebuildViewResult): string {
  const lines = [
    result.dryRun ? "Obsidian view rebuild dry-run:" : "Obsidian view rebuild:",
    `- project: ${result.projectRoot}`,
    `- vault: ${result.vaultRoot}`,
    `- ide: ${result.ide}`,
    `- sync: ${result.syncRan ? "ran" : result.syncPlanned ? "planned" : "skipped"}`,
    renderCleanViewSummary(result.clean),
    result.dryRun ? "Obsidian export dry-run operations against the current view:" : "Obsidian export operations:"
  ];
  const statuses = ["created", "updated", "unchanged", "skipped-user-modified", "skipped-user-config-existing", "orphaned-generated"] as const;
  for (const status of statuses) {
    lines.push(formatCount(status, result.exportResult.operations.filter((operation) => operation.status === status).length));
  }
  if (result.verificationIssues.length === 0) {
    lines.push(result.dryRun ? "- verification: skipped in dry-run" : "- verification: passed");
  } else {
    lines.push(`- verification issues: ${result.verificationIssues.length}`);
  }
  if (result.dryRun) {
    lines.push("- dry-run note: cleanup and export are previewed separately; no post-clean filesystem is simulated.");
  }
  return lines.join("\n");
}

export async function rebuildInProjectObsidianView(options: RebuildViewOptions): Promise<RebuildViewResult> {
  const projectRoot = path.resolve(options.projectRoot);
  const config = await readWorkflowProjectConfig(projectRoot);
  const ide = options.ide ?? config.ide;
  const vaultRoot = resolveInProjectObsidianView(projectRoot);
  const dryRun = options.dryRun === true;
  const syncPlanned = options.skipSync !== true;

  if (syncPlanned && !dryRun) {
    await syncProject({
      repoRoot: options.repoRoot,
      projectRoot,
      pack: config.pack,
      ide
    });
  }

  const clean = await cleanInProjectObsidianView({ projectRoot, dryRun, filter: options.filter });
  const exportResult = await exportObsidianVault({
    projectRoot,
    outRoot: vaultRoot,
    force: false,
    includePluginRecipes: options.includePluginRecipes !== false,
    includeObsidianUi: options.includeObsidianUi === true,
    dryRun,
    inProjectView: true
  });
  const verification = dryRun
    ? { ok: true, issues: [] }
    : await verifyObsidianVault({
        projectRoot,
        vaultRoot
      });
  if (!verification.ok) {
    const firstIssue = verification.issues[0];
    throw new CliUserError(`Obsidian view rebuild failed verification: ${firstIssue.code}: ${firstIssue.message}`);
  }
  return {
    projectRoot,
    vaultRoot,
    ide,
    dryRun,
    syncPlanned,
    syncRan: syncPlanned && !dryRun,
    clean,
    exportResult,
    verificationIssues: verification.issues
  };
}
