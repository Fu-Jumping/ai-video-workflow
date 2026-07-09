import { input, select } from "@inquirer/prompts";
import { Command } from "commander";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_PACK, SUPPORTED_IDES, SUPPORTED_PLATFORMS } from "./lib/constants.js";
import { diagnoseProject } from "./lib/doctor.js";
import { createProject } from "./lib/init.js";
import { createPackScaffold } from "./lib/new-pack.js";
import { exportObsidianVault } from "./lib/obsidian/export.js";
import type { ObsidianExportOperationStatus } from "./lib/obsidian/types.js";
import { verifyObsidianVault } from "./lib/obsidian/verify.js";
import { resolveRepoRoot } from "./lib/paths.js";
import { syncProject } from "./lib/sync.js";
import { verifyProject } from "./lib/verify.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

const program = new Command();
program.name("ai-video-workflow").description("AI video workflow CLI");

const obsidianOperationStatuses: ObsidianExportOperationStatus[] = [
  "created",
  "updated",
  "unchanged",
  "skipped-user-modified",
  "skipped-user-config-existing",
  "orphaned-generated"
];

function parseChoice<T extends string>(value: string | undefined, allowed: readonly T[], label: string): T | undefined {
  if (value === undefined) {
    return undefined;
  }
  if ((allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  throw new Error(`Invalid ${label}: ${value}. Expected one of: ${allowed.join(", ")}`);
}

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
  .action(async (options) => {
    const parsedIde = parseChoice(options.ide, SUPPORTED_IDES, "AI IDE");
    const parsedImagePlatform = parseChoice(options.image, SUPPORTED_PLATFORMS, "image platform");
    const parsedVideoPlatform = parseChoice(options.video, SUPPORTED_PLATFORMS, "video platform");

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
    await createProject({
      targetRoot: process.cwd(),
      projectName,
      pack: DEFAULT_PACK,
      ide,
      imagePlatform,
      videoPlatform
    });
    console.log(`Created ${projectName}`);
  });

program
  .command("sync")
  .description("Sync pack runtime files into a project")
  .requiredOption("--project <path>")
  .requiredOption("--ide <ide>")
  .action(async (options) => {
    await syncProject({
      repoRoot: resolveRepoRoot(moduleDir),
      projectRoot: path.resolve(options.project),
      pack: DEFAULT_PACK,
      ide: options.ide
    });
    console.log("Sync complete");
  });

program
  .command("verify")
  .description("Verify project structure and workflow contracts")
  .requiredOption("--project <path>")
  .requiredOption("--ide <ide>")
  .action(async (options) => {
    const result = await verifyProject({
      projectRoot: path.resolve(options.project),
      ide: options.ide,
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
  });

program
  .command("doctor")
  .description("Diagnose project verification failures")
  .requiredOption("--project <path>")
  .requiredOption("--ide <ide>")
  .action(async (options) => {
    const result = await verifyProject({
      projectRoot: path.resolve(options.project),
      ide: options.ide,
      pack: DEFAULT_PACK
    });
    console.log(await diagnoseProject({ issues: result.issues }));
    if (!result.ok) {
      process.exitCode = 1;
    }
  });

program
  .command("export-obsidian")
  .description("Export a project into an Obsidian vault projection")
  .requiredOption("--project <path>")
  .requiredOption("--out <path>")
  .option("--force", "Overwrite the output directory if it already contains files", false)
  .option("--dry-run", "Print planned Obsidian export operations without writing files", false)
  .option("--include-obsidian-ui", "Include optional Obsidian UI suggestion files without overwriting existing user config", false)
  .option("--no-plugin-recipes", "Skip optional community plugin recipe notes")
  .action(async (options) => {
    const result = await exportObsidianVault({
      projectRoot: path.resolve(options.project),
      outRoot: path.resolve(options.out),
      force: options.force,
      includePluginRecipes: options.pluginRecipes,
      includeObsidianUi: options.includeObsidianUi,
      dryRun: options.dryRun
    });
    console.log(formatObsidianExportSummary(result));
    if (options.dryRun) {
      console.log(`Dry run complete for Obsidian vault projection at ${result.vaultRoot}; no files were written.`);
    } else {
      console.log(`Exported Obsidian vault projection to ${result.vaultRoot}`);
    }
  });

program
  .command("verify-obsidian")
  .description("Verify an Obsidian vault projection")
  .requiredOption("--project <path>")
  .requiredOption("--vault <path>")
  .action(async (options) => {
    const result = await verifyObsidianVault({
      projectRoot: path.resolve(options.project),
      vaultRoot: path.resolve(options.vault)
    });
    if (!result.ok) {
      for (const issue of result.issues) {
        console.error(`- ${issue.code}: ${issue.message}${issue.path ? ` (${issue.path})` : ""}`);
      }
      process.exitCode = 1;
      return;
    }
    console.log("Obsidian projection verification passed");
  });

program
  .command("new-pack")
  .description("Create a workflow pack scaffold")
  .requiredOption("--name <name>")
  .action(async (options) => {
    await createPackScaffold({
      targetRoot: process.cwd(),
      packName: options.name
    });
    console.log(`Created pack scaffold ${options.name}`);
  });

await program.parseAsync(process.argv);
