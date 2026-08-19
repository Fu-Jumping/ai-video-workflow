import fs from "fs-extra";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_PACK, DEFAULT_VIDEO_PLATFORM, STEP0_FILES, STEP6_FILES, STEP7_FILES, STEP_DIR_BY_NUMBER, STORY_KERNEL_FILE, activeStepDirs } from "./constants.js";
import { CliUserError } from "./cli-errors.js";
import { copyDirectory } from "./fs-utils.js";
import { validateSafeDirectoryName } from "./name-validation.js";
import { packRootExists, resolvePackRoot, resolveRepoRoot } from "./paths.js";
import { assertCanInitializeProject } from "./project-root.js";
import { sharedAgentDocsReadmePath } from "./agent-workspace.js";
import { syncProject } from "./sync.js";
import type { CreateProjectOptions, ProjectConfig, StartFromMode } from "./types.js";
import { stringifyYaml } from "./yaml.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

function normalizeStartFrom(startFrom: StartFromMode | undefined): StartFromMode {
  return startFrom ?? "research";
}

// Pack templates are authoritative over the starter skeleton: write them even if the starter
// already provided the same file, so a custom pack can override individual templates.
async function writeSeededFile(filePath: string, content: string): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
}

async function readPackTemplate(repoRoot: string, pack: string, templateRelPath: string): Promise<string> {
  const customPath = path.join(resolvePackRoot(repoRoot, pack), "templates", templateRelPath);
  if (await fs.pathExists(customPath)) {
    return fs.readFile(customPath, "utf8");
  }
  // A partial custom pack may override only some templates; fall back to the official pack for
  // anything it does not provide so a custom-pack project still seeds a working skeleton.
  const officialPath = path.join(resolvePackRoot(repoRoot, DEFAULT_PACK), "templates", templateRelPath);
  return fs.readFile(officialPath, "utf8");
}

async function seedProjectDirectories(repoRoot: string, projectRoot: string, startFrom: StartFromMode, pack: string): Promise<void> {
  const config: ProjectConfig = {
    pack: "official-ai-video",
    ide: "codex",
    platforms: {
      image: { default: "openai" },
      video: { default: DEFAULT_VIDEO_PLATFORM }
    },
    workflow: {
      research_step: {
        enabled: startFrom === "research"
      },
      enhanced_flow: {
        enabled: true
      }
    }
  };
  for (const dir of activeStepDirs(config)) {
    await fs.ensureDir(path.join(projectRoot, dir));
  }
  for (const step of [3, 4, 5]) {
    await fs.ensureDir(path.join(projectRoot, STEP_DIR_BY_NUMBER[step], "镜头组-001"));
  }
  await writeSeededFile(
    path.join(projectRoot, STEP_DIR_BY_NUMBER[3], "镜头组-001", "00_镜头组说明.md"),
    await readPackTemplate(repoRoot, pack, path.join("03_分镜脚本", "镜头组说明.md"))
  );
  // Step 2 世界设定 templates are seeded directly: the character/scene setting files are the
  // deliverables themselves, filled in place rather than copied per shot.
  for (const file of ["角色设定.md", "场景设定.md"]) {
    await writeSeededFile(
      path.join(projectRoot, STEP_DIR_BY_NUMBER[2], file),
      await readPackTemplate(repoRoot, pack, path.join("02_世界设定", file))
    );
  }
  // Step 4/5 templates are seeded inside the first shot group as ready-to-copy references for
  // each per-shot prompt file. Both templates satisfy the Step 4/5 contracts, so a freshly
  // initialized project still passes `verify`.
  await writeSeededFile(
    path.join(projectRoot, STEP_DIR_BY_NUMBER[4], "镜头组-001", "图片提示词.md"),
    await readPackTemplate(repoRoot, pack, path.join("04_图片提示词", "图片提示词.md"))
  );
  await writeSeededFile(
    path.join(projectRoot, STEP_DIR_BY_NUMBER[5], "镜头组-001", "视频提示词.md"),
    await readPackTemplate(repoRoot, pack, path.join("05_视频提示词", "视频提示词.md"))
  );
  if (startFrom === "research") {
    for (const file of STEP0_FILES) {
      await writeSeededFile(
        path.join(projectRoot, "00_前期研究", file),
        await readPackTemplate(repoRoot, pack, path.join("00_前期研究", file))
      );
    }
  }
  await writeSeededFile(
    path.join(projectRoot, "01_概念策划", STORY_KERNEL_FILE),
    await readPackTemplate(repoRoot, pack, path.join("01_概念策划", STORY_KERNEL_FILE))
  );
  for (const file of STEP6_FILES) {
    await writeSeededFile(
      path.join(projectRoot, "06_执行计划", file),
      await readPackTemplate(repoRoot, pack, path.join("06_执行计划", file))
    );
  }
  for (const file of STEP7_FILES) {
    await writeSeededFile(
      path.join(projectRoot, "07_发布物料", file),
      await readPackTemplate(repoRoot, pack, path.join("07_发布物料", file))
    );
  }
}

