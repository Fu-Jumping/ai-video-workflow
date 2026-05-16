import { input, select } from "@inquirer/prompts";
import { Command } from "commander";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_PACK, SUPPORTED_IDES, SUPPORTED_PLATFORMS } from "./lib/constants.js";
import { diagnoseProject } from "./lib/doctor.js";
import { createProject } from "./lib/init.js";
import { createPackScaffold } from "./lib/new-pack.js";
import { resolveRepoRoot } from "./lib/paths.js";
import { syncProject } from "./lib/sync.js";
import { verifyProject } from "./lib/verify.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

const program = new Command();
program.name("ai-video-workflow").description("AI video workflow CLI");

program
  .command("init")
  .description("Create a project with the official AI video workflow starter")
  .action(async () => {
    const projectName = await input({ message: "Project directory name", default: "my-ai-video-project" });
    const ide = await select({
      message: "Choose an AI IDE",
      choices: SUPPORTED_IDES.map((value) => ({ name: value, value }))
    });
    const imagePlatform = await select({
      message: "Choose the default image platform",
      choices: SUPPORTED_PLATFORMS.map((value) => ({ name: value, value }))
    });
    const videoPlatform = await select({
      message: "Choose the default video platform",
      choices: SUPPORTED_PLATFORMS.map((value) => ({ name: value, value }))
    });
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
