import type { Command } from "commander";
import path from "node:path";
import { runCliAction } from "../cli-errors.js";
import { requireLibTvCredentials } from "./credentials.js";
import { LibTvApiClient } from "./api.js";
import { HttpLibTvBackend } from "./http-backend.js";
import { MockLibTvBackend } from "./mock-backend.js";
import type { LibTvBackend } from "./backend.js";
import { readBinding, resolveProjectRoot, writeBinding, clearBinding, writeGroupBinding, clearGroupBinding, readState, writeState } from "./project-binding.js";
import { buildLibTvPlan } from "./assets.js";
import { renderPlan } from "./plan.js";
import { applyPlan, renderApplySummary } from "./apply.js";
import { buildStatus, renderStatus } from "./status.js";
import { verifyLibtvProject, renderVerifyIssues } from "./verify.js";

function getAncestorOption(command: Command, key: string): unknown {
  let current: Command | null | undefined = command;
  while (current) {
    const opts = current.opts() as Record<string, unknown>;
    if (opts[key] !== undefined) return opts[key];
    current = current.parent;
  }
  return undefined;
}

async function backendWithCredentials(command: Command): Promise<LibTvBackend> {
  if (getAncestorOption(command, "mock") === true) {
    return new MockLibTvBackend();
  }
  const credentials = await requireLibTvCredentials();
  const baseUrl = getAncestorOption(command, "baseUrl") as string | undefined;
  return new HttpLibTvBackend(new LibTvApiClient({ baseUrl, credentials }));
}

function renderProjectList(projects: Array<{ uuid: string; name: string; id?: number }>): string {
  return projects.map((project) => `${project.uuid}\t${project.name}`).join("\n");
}


function collect(value: string, previous: string[] | undefined): string[] {
  return [...(previous ?? []), value];
}

function parsePair(pair: string): [string, unknown] {
  const index = pair.indexOf("=");
  if (index === -1) return [pair.trim(), true];
  const key = pair.slice(0, index).trim();
  const raw = pair.slice(index + 1).trim();
  if (raw === "true") return [key, true];
  if (raw === "false") return [key, false];
  if (/^-?\d+$/.test(raw)) return [key, Number.parseInt(raw, 10)];
  if (/^-?\d*\.\d+$/.test(raw)) return [key, Number.parseFloat(raw)];
  try {
    return [key, JSON.parse(raw)];
  } catch {
    return [key, raw];
  }
}

function parsePairs(pairs: string[] | undefined): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const pair of pairs ?? []) {
    const [key, value] = parsePair(pair);
    result[key] = value;
  }
  return result;
}

function getOption(command: Command, key: string): unknown {
  return getAncestorOption(command, key);
}

