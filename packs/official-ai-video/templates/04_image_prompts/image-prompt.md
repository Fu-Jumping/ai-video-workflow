# 图片提示词模板

## 文件用途

- 当前文件只服务 `1` 个关键帧与 `1` 个稳定画面状态
- 默认面向项目初始化时选择并记录的图片平台
- 正文必须让模型单看这一份文件就能理解完整画面

## 维护元信息

- 场景名称：
- 镜头名称：
- 关键帧名称：
- 上游分镜卡：
- 参考锚点或标准图：

## 快速导读

- 画面内容：
- 机位关系：
- 主体状态：

> 这里只写纯视觉事实，不写维护者说明或上下文提示。

## 中文完整版本

```text
请把这里替换成最终中文提示词。正文默认写成 1 到 2 段连续自然语言，先写这张图此刻正在发生什么，再写前景、中景、背景、空间方向、光线、关键物件和画面约束。

避免:
```

写作要求：

- 只写可见画面事实
- 不写心理判断、导演解释或项目上下文
- 必须覆盖时代、空间、主体、动作瞬间、前中后景、光线、关键物件和避免项
- 结尾单列 `避免:`

## English Version (Copy Ready)

```text
Replace this block with the final English prompt. Write 1 to 2 continuous natural-language paragraphs that describe one stable visible frame, then end with a separate Avoid line.

Avoid:
```

Writing requirements:

- Write only visible on-screen facts
- Do not rely on project context, hidden codes, or previous files
- Cover era, space, subject, frozen action beat, foreground, midground, background, lighting, key objects, and drift-prevention constraints
- End with a separate `Avoid:`

## 中英对齐检查

- [ ] 中文版与英文版描述的是同一稳定画面
- [ ] 两版都写清了主体、空间、光线和关键物件
- [ ] 两版都写清了避免项
- [ ] 两版都不依赖前文或项目上下文

## 硬门槛

- [ ] 中文版与英文版都已经提供完整正文
- [ ] 中文版与英文版都不是关键词堆砌
- [ ] 中文版不少于 180 字
- [ ] 英文版不少于 120 词
- [ ] 当前文件只服务一个关键帧和一个稳定画面状态
- [ ] 当前文件没有同时描述动作前态和动作后态
- [ ] 当前文件没有使用内部代号
