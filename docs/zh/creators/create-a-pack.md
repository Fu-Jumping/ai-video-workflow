# 创建 Pack

使用 `ai-video-workflow new-pack --name my-pack`（等价形式：`node apps/cli/dist/index.js new-pack --name my-pack`）在**当前目录**创建 workflow pack 脚手架，例如 `my-pack/`。

## 生成的目录结构

```
my-pack/
├── pack.yaml                      # name / version / displayName（name 与 displayName 取 packName）
├── checks/
│   ├── required-files.yaml        # requiredFiles: [] 占位
│   ├── link-rules.yaml            # allowAbsolutePaths: false 占位
│   ├── sync-rules.yaml            # syncTargets: [] 占位
│   └── project-structure.yaml     # steps: [] 占位
└── templates/
    └── 06_执行计划/
        ├── 00_执行计划.md
        ├── 01_图片执行计划.md
        └── 02_视频执行计划.md
```

`new-pack` 会先校验包名（与 `init --name` 相同的安全目录名校验），若目标目录已存在且非空则拒绝。模板目录与文件名与工作流消费的一致（`06_执行计划/00_执行计划.md` 等）。

## 与现有结构的关系

- `scaffolds/workflow-pack/` 是仓库内的 pack 起点结构，布局与 `new-pack` 生成结果一致（`pack.yaml`、`checks/` 四个文件、`templates/06_执行计划/` 三个模板）；`new-pack` 是把同一布局按用户提供的包名生成到当前目录。
- `packs/official-ai-video/` 是官方旗舰 pack，结构相同但内容完整（workflow/、checks/ 填了真实规则、templates/、skills/、starters/ 等），可作为填充 `checks/` 与 `templates/` 时参考。

## 让自定义 pack 可用

把包放在仓库的 `packs/<name>/` 目录（含 `pack.yaml`），然后：

- `init --pack <name>` 用该 pack 播种项目（默认 `official-ai-video`）；自定义 pack 未提供的模板会自动回退到官方 pack，`starters/` 同理，因此部分自定义包也能生成可运行骨架。
- `project.config.yaml` 的 `pack` 字段接受任意安全目录名；`verify` / `mcp-context` / `mcp-server` 读取该字段，`sync` 按它同步 IDE 运行时镜像（自定义 pack 缺失的运行时目录同样回退官方 pack）。
- 若 `pack` 指向的目录不存在（`init --pack` 或 `sync` 时），会给出明确报错。
- 完整规则/模板/技能编写规范见 `docs/zh/creators/write-rules.md`、`write-templates.md` 与 `write-skills.md`。
