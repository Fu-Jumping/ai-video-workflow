import { input, select } from "@inquirer/prompts";
import { Command } from "commander";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_PACK, SUPPORTED_IDES, SUPPORTED_PLATFORMS } from "./lib/constants.js";
import { diagnoseProject } from "./lib/doctor.js";
import { createProject, renderInitNextSteps } from "./lib/init.js";
import { runCliAction } from "./lib/cli-errors.js";
import { parseIde, parsePlatform } from "./lib/cli-options.js";
import { buildMcpContext } from "./lib/mcp/context.js";
import { startMcpServer } from "./lib/mcp/server.js";
import { createPackScaffold } from "./lib/new-pack.js";
import { exportObsidianVault } from "./lib/obsidian/export.js";
import type { ObsidianExportOperationStatus } from "./lib/obsidian/types.js";
import { verifyObsidianVault } from "./lib/obsidian/verify.js";
import { resolveRepoRoot } from "./lib/paths.js";
import { syncProject } from "./lib/sync.js";
import { verifyProject } from "./lib/verify.js";
import { assertSingleObsidianTarget, resolveInProjectObsidianView } from "./lib/view-layer.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

const program = new Command();
program.name("ai-video-workflow").description("AI video workflow CLI");
program.option("--debug", "Print internal stack traces for CLI errors", false);

const obsidianOperationStatuses: ObsidianExportOperationStatus[] = [
  "created",
  "updated",
  "unchanged",
  "skipped-user-modified",
  "skipped-user-config-existing",
  "orphaned-generated"
];

function formatObsidianExportSummary(result: Awaited<ReturnType<typeof exportObsidianVault>>): string {
  const lines = ["Obsidian export operations:"];
  for (const status of obsidianOperationStatuses) {
    const matching = result.operations.filter((operation) => operation.status === status);
    lines.push(`- ${status}: ${matching.length}`);
    for (const operation of matching.slice(0, 5)) {
      lines.push(`  - ${operation.vaultPath}${operation.reason ? ` (${operation.reason})` : ""}`);
    }
    if (matching.length > 5) {
      lines.push(`  - ... ${matching.length - 5} more`);
    }
  }
  return lines.join("\n");
}

program
  .command("init")
  .description("Create a project with the official AI video workflow starter")
  .option("--name <name>", "Project directory name")
  .option("--ide <ide>", "AI IDE target")
  .option("--image <platform>", "Default image platform")
  .option("--video <platform>", "Default video platform")
  .action((options) => runCliAction(async () => {
    const parsedIde = parseIde(options.ide);
    const parsedImagePlatform = parsePlatform(options.image, "image platform");
    const parsedVideoPlatform = parsePlatform(options.video, "video platform");

    const projectName = options.name ?? (await input({ message: "Project directory name", default: "my-ai-video-project" }));
    const ide =
      parsedIde ??
      (await select({
        message: "Choose an AI IDE",
        choices: SUPPORTED_IDES.map((value) => ({ name: value, value }))
      }));
    const imagePlatform =
      parsedImagePlatform ??
      (await select({
        message: "Choose the default image platform",
        choices: SUPPORTED_PLATFORMS.map((value) => ({ name: value, value }))
      }));
    const videoPlatform =
      parsedVideoPlatform ??
      (await select({
        message: "Choose the default video platform",
        choices: SUPPORTED_PLATFORMS.map((value) => ({ name: value, value }))
      }));
    const projectRoot = await createProject({
      targetRoot: process.cwd(),
      projectName,
      pack: DEFAULT_PACK,
      ide,
      imagePlatform,
      videoPlatform
    });
    console.log(renderInitNextSteps({ projectName, projectRoot, ide }));
  }, () => program.opts<{ debug?: boolean }>().debug === true));

program
  .command("sync")
  .description("Sync pack runtime files into a project")
  .requiredOption("--project <path>")
  .requiredOption("--ide <ide>")
  .action((options) => runCliAction(async () => {
    const ide = parseIde(options.ide);
    if (!ide) {
      throw new Error("Missing --ide");
    }
    await syncProject({
      repoRoot: resolveRepoRoot(moduleDir),
      projectRoot: path.resolve(options.project),
      pack: DEFAULT_PACK,
      ide
    });
    console.log("Sync complete");
  }, () => program.opts<{ debug?: boolean }>().debug === true));

program
  .command("verify")
  .description("Verify project structure and workflow contracts")
  .requiredOption("--project <path>")
  .requiredOption("--ide <ide>")
  .action((options) => runCliAction(async () => {
    const ide = parseIde(options.ide);
    if (!ide) {
      throw new Error("Missing --ide");
    }
    const result = await verifyProject({
      projectRoot: path.resolve(options.project),
      ide,
      pack: DEFAULT_PACK
    });
    if (!result.ok) {
      for (const issue of result.issues) {
        console.error(`- ${issue.code}: ${issue.message}${issue.path ? ` (${issue.path})` : ""}`);
      }
      process.exitCode = 1;
      return;
    }
    console.log("Verification passed");
  }, () => program.opts<{ debug?: boolean }>().debug === true));

