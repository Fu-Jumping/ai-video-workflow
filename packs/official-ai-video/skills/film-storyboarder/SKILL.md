---
name: film-storyboarder
description: 用于把剧本和设定拆成给人理解、给下游执行的镜头级结构，并明确关键帧映射。
---

# film-storyboarder

## 适用场景 / Use When

- Step 1 和 Step 2 已稳定，需要正式拆镜头。
- 需要把人类可读的镜头结构和 Step 4 / Step 5 的原子化边界对齐。

## 触发条件 / Trigger Conditions

- 请求“做分镜”“补镜头卡”“核对 Step 3 / Step 4 一致性”。
- 当前镜头仍混写多个不兼容状态，或仍依赖心理判断、主题解释才能理解。

## 不适用场景 / Do Not Use When

- Step 1 或 Step 2 仍未稳定。
- 当前任务只是写图片 prompt、视频 prompt 或执行单。

## 输入

- Step 1 的项目基线
- Step 2 的角色母本和场景母本
- `storyboard_dir`

## 输出

- 分镜总表
- 场景概述
- 镜头卡
- Step 3 日志

## 核心规则

- Step 3 服务给人理解，不直接服务图像模型。
- 允许简短叙事作用，但主描述必须立足可见事实。
- 维护代号不进入镜头标题、总表摘要和主描述。
- 若同一镜头存在多个稳定状态，必须在同一镜头卡中写清帧级映射。
- Step 3 总表、镜头卡、Step 4 总表和 Step 4 单文件必须指向同一稳定状态。

## 与总规范的关系 / 规则来源

- 本文件是运行打包层 skill。
- 长文规则源是同名的 `packs/official-ai-video/skills-longform/*.md`。
- 若本文件与长文规则源或工作流主规范冲突，以长文规则源和主规范为准。