async function writeProjectConfig(projectRoot: string, options: CreateProjectOptions): Promise<void> {
  const startFrom = normalizeStartFrom(options.startFrom);
  const config: ProjectConfig = {
    pack: options.pack,
    ide: options.ide,
    platforms: {
      image: { default: options.imagePlatform },
      video: { default: options.videoPlatform }
    },
    workflow: {
      research_step: {
        enabled: startFrom === "research"
      },
      enhanced_flow: {
        enabled: true
      }
    }
  };
  await fs.writeFile(path.join(projectRoot, "project.config.yaml"), stringifyYaml(config), "utf8");
}

async function seedStarterFiles(repoRoot: string, projectRoot: string, pack: string): Promise<void> {
  const customStarter = path.join(resolvePackRoot(repoRoot, pack), "starters", "solo-director-project");
  const starterRoot = (await fs.pathExists(customStarter))
    ? customStarter
    : path.join(resolvePackRoot(repoRoot, DEFAULT_PACK), "starters", "solo-director-project");
  await copyDirectory(starterRoot, projectRoot);
}

function renderProjectReadme(projectName: string, ide: string, startFrom: StartFromMode): string {
  const startPath = startFrom === "research" ? "00_前期研究/00_研究总览.md" : "01_概念策划/故事内核.md";
  const startLabel = startFrom === "research" ? "前期研究与资料整理" : "创作策划";
  return [
    `# ${projectName}`,
    "",
    "这是一个由 `ai-video-workflow` 生成的 AI 视频创作项目，不是 `ai-video-workflow` 工具仓库本身。",
    "",
    "## 从这里开始",
    "",
    "1. 请在你的 AI 智能体中打开这个项目目录。",
    `2. 让智能体先读取 \`AGENTS.md\` 和 \`${sharedAgentDocsReadmePath}\`。`,
    `3. 从 \`${startPath}\` 开始补全${startLabel}。`,
    startFrom === "research" ? "4. 以步骤零到步骤六的源文件作为事实源。" : "4. 以步骤一到步骤六的源文件作为事实源。",
    "",
    "## 常用命令",
    "",
    "```powershell",
    `ai-video-workflow verify --project . --ide ${ide}`,
    "ai-video-workflow export-obsidian --project . --in-project-view",
    "ai-video-workflow verify-obsidian --project . --in-project-view",
    "```",
    "",
    "## Obsidian 边界",
    "",
    "如果使用 Obsidian，请把 `_views/obsidian/` 作为 vault 打开。不要把这个项目根目录本身当作 Obsidian vault。",
    "",
    "外部 vault 模式仍可使用：`ai-video-workflow export-obsidian --project . --out <vault-path>`。",
    ""
  ].join("\n");
}

export function renderInitNextSteps({
  projectName,
  projectRoot,
  ide,
  startFrom = "research"
}: {
  projectName: string;
  projectRoot: string;
  ide: string;
  startFrom?: StartFromMode;
}): string {
  const quotedProjectRoot = projectRoot.includes(" ") ? `"${projectRoot}"` : projectRoot;
  const startPath = startFrom === "research" ? "00_前期研究/00_研究总览.md" : "01_概念策划/故事内核.md";
  return [
    `已创建项目：${projectName}`,
    `项目路径：${projectRoot}`,
    "",
    "请在智能体中打开这个目录：",
    projectRoot,
    "",
    "可以复制给智能体的第一句话：",
    `我想继续处理这个 ai-video-workflow 创作项目。请先读取 AGENTS.md 和 ${sharedAgentDocsReadmePath}，然后带我从 ${startPath} 开始。不要把 _views/obsidian 或 IDE 运行镜像当作源文件。`,
    "",
    "校验项目：",
    `ai-video-workflow verify --project ${quotedProjectRoot} --ide ${ide}`,
    "",
    "可选的 Obsidian 观看层：",
    `ai-video-workflow export-obsidian --project ${quotedProjectRoot} --in-project-view`,
    `ai-video-workflow verify-obsidian --project ${quotedProjectRoot} --in-project-view`
  ].join("\n");
}

export async function createProject(options: CreateProjectOptions): Promise<string> {
  const startFrom = normalizeStartFrom(options.startFrom);
  const projectName = validateSafeDirectoryName(options.projectName, "Project name");
  const projectRoot = await assertCanInitializeProject(options.targetRoot, projectName);
  const repoRoot = resolveRepoRoot(moduleDir);
  if (!packRootExists(repoRoot, options.pack)) {
    throw new CliUserError(`Pack not found: ${options.pack} (expected at ${path.join(repoRoot, "packs", options.pack)}).`);
  }
  await fs.ensureDir(projectRoot);
  await seedStarterFiles(repoRoot, projectRoot, options.pack);
  await seedProjectDirectories(repoRoot, projectRoot, startFrom, options.pack);
  await writeProjectConfig(projectRoot, options);
  await fs.writeFile(path.join(projectRoot, "README.md"), renderProjectReadme(projectName, options.ide, startFrom), "utf8");
  await syncProject({
    repoRoot,
    projectRoot,
    ide: options.ide,
    pack: options.pack
  });
  return projectRoot;
}
