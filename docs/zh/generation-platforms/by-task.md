# 按任务分组的平台

- 生图：OpenAI、MiniMax、Midjourney
- 图生视频：Runway、Veo、Luma、Seedance
- 角色一致性：OpenAI、Runway
- 镜头延展：Veo、Runway

CLI 会在 `init` 时记录默认生图平台与默认生视频平台。`SUPPORTED_PLATFORMS` 当前为 `openai / veo / runway / luma / minimax / seedance / midjourney`，任一平台都可作为 `platforms.image.default` 或 `platforms.video.default`（配置层不限定任务类型）；上表是按任务分类的推荐口径，`verify` 不强制校验该映射。

## Step 5 视频提示词合同与平台差异

所有平台的正式 Step 5 视频提示词都必须包含五区块合同（`元信息` / `平台执行设置` / `参考素材映射` / `可复制提示词` / `负面约束`），并在 `平台执行设置` 中显式写出默认视频平台名（与 `project.config.yaml` 的 `platforms.video.default` 一致），其余合同（`无配乐、无字幕`、负面约束、Step 4→5 参考资产继承链）对所有平台一律生效。

`Seedance 2.0` 与 `全能参考模式` 两个标记仅对默认视频平台为 seedance 的项目要求；非 seedance 平台（veo / runway / luma / minimax / midjourney）不要求这两个标记，也不应照抄 seedance 模板中的这两个参数。