program
  .command("doctor")
  .description("Diagnose project verification failures")
  .requiredOption("--project <path>")
  .requiredOption("--ide <ide>")
  .action((options) => runCliAction(async () => {
    const ide = parseIde(options.ide);
    if (!ide) {
      throw new Error("Missing --ide");
    }
    const result = await verifyProject({
      projectRoot: path.resolve(options.project),
      ide,
      pack: DEFAULT_PACK
    });
    console.log(await diagnoseProject({ issues: result.issues }));
    if (!result.ok) {
      process.exitCode = 1;
    }
  }, () => program.opts<{ debug?: boolean }>().debug === true));

program
  .command("mcp-context")
  .description("Print read-only MCP project context as JSON")
  .requiredOption("--project <path>")
  .action((options) => runCliAction(async () => {
    const context = await buildMcpContext({
      projectRoot: path.resolve(options.project),
      pack: DEFAULT_PACK
    });
    console.log(JSON.stringify(context, null, 2));
  }, () => program.opts<{ debug?: boolean }>().debug === true));

program
  .command("mcp-server")
  .description("Start a read-only MCP stdio server for a project")
  .requiredOption("--project <path>")
  .action((options) => runCliAction(async () => {
    await startMcpServer({
      projectRoot: path.resolve(options.project),
      pack: DEFAULT_PACK,
      ide: "codex"
    });
  }, () => program.opts<{ debug?: boolean }>().debug === true));

program
  .command("export-obsidian")
  .description("Export a project into an Obsidian vault projection")
  .requiredOption("--project <path>")
  .option("--out <path>")
  .option("--in-project-view", "Use <project>/_views/obsidian as the Obsidian vault projection", false)
  .option("--force", "Overwrite the output directory if it already contains files", false)
  .option("--dry-run", "Print planned Obsidian export operations without writing files", false)
  .option("--include-obsidian-ui", "Include optional Obsidian UI suggestion files without overwriting existing user config", false)
  .option("--no-plugin-recipes", "Skip optional community plugin recipe notes")
  .action((options) => runCliAction(async () => {
    assertSingleObsidianTarget({
      outRoot: options.out,
      inProjectView: options.inProjectView,
      targetLabel: "--out"
    });
    const projectRoot = path.resolve(options.project);
    const outRoot = options.inProjectView ? resolveInProjectObsidianView(projectRoot) : path.resolve(options.out);
    const result = await exportObsidianVault({
      projectRoot,
      outRoot,
      force: options.force,
      includePluginRecipes: options.pluginRecipes,
      includeObsidianUi: options.includeObsidianUi,
      dryRun: options.dryRun,
      inProjectView: options.inProjectView
    });
    console.log(formatObsidianExportSummary(result));
    if (options.dryRun) {
      console.log(`Dry run complete for Obsidian vault projection at ${result.vaultRoot}; no files were written.`);
    } else {
      console.log(`Exported Obsidian vault projection to ${result.vaultRoot}`);
    }
  }, () => program.opts<{ debug?: boolean }>().debug === true));

program
  .command("verify-obsidian")
  .description("Verify an Obsidian vault projection")
  .requiredOption("--project <path>")
  .option("--vault <path>")
  .option("--in-project-view", "Use <project>/_views/obsidian as the Obsidian vault projection", false)
  .action((options) => runCliAction(async () => {
    assertSingleObsidianTarget({
      outRoot: options.vault,
      inProjectView: options.inProjectView,
      targetLabel: "--vault"
    });
    const projectRoot = path.resolve(options.project);
    const vaultRoot = options.inProjectView ? resolveInProjectObsidianView(projectRoot) : path.resolve(options.vault);
    const result = await verifyObsidianVault({
      projectRoot,
      vaultRoot
    });
    if (!result.ok) {
      for (const issue of result.issues) {
        console.error(`- ${issue.code}: ${issue.message}${issue.path ? ` (${issue.path})` : ""}`);
      }
      process.exitCode = 1;
      return;
    }
    console.log("Obsidian projection verification passed");
  }, () => program.opts<{ debug?: boolean }>().debug === true));

program
  .command("new-pack")
  .description("Create a workflow pack scaffold")
  .requiredOption("--name <name>")
  .action((options) => runCliAction(async () => {
    await createPackScaffold({
      targetRoot: process.cwd(),
      packName: options.name
    });
    console.log(`Created pack scaffold ${options.name}`);
  }, () => program.opts<{ debug?: boolean }>().debug === true));

await program.parseAsync(process.argv);
