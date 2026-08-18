# Step 6：执行方案

Step 6 固定采用：

- `00_execution_plan.md`
- `01_image_execution_plan.md`
- `02_video_execution_plan.md`

## 引用其它步骤文件的写法

- 推荐使用反引号相对路径文本，例如 `` `../04_图片提示词/镜头组-001/镜头-001-关键帧-01.md` ``，不进入 Markdown 链接解析，最稳。
- 若使用 Markdown 链接，目标必须相对**引用文件自身所在目录**可解析（例如 `06_执行计划/00_执行计划.md` 引用 Step 4 应写 `../04_图片提示词/...`）；`verify` 会检查相对链接目标是否存在（`broken-relative-link`）。注意 Obsidian 观看层会按 vault 内路径重新解析链接，同一链接在源层合法也可能在投影层报坏链，因此跨步骤引用优先用反引号路径。
