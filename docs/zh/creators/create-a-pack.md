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
    └── 06_execution_plan/
        ├── 00_execution_plan.md
        ├── 01_image_execution_plan.md
        └── 02_video_execution_plan.md
```

`new-pack` 会先校验包名（与 `init --name` 相同的安全目录名校验），若目标目录已存在且非空则拒绝。

## 与现有结构的关系

- `scaffolds/workflow-pack/` 是仓库内的 pack 起点结构，布局与 `new-pack` 生成结果完全一致（`pack.yaml`、`checks/` 四个文件、`templates/06_execution_plan/` 三个模板）；`new-pack` 是把同一布局按用户提供的包名生成到当前目录。
- `packs/official-ai-video/` 是官方旗舰 pack，结构相同但内容完整（workflow/、checks/ 填了真实规则、templates/、skills/ 等），可作为填充 `checks/` 与 `templates/` 时参考。

## 让自定义 pack 可用

生成的 `checks/` 与 `templates/` 均为占位内容，需要按官方 pack 的格式补充实际规则与模板后，放入仓库的 `packs/` 目录（或与官方 pack 同级的自定义 pack 目录），并在 `project.config.yaml` 的 `pack` 字段指向它。CLI 的 `init` / `sync` / `verify` 当前固定使用默认包 `official-ai-video`（`DEFAULT_PACK`），自定义 pack 的完整接入链路见 `docs/zh/creators/write-rules.md`、`write-templates.md` 与 `write-skills.md`。