function inferMediaKind(filePath: string): "image" | "video" | "audio" {
  const ext = path.extname(filePath).toLowerCase();
  if ([".mp4", ".mov", ".mkv", ".webm", ".avi", ".flv"].includes(ext)) return "video";
  if ([".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a"].includes(ext)) return "audio";
  return "image";
}
export function registerLibTvCommands(program: Command): void {
  const libtv = program
    .command("libtv")
    .description("LibTV 素材适配层：上传、引用、图片/视频生成")
    .option("--mock", "Use in-memory mock backend for dry runs and tests", false)
    .option("--base-url <url>", "LibTV account API base URL (default LIBTV_API_BASE_URL or https://api2.liblib.art); canvas API uses LIBTV_CANVAS_API_BASE_URL or https://api.liblib.tv)");

  const login = libtv.command("login").description("登录：浏览器（web）或手机验证码");
  login
    .command("web")
    .description("浏览器登录（需要本机回调服务；HTTP API 契约待验证）")
    .option("--open", "尝试用系统默认浏览器打开登录链接", false)
    .action((options, command) => runCliAction(async () => {
      throw new Error("libtv login web 尚未实现：需要 LibTV 网页登录回调接口。");
    }, () => getAncestorOption(command, "debug") === true));

  login
    .command("phone")
    .description("手机登录：发短信、验证码两步")
    .requiredOption("-p, --phone <phone>", "11 位中国大陆手机号")
    .option("-c, --code <code>", "短信中 6 位数字验证码")
    .option("--captcha <captcha-payload>", "人机验证返回串")
    .action((options, command) => runCliAction(async () => {
      const backend = await backendWithCredentials(command);
      if (options.code) {
        await backend.listAccounts();
        console.log("手机验证码登录：HTTP API 契约待验证");
      } else {
        await backend.listAccounts();
        console.log(`已向 ${options.phone} 发送验证码（HTTP API 契约待验证）`);
      }
    }, () => getAncestorOption(command, "debug") === true));

  libtv
    .command("logout")
    .description("退出登录：删除凭据文件")
    .action((_options, command) => runCliAction(async () => {
      const { libTvCredentialsPath } = await import("./credentials.js");
      const fs = await import("fs-extra");
      await fs.remove(libTvCredentialsPath());
      console.log("已删除本机 LibTV 凭据文件");
    }, () => getAncestorOption(command, "debug") === true));

  const account = libtv.command("account").description("多账户：查看当前账户信息、列出可切换账户、切换生效账户");
  account
    .command("info")
    .description("当前账号信息")
    .action((_options, command) => runCliAction(async () => {
      const backend = await backendWithCredentials(command);
      console.log(JSON.stringify(await backend.getAccountInfo(), null, 2));
    }, () => getAncestorOption(command, "debug") === true));

  account
    .command("list")
    .alias("ls")
    .description("账户列表")
    .action((_options, command) => runCliAction(async () => {
      const backend = await backendWithCredentials(command);
      console.log(JSON.stringify(await backend.listAccounts(), null, 2));
    }, () => getAncestorOption(command, "debug") === true));

  account
    .command("use")
    .argument("<account>", "accountId 或 accountName")
    .description("切换当前生效账户")
    .action((accountRef, _options, command) => runCliAction(async () => {
      const backend = await backendWithCredentials(command);
      const numeric = Number(accountRef);
      const result = await backend.activateAccount(Number.isFinite(numeric) ? numeric : accountRef);
      console.log(JSON.stringify(result, null, 2));
    }, () => getAncestorOption(command, "debug") === true));

  const project = libtv.command("project").description("画布项目：新建、列表、更新、删除、本地绑定(use/unuse)、画布摘要");
  project
    .command("create")
    .argument("<project>", "项目名称")
    .option("-d, --description <text>", "项目简介")
    .option("--cover-url <url>", "封面图链接")
    .option("-t, --team-id <n>", "所属团队 ID")
    .option("--folder-id <n>", "父文件夹 id")
    .action((name, options, command) => runCliAction(async () => {
      const backend = await backendWithCredentials(command);
      const meta = await backend.createProject({
        name,
        description: options.description,
        coverUrl: options.coverUrl,
        teamId: options.teamId === undefined ? undefined : Number(options.teamId),
        folderId: options.folderId === undefined ? undefined : Number(options.folderId)
      });
      console.log(JSON.stringify(meta, null, 2));
    }, () => getAncestorOption(command, "debug") === true));

  project
    .command("list")
    .alias("ls")
    .description("项目列表")
    .option("-p, --page <n>", "页码", "1")
    .option("-s, --page-size <n>", "每页条数", "20")
    .option("-o, --order-by <field>", "排序方式", "updated_at_desc")
    .option("--name <text>", "名称关键字")
    .option("-t, --team-id <n>", "团队空间过滤")
    .action((options, command) => runCliAction(async () => {
      const backend = await backendWithCredentials(command);
      const projects = await backend.listProjects();
      console.log(renderProjectList(projects));
    }, () => getAncestorOption(command, "debug") === true));

  project
    .command("update")
    .argument("<projectUuid>", "画布项目 UUID")
    .option("-n, --name <text>", "新项目名称")
    .option("-d, --description <text>", "新项目简介")
    .option("--cover-url <url>", "新封面图链接")
    .option("--folder-id <n>", "父文件夹 id")
    .action((projectUuid, options, command) => runCliAction(async () => {
      const backend = await backendWithCredentials(command);
      const meta = await backend.updateProject(projectUuid, {
        name: options.name,
        description: options.description,
        coverUrl: options.coverUrl,
        folderId: options.folderId === undefined ? undefined : Number(options.folderId)
      });
      console.log(JSON.stringify(meta, null, 2));
    }, () => getAncestorOption(command, "debug") === true));

  project
    .command("delete")
    .alias("rm")
    .argument("<projectUuid>", "画布项目 UUID")
    .option("-t, --team-id <n>", "团队空间 ID")
    .option("-y, --yes", "跳过二次确认（占位）", false)
    .action((projectUuid, options, command) => runCliAction(async () => {
      const backend = await backendWithCredentials(command);
      await backend.deleteProject(projectUuid, options.teamId === undefined ? undefined : Number(options.teamId));
      console.log(`已删除项目 ${projectUuid}`);
    }, () => getAncestorOption(command, "debug") === true));

  project
    .command("use")
    .argument("<project>", "画布项目 UUID")
    .description("将当前目录绑定到画布项目")
    .action((projectUuid, _options, command) => runCliAction(async () => {
      const cwd = process.cwd();
      await writeBinding(cwd, { projectUuid });
      console.log(`已绑定项目 ${projectUuid} -> ${cwd}/.libtv/project.json`);
    }, () => getAncestorOption(command, "debug") === true));

  project
    .command("unuse")
    .description("解除当前目录与项目的绑定")
    .action((_options, command) => runCliAction(async () => {
      await clearBinding(process.cwd());
      console.log("已解除项目绑定");
    }, () => getAncestorOption(command, "debug") === true));

  project
    .argument("[projectUuid]", "画布项目 UUID")
    .description("画布摘要")
    .action((projectUuid, options, command) => runCliAction(async () => {
      const backend = await backendWithCredentials(command);
      const uuid = projectUuid ?? (await readBinding(process.cwd()))?.projectUuid;
      if (!uuid) {
        throw new Error("缺少项目：请传入项目 UUID，或先执行 libtv project use <项目UUID>");
      }
      const detail = await backend.getProjectDetail(uuid);
      console.log(JSON.stringify({ projectUuid: detail.projectUuid, nodes: detail.nodes.length, edges: detail.edges.length }, null, 2));
    }, () => getAncestorOption(command, "debug") === true));

  const node = libtv.command("node").description("画布节点：list/create/delete；默认用法操作已有节点");
  node
    .command("list")
    .description("列出画布节点")
    .option("-p, --project <project>", "目标项目 UUID")
    .option("-g, --group <group>", "普通分组节点 ID 或展示名")
    .action((options, command) => runCliAction(async () => {
      const backend = await backendWithCredentials(command);
      const projectUuid = getOption(command, "project") as string | undefined ?? (await readBinding(process.cwd()))?.projectUuid;
      if (!projectUuid) throw new Error("缺少项目：请使用 -p/--project 或先 libtv project use");
      const nodes = await backend.listNodes(projectUuid, getOption(command, "group") as string | undefined);
      console.log(JSON.stringify({ projectUuid, count: nodes.length, nodes }, null, 2));
    }, () => getAncestorOption(command, "debug") === true));

  node
    .command("create")
    .argument("<node>", "新节点展示名")
    .description("新建画布节点")
    .option("-p, --project <project>", "目标项目 UUID")
    .option("-g, --group <group>", "父级普通分组")
    .requiredOption("-t, --type <type>", "节点类型：text、image、video、audio、group、script、video-clip")
    .option("--prompt <text>", "写入节点参数中的提示词")
    .option("-s, --set <pair>", "写入节点参数，可重复", collect, [])
    .option("-u, --update <pair>", "写入节点自身属性，可重复", collect, [])
    .option("--left <node>", "入边（确保），可重复", collect, [])
    .option("--left-add <node>", "入边（追加），可重复", collect, [])
    .option("--left-rm <node>", "入边（移除），可重复", collect, [])
    .option("--right <node>", "出边（确保），可重复", collect, [])
    .option("--right-add <node>", "出边（追加），可重复", collect, [])
    .option("--right-rm <node>", "出边（移除），可重复", collect, [])
    .option("--x <n>", "画布 X", "0")
    .option("--y <n>", "画布 Y", "0")
    .option("-r, --run", "创建成功后触发生成一次", false)
    .action((name, options, command) => runCliAction(async () => {
      const backend = await backendWithCredentials(command);
      const projectUuid = getOption(command, "project") as string | undefined ?? (await readBinding(process.cwd()))?.projectUuid;
      if (!projectUuid) throw new Error("缺少项目：请使用 -p/--project 或先 libtv project use");
      const data = parsePairs(options.update);
      const params = parsePairs(options.set);
      const left = [...options.left, ...options.leftAdd].filter(Boolean);
      const right = [...options.right, ...options.rightAdd].filter(Boolean);
      const result = await backend.createNode({
        projectUuid,
        name,
        type: options.type,
        prompt: options.prompt,
        params,
        data,
        groupNodeKey: getOption(command, "group") as string | undefined,
        left,
        right,
        x: Number(options.x),
        y: Number(options.y),
        run: options.run === true
      });
      console.log(JSON.stringify(result, null, 2));
    }, () => getAncestorOption(command, "debug") === true));

  node
    .command("delete")
    .argument("<node>", "要删除的节点")
    .description("删除指定节点及其全部连线")
    .option("-p, --project <project>", "目标项目 UUID")
    .option("-g, --group <group>", "父级普通分组")
    .action((ref, options, command) => runCliAction(async () => {
      const backend = await backendWithCredentials(command);
      const projectUuid = getOption(command, "project") as string | undefined ?? (await readBinding(process.cwd()))?.projectUuid;
      if (!projectUuid) throw new Error("缺少项目：请使用 -p/--project 或先 libtv project use");
      const nodeDetail = await backend.getNode(projectUuid, ref);
      if (!nodeDetail) throw new Error(`未找到节点: ${ref}`);
      await backend.deleteNode(projectUuid, nodeDetail.nodeKey);
      console.log(`已删除节点 ${nodeDetail.nodeKey}`);
    }, () => getAncestorOption(command, "debug") === true));

  node
    .argument("[node]", "目标节点 ID 或展示名")
    .description("默认用法：查询/更新已有节点")
    .option("-p, --project <project>", "目标项目 UUID")
    .option("-g, --group <group>", "父级普通分组")
    .option("--prompt <text>", "写入节点参数中的提示词")
    .option("--name <text>", "将节点展示名更新为指定文本")
    .option("-s, --set <pair>", "写入节点参数，可重复", collect, [])
    .option("-u, --update <pair>", "写入节点自身属性，可重复", collect, [])
    .option("--left-add <node>", "入边（追加），可重复", collect, [])
    .option("--left-rm <node>", "入边（移除），可重复", collect, [])
    .option("--right-add <node>", "出边（追加），可重复", collect, [])
    .option("--right-rm <node>", "出边（移除），可重复", collect, [])
    .option("--x <n>", "画布 X", "0")
    .option("--y <n>", "画布 Y", "0")
    .option("-r, --run", "主流程成功后触发生成一次", false)
    .action((ref, options, command) => runCliAction(async () => {
      const backend = await backendWithCredentials(command);
      const projectUuid = options.project ?? (await readBinding(process.cwd()))?.projectUuid;
      if (!projectUuid) throw new Error("缺少项目：请使用 -p/--project 或先 libtv project use");
      if (!ref) {
        console.log("node 帮助：libtv node [node] [options]；子命令 list/create/delete");
        return;
      }
      const hasWrites = options.prompt || options.name || options.set.length || options.update.length || options.leftAdd.length || options.leftRm?.length || options.rightAdd.length || options.rightRm?.length;
      if (!hasWrites) {
        const detail = await backend.getNode(projectUuid, ref);
        if (!detail) throw new Error(`未找到节点: ${ref}`);
        console.log(JSON.stringify(detail, null, 2));
        return;
      }
      const detail = await backend.getNode(projectUuid, ref);
      if (!detail) throw new Error(`未找到节点: ${ref}`);
      const result = await backend.updateNode({
        projectUuid,
        nodeKey: detail.nodeKey,
        name: options.name,
        prompt: options.prompt,
        params: parsePairs(options.set),
        data: parsePairs(options.update),
        leftAdd: options.leftAdd,
        leftRemove: options.leftRm,
        rightAdd: options.rightAdd,
        rightRemove: options.rightRm,
        run: options.run === true
      });
      console.log(JSON.stringify(result, null, 2));
    }, () => getAncestorOption(command, "debug") === true));

  const group = libtv.command("group").description("普通分组：list/create/use/unuse；默认用法操作已有组");
  group
    .command("use")
    .argument("<group>", "分组节点 ID 或展示名")
    .description("将当前工作目录绑定到指定普通分组")
    .option("-p, --project <project>", "目标项目 UUID")
    .option("-g, --group <group>", "父级普通分组")
    .action((groupRef, options, command) => runCliAction(async () => {
      const projectUuid = getOption(command, "project") as string | undefined ?? (await readBinding(process.cwd()))?.projectUuid;
      if (!projectUuid) throw new Error("缺少项目：请使用 -p/--project 或先 libtv project use");
      await writeGroupBinding(process.cwd(), groupRef);
      console.log(`已绑定默认分组 ${groupRef}`);
    }, () => getAncestorOption(command, "debug") === true));

  group
    .command("unuse")
    .description("解除当前目录与默认分组的绑定")
    .action((_options, command) => runCliAction(async () => {
      await clearGroupBinding(process.cwd());
      console.log("已解除默认分组绑定");
    }, () => getAncestorOption(command, "debug") === true));

  group
    .command("list")
    .description("列出画布普通分组")
    .option("-p, --project <project>", "目标项目 UUID")
    .option("-g, --group <group>", "父级普通分组")
    .action((options, command) => runCliAction(async () => {
      const backend = await backendWithCredentials(command);
      const projectUuid = getOption(command, "project") as string | undefined ?? (await readBinding(process.cwd()))?.projectUuid;
      if (!projectUuid) throw new Error("缺少项目：请使用 -p/--project 或先 libtv project use");
      const groups = await backend.listGroups(projectUuid, getOption(command, "group") as string | undefined);
      console.log(JSON.stringify({ projectUuid, count: groups.length, groups }, null, 2));
    }, () => getAncestorOption(command, "debug") === true));

  group
    .command("create")
    .argument("<group>", "新分组展示名")
    .description("新建普通分组")
    .option("-p, --project <project>", "目标项目 UUID")
    .option("-g, --group <group>", "父级普通分组")
    .option("--node <node>", "待绑定子节点，可重复", collect, [])
    .option("-r, --run", "创建成功后整组生成一次", false)
    .action((name, options, command) => runCliAction(async () => {
      const backend = await backendWithCredentials(command);
      const projectUuid = getOption(command, "project") as string | undefined ?? (await readBinding(process.cwd()))?.projectUuid;
      if (!projectUuid) throw new Error("缺少项目：请使用 -p/--project 或先 libtv project use");
      const created = await backend.createGroup({
        projectUuid,
        name,
        parentGroupNodeKey: getOption(command, "group") as string | undefined,
        nodeKeys: options.node,
        run: options.run === true
      });
      console.log(JSON.stringify(created, null, 2));
    }, () => getAncestorOption(command, "debug") === true));

  group
    .argument("[group]", "分组节点 ID 或展示名")
    .description("默认用法：查询已有分组")
    .option("-p, --project <project>", "目标项目 UUID")
    .option("-g, --group <group>", "父级普通分组")
    .action((ref, options, command) => runCliAction(async () => {
      const backend = await backendWithCredentials(command);
      const projectUuid = options.project ?? (await readBinding(process.cwd()))?.projectUuid;
      if (!projectUuid) throw new Error("缺少项目：请使用 -p/--project 或先 libtv project use");
      const groups = await backend.listGroups(projectUuid, options.group);
      const found = ref ? groups.find((group) => group.id === ref || group.name === ref) : groups[0];
      if (!found) throw new Error(`未找到分组: ${ref ?? "(默认)"}`);
      console.log(JSON.stringify(found, null, 2));
    }, () => getAncestorOption(command, "debug") === true));

  const model = libtv.command("model").description("模型：search 在 supportModels 中检索；直接传模型 ID/名称拉取 schema");
  model
    .command("search")
    .argument("[name...]", "搜索词")
    .description("按关键词搜索模型")
    .option("-t, --type <node-type>", "节点类型：text、image、video、audio、script、storyboard")
    .action((nameArgs, options, command) => runCliAction(async () => {
      const backend = await backendWithCredentials(command);
      const models = await backend.listModels(options.type);
      const query = (nameArgs ?? []).join(" ").toLowerCase();
      const matches = query
        ? models.filter((model) => model.modelKey.toLowerCase().includes(query) || model.modelName.toLowerCase().includes(query))
        : models;
      console.log(JSON.stringify({ nodeType: options.type, query, matches }, null, 2));
    }, () => getAncestorOption(command, "debug") === true));

  model
    .argument("[name...]", "模型 ID 或展示名")
    .description("拉取完整 tool_spec schema")
    .action((nameArgs, _options, command) => runCliAction(async () => {
      const ref = (nameArgs ?? []).join(" ");
      if (!ref) {
        throw new Error("缺少模型 ID 或名称。示例：libtv model qwen-3-vl-flash");
      }
      const backend = await backendWithCredentials(command);
      const schema = await backend.getModelSchema(ref);
      if (!schema) throw new Error(`未找到模型: ${ref}`);
      console.log(JSON.stringify(schema, null, 2));
    }, () => getAncestorOption(command, "debug") === true));

  libtv
    .command("upload")
    .argument("<node>", "新资源节点显示名称")
    .description("媒体上传：上传文件并建资源节点")
    .option("-p, --project <project>", "目标项目 UUID")
    .option("-g, --group <group>", "父级普通分组")
    .option("--resource <path>", "本地媒体文件路径")
    .option("-f, --file <path>", "同 --resource")
    .option("-t, --type <kind>", "媒体种类：图片、视频或音频")
    .option("--x <n>", "画布 X", "0")
    .option("--y <n>", "画布 Y", "0")
    .action((name, options, command) => runCliAction(async () => {
      const backend = await backendWithCredentials(command);
      const projectUuid = options.project ?? (await readBinding(process.cwd()))?.projectUuid;
      if (!projectUuid) throw new Error("缺少项目：请使用 -p/--project 或先 libtv project use");
      const filePath = options.resource ?? options.file;
      if (!filePath) throw new Error("请通过 --resource 或 -f/--file 传入本地媒体文件路径");
      const kind = options.type ?? inferMediaKind(filePath);
      const result = await backend.uploadAsset({
        projectUuid,
        nodeName: name,
        filePath,
        kind,
        groupNodeKey: options.group,
        x: Number(options.x),
        y: Number(options.y)
      });
      console.log(JSON.stringify(result, null, 2));
    }, () => getAncestorOption(command, "debug") === true));

  libtv
    .command("download")
    .description("下载节点资源到本地")
    .requiredOption("-n, --node <node>", "目标节点 id 或显示名")
    .option("-p, --project <project>", "项目 UUID")
    .option("-g, --group <node>", "限定在普通分组子节点范围内")
    .option("-o, --out <dir>", "输出目录", process.cwd())
    .option("--without-ai-watermark", "偏好不添加 AI 水印", false)
    .option("--vip", "声明当前账号为会员", false)
    .action((options, command) => runCliAction(async () => {
      const backend = await backendWithCredentials(command);
      const projectUuid = options.project ?? (await readBinding(process.cwd()))?.projectUuid;
      if (!projectUuid) throw new Error("缺少项目：请使用 -p/--project 或先 libtv project use");
      const node = await backend.getNode(projectUuid, options.node);
      if (!node) throw new Error(`未找到节点: ${options.node}`);
      // 真实下载需要从 node.data.url 拉取并落盘；HTTP 下载契约待验证。
      console.log(JSON.stringify({ nodeKey: node.nodeKey, outputDir: options.out, urls: node.data?.url ?? [] }, null, 2));
    }, () => getAncestorOption(command, "debug") === true));

  libtv
    .command("plan")
    .description("解析本地 Step 2/4/5，输出 LibTV 素材执行计划")
    .option("--project <path>", "本地项目目录")
    .action((options, command) => runCliAction(async () => {
      const projectRoot = await resolveProjectRoot(options.project, process.cwd());
      const plan = await buildLibTvPlan(projectRoot);
      const binding = await readBinding(projectRoot);
      console.log(renderPlan(plan, binding?.projectUuid));
    }, () => getAncestorOption(command, "debug") === true));

  libtv
    .command("apply")
    .description("按计划幂等执行：上传锚点、生成关键帧、生成视频")
    .option("--project <path>", "本地项目目录")
    .option("--dry-run", "只输出操作计划，不调用画布", false)
    .option("--only <kind>", "只执行 anchors|keyframes|videos，可重复", collect, [])
    .action((options, command) => runCliAction(async () => {
      const projectRoot = await resolveProjectRoot(options.project, process.cwd());
      const backend = await backendWithCredentials(command);
      const only = options.only.length > 0 ? options.only : undefined;
      const result = await applyPlan(projectRoot, backend, { dryRun: options.dryRun === true, only });
      console.log(renderApplySummary(result));
    }, () => getAncestorOption(command, "debug") === true));

  libtv
    .command("status")
    .description("对比本地计划/镜像与画布实际节点")
    .option("--project <path>", "本地项目目录")
    .action((options, command) => runCliAction(async () => {
      const projectRoot = await resolveProjectRoot(options.project, process.cwd());
      const backend = await backendWithCredentials(command);
      const status = await buildStatus(projectRoot, backend);
      console.log(renderStatus(status));
    }, () => getAncestorOption(command, "debug") === true));

  libtv
    .command("verify")
    .description("校验 LibTV 素材链路一致性（只读）")
    .option("--project <path>", "本地项目目录")
    .option("--remote", "同时检查画布远端节点", false)
    .action((options, command) => runCliAction(async () => {
      const projectRoot = await resolveProjectRoot(options.project, process.cwd());
      const backend = await backendWithCredentials(command);
      const issues = await verifyLibtvProject(projectRoot, options.remote ? backend : undefined);
      console.log(renderVerifyIssues(issues));
      if (issues.length > 0) process.exitCode = 1;
    }, () => getAncestorOption(command, "debug") === true));

  libtv
    .command("approve")
    .description("将本地镜像中的关键帧标记为已通过人工待审")
    .argument("<id>", "关键帧 ID，格式 group-001/shot-001/keyframe-01")
    .option("--project <path>", "本地项目目录")
    .action((id, options, command) => runCliAction(async () => {
      const projectRoot = await resolveProjectRoot(options.project, process.cwd());
      const state = await readState(projectRoot);
      if (!state) throw new Error("没有本地状态，请先执行 libtv apply --only keyframes");
      const item = state.keyframes.find((candidate) => `${candidate.groupId}/${candidate.shotId}/${candidate.keyframeId}` === id);
      if (!item) throw new Error(`未找到关键帧: ${id}`);
      item.status = "approved";
      state.updatedAt = new Date().toISOString();
      await writeState(projectRoot, state);
      console.log(`已通过关键帧 ${id}`);
    }, () => getAncestorOption(command, "debug") === true));
}
