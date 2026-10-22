import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { CONTENT_FORMAT_VERSION, MIGRATED_SNAPSHOT_DIRECTORY } from "../src/lib/constants.js";
import { createProject } from "../src/lib/init.js";
import { contentFormatVersion, isSupportedContentFormatVersion, readProjectConfig } from "../src/lib/project-config.js";
import { syncProject } from "../src/lib/sync.js";
import { verifyProject } from "../src/lib/verify.js";

const tempRoots: string[] = [];
const repoRoot = path.resolve(__dirname, "../../..");

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.remove(dir)));
});

async function createProjectRoot(name: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "avw-content-format-"));
  tempRoots.push(root);
  await createProject({
    targetRoot: root,
    projectName: name,
    pack: "official-ai-video",
    ide: "codex",
    imagePlatform: "openai",
    videoPlatform: "seedance"
  });
  const projectRoot = path.join(root, name);
  await syncProject({ repoRoot, projectRoot, ide: "codex", pack: "official-ai-video" });
  return projectRoot;
}

async function rewriteConfig(projectRoot: string, mutate: (config: Record<string, unknown>) => void): Promise<void> {
  const { parseYaml, stringifyYaml } = await import("../src/lib/yaml.js");
  const configPath = path.join(projectRoot, "project.config.yaml");
  const parsed = parseYaml<Record<string, unknown>>(await fs.readFile(configPath, "utf8"));
  mutate(parsed);
  await fs.writeFile(configPath, stringifyYaml(parsed), "utf8");
}

describe("内容树格式版本", () => {
  test("新建项目在配置里写下格式版本", async () => {
    const projectRoot = await createProjectRoot("version-written");
    const raw = await fs.readFile(path.join(projectRoot, "project.config.yaml"), "utf8");
    expect(raw).toContain("format_version: " + String(CONTENT_FORMAT_VERSION));
    const { config, issues } = await readProjectConfig(projectRoot);
    expect(issues).toEqual([]);
    expect(contentFormatVersion(config)).toBe(CONTENT_FORMAT_VERSION);
  });

  test("缺这个键的旧项目按旧格式读取且不报错", async () => {
    const projectRoot = await createProjectRoot("legacy-project");
    await rewriteConfig(projectRoot, (config) => {
      delete config.content;
    });
    const { config, issues } = await readProjectConfig(projectRoot);
    expect(issues).toEqual([]);
    expect(contentFormatVersion(config)).toBeNull();
    expect(isSupportedContentFormatVersion(contentFormatVersion(config))).toBe(true);
    const result = await verifyProject({ projectRoot, ide: "codex" });
    expect(result.issues.map((issue) => issue.code)).not.toContain("unsupported-content-format");
  });

  test("声明了不认识的版本时校验报错并说清怎么处理", async () => {
    const projectRoot = await createProjectRoot("future-format");
    await rewriteConfig(projectRoot, (config) => {
      config.content = { format_version: 99 };
    });
    const { config, issues } = await readProjectConfig(projectRoot);
    expect(issues).toEqual([]);
    expect(contentFormatVersion(config)).toBe(99);
    expect(isSupportedContentFormatVersion(99)).toBe(false);
    const result = await verifyProject({ projectRoot, ide: "codex" });
    const issue = result.issues.find((candidate) => candidate.code === "unsupported-content-format");
    expect(issue).toBeDefined();
    expect(issue?.path).toBe("project.config.yaml");
    expect(issue?.message).toContain("99");
  });

  test("格式版本写成非整数时按配置无效处理", async () => {
    const projectRoot = await createProjectRoot("bad-format");
    await rewriteConfig(projectRoot, (config) => {
      config.content = { format_version: 1.5 };
    });
    const { config, issues } = await readProjectConfig(projectRoot);
    expect(config).toBeNull();
    expect(issues.map((issue) => issue.code)).toContain("invalid-project-config");
  });

  test("迁移快照目录里的旧文件不参与当前内容的链接检查", async () => {
    const projectRoot = await createProjectRoot("snapshot-ignored");
    const snapshotDir = path.join(projectRoot, MIGRATED_SNAPSHOT_DIRECTORY, "03_分镜脚本");
    await fs.ensureDir(snapshotDir);
    await fs.writeFile(
      path.join(snapshotDir, "旧镜头-001.md"),
      "# 旧镜头 001\n\n这条链接指向一个不存在的文件：[断链](不存在的文件.md)\n",
      "utf8"
    );
    const result = await verifyProject({ projectRoot, ide: "codex" });
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).not.toContain("broken-markdown-link");
  });
});
