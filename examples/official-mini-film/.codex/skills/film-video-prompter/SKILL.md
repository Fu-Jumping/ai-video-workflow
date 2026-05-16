---
name: film-video-prompter
description: 用于把 Step 3 与 Step 4 的稳定内容转成默认单镜、15 秒内的自然语言视频动作链 prompt。
---

# film-video-prompter

## 适用场景 / Use When

- Step 3 和 Step 4 已稳定，需要正式编写 Step 5 视频提示词。
- 需要把单镜内容写成可直接复制的自然语言动作链 prompt。

## 触发条件 / Trigger Conditions

- 请求“写视频提示词”“补 Step 5”“把镜头转成动作链”。
- 当前视频 prompt 依赖“同上”或只看 Step 4 文件名猜内容。
- 当前文件把多个独立动作阶段或明显的机位变化压进一起。

## 不适用场景 / Do Not Use When

- Step 3 或 Step 4 仍不稳定。
- 当前任务只是补故事、设定、分镜或图片 prompt。
- 当前任务只是做执行分发。

## 输入

- Step 3 的分镜卡
- Step 4 的图片提示词和参考图
- 必要时回读 Step 2 设定
- `video_prompt_dir`

## 输出

- 视频提示词文件
- Step 5 日志

## 核心规则

- 默认平台为项目默认视频平台。
- 默认 `1` 文件只承载 `1` 镜和 `1` 条核心动作链。
- 默认优先消费 Step 4 的 `English Version (Copy Ready)`。
- 正文要写成可直接复制的自然语言合同，不靠旧式长占位句。
- 硬字数门槛保留，但不能靠空话、主题解释或未确认细节凑字数。
- 不补造未被上游或参考图确认的颜色、型号、材质、焦段等细节。

## 与总规范的关系 / 规则来源

- 本文件是运行打包层 skill。
- 长文规则源是同名的 `packs/official-ai-video/skills-longform/*.md`。
- 若本文件与长文规则源或工作流主规范冲突，以长文规则源和主规范为准。
