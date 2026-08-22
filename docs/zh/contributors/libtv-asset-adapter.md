# LibTV 素材 Adapter

`ai-video-workflow libtv ...` 是 LibTV 素材执行适配层，只承担素材上传、引用、图片/视频生成与回传。

## 边界

- 事实源：Step 0-7 Markdown + `project.config.yaml`
- LibTV 负责：锚点上传、节点/引用边、图片/视频生成、结果下载
- 不负责：剧情、分镜设计、`script storyboard`
- 不自动改写 Step 源文件

## 命令

```text
ai-video-workflow libtv workspace ...
ai-video-workflow libtv project ...
ai-video-workflow libtv node ...
ai-video-workflow libtv group ...
ai-video-workflow libtv upload ...
ai-video-workflow libtv download ...
ai-video-workflow libtv model ...
ai-video-workflow libtv plan
ai-video-workflow libtv apply
ai-video-workflow libtv status
ai-video-workflow libtv verify
ai-video-workflow libtv approve
```

## 素材链路

```text
Step2 锚点图 -> Step4 关键帧图 -> Step5 视频
    上传            生成/回传          生成/回传
```

本地目录：

```text
assets/anchors/characters/<角色>三视图.png
assets/anchors/scenes/<场景>场景图.png
outputs/images/<group>/<shot>/
outputs/video/<group>/<shot>/
.libtv/project.json
.libtv/state.json
```

## 模型映射

可在 `project.config.yaml` 中配置：

```yaml
libtv:
  image_model: mj-v8.2
  video_model: star-video2
```

未配置时使用内置默认映射：

- `midjourney -> mj-v8.2`
- `seedance -> star-video2`

## 边序与占位符

- 视频节点的 `imageListOrder` / `mixedListOrder` 会按 `--left` 传入顺序写入，保持引用顺序。
- 提示词中的 `&#123;&#123;Node "节点名"&#125;&#125;` 会自动按引用顺序替换为 `&#123;&#123;Image n&#125;&#125;`（或 `&#123;&#123;Mixed n&#125;&#125;`）。
- 当前实现已支持该映射，后续可继续增加 Step 5 `素材上传顺序` 的自动校验。

## 已实现能力

- 上传：未安装官方 CLI 时自动安装，再通过官方 CLI 桥接上传。
- 手机登录：`libtv login phone` 已实现发送验证码/验证码登录流程。
- 下载：单文件直接下载；多文件/水印参数走官方 CLI，支持 ZIP 与去水印参数。
- 管道：`libtv node <下游>` 支持从 stdin 读取 NDJSON 并作为左侧引用。
- 顺序合同：`libtv verify-order --write-contract` 可生成合同文件，之后 `verify-order` 会校验 orderHash。
- 模型可用性：`apply` 执行前会校验模型是否存在于当前账号。

## 已知限制

- 上传目前优先尝试 HTTP 直传，未成功时回退到本机官方 `libtv` CLI。
- `account info` 的 `user.id` 与官方 CLI 可能不完全一致。
- `login web` 已支持本机回调。
