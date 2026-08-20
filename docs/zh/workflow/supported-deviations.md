# 受支持偏离：deviations.yaml

`verify` 的默认行为是“严格按当前合同校验”。但真实项目中确实存在不需要完全按标准流程走的情况（例如轻量镜头不建关键帧、场景图兼任形象基准、临时跳过某类产物）。

为了不让“偏离”变成不可见的静默行为，CLI 提供一份可选的项目级声明文件 **`deviations.yaml`**。只有显式登记在案的问题才会被 `verify` 接受；未登记的同类问题仍然照常失败。

## 文件格式

`deviations.yaml` 放在项目根目录，推荐使用对象格式：

```yaml
mode: hybrid
deviations:
  - rule: missing-character-triview
    scope: 02_世界设定/角色设定.md
    reason: 场景图已包含人物形象描述，本镜头走 scene-basis 轻量流程
    confirmed_by: creator
    confirmed_at: "2026-08-20T10:30:00.000Z"

  - rule: broken-step3-step4-link
    scope: 03_分镜脚本/镜头组-001/镜头-002.md
    reason: 镜头 002 明确不生成 Step 4 关键帧
shots:
  - id: shot-002
    mode: scene-basis
    reason: 该镜头以场景图兼任形象基准，不建三视图和关键帧
```

字段说明：

- `mode`：项目级流程模式，可选：
  - `standard`：完整标准流程（默认）。
  - `scene-basis`：全局允许“场景图兼任形象基准、不建三视图/关键帧”。
  - `minimal-video`：全局允许跳过 Step 4 关键帧，直接进入视频提示词。
  - `hybrid`：不全局放宽，使用 `deviations` 和 `shots` 做按文件/按镜头声明。
- `deviations`：逐条登记的偏离。
  - `rule`：要接受的 `verify` 错误码。
  - `scope`：可选。限定到某个文件、目录前缀或 `文件#锚点`；不填表示接受该项目下该错误码的全部出现。
  - `reason`：建议填写，说明为什么接受这次偏离。
  - `confirmed_by` / `confirmed_at`：可选的责任人与确认时间。
- `shots`：按镜头的流程模式。
  - `id`：镜头 id，例如 `shot-002`。
  - `mode`：该镜头使用的流程模式。
  - `reason`：可选说明。

兼容旧格式：如果 `deviations.yaml` 是顶层数组，则等价于 `mode: standard` + `deviations: [...]`。

## CLI 命令

```powershell
# 查看当前模式、已登记偏离和镜头模式
ai-video-workflow deviation list --project <path>

# 设置项目级流程模式
ai-video-workflow deviation set-mode --project <path> --mode scene-basis

# 设置单镜头流程模式
ai-video-workflow deviation set-shot-mode --project <path> --shot shot-002 --mode minimal-video --reason "不建关键帧"

# 移除单镜头流程模式
ai-video-workflow deviation remove-shot-mode --project <path> --shot shot-002

# 登记一条偏离
ai-video-workflow deviation add --project <path> \
  --rule missing-character-triview \
  --scope 02_世界设定/角色设定.md \
  --reason "场景图兼任形象基准" \
  --by creator

# 删除一条偏离
ai-video-workflow deviation remove --project <path> \
  --rule missing-character-triview \
  --scope 02_世界设定/角色设定.md
```

## 交互式确认

在交互式终端中运行 `verify` 且项目存在未登记问题时，CLI 会逐条询问是否将问题登记为已接受偏离：

```text
? 将以下问题登记为已接受偏离？
  missing-character-triview: Main character ... (02_世界设定\角色设定.md) (y/N)
```

- 选择“是”后，CLI 会写入 `deviations.yaml` 并重新校验；已登记问题变为 `Accepted deviations`。
- 非交互环境（CI、脚本、子代理）不会弹窗，仍然直接报错退出。
- `--strict` 会跳过交互确认，并忽略所有已登记偏离。

## verify 行为

- 默认 `verify` 会读取 `deviations.yaml`，按项目模式、镜头模式、已登记偏离对匹配问题放行，并在输出中显示 `Accepted deviations (...)`。
- 加 `--strict` 会忽略 `deviations.yaml` 与模式放宽，把所有匹配问题重新当作失败报告出来，用于查看“如果严格模式会怎样”。
- `export-obsidian` 仍然要求 `verify` 通过；登记偏离或使用轻量模式后项目可以通过 verify，从而可以导出观看层。
- Obsidian 观看层会在项目首页和对应镜头页展示“已接受偏离与流程模式”，让偏离在审阅中保持可见。

## 设计边界

- 偏离登记只用于“用户明确选择不走标准流程”的场景，不应该替代硬性合同修复（例如文件缺失、链接断裂、引用未声明）。
- 建议把 `deviations.yaml` 纳入版本控制，这样项目成员和智能体都能看到已接受的偏离。
- 如果偏离不再适用，直接 `deviation remove` / `remove-shot-mode` 或删除对应条目，项目会回到严格校验。
