# film-workflow

## 适用场景 / Use When

- 用户没有明确指明当前属于哪一步。
- 当前请求同时涉及母包维护、步骤路由、影响分析或镜像同步。
- 已完成步骤中的局部内容被修改，需要先判断是否回链到上游或扩散到下游。
- 正在维护 `ai-video-workflow/`，需要判断哪些运行入口和镜像必须同步。

## 触发条件 / Trigger Conditions

- 用户提到“工作流”“母包”“镜像”“adapter”“初始化”“运行入口”“分发包”。
- 用户的请求跨越多个步骤边界，先做路由比直接落单一步更安全。
- 用户要求修改的是已经完成的步骤内容，且可能影响 Step 3、Step 4、Step 5 的映射关系。
- 用户要求改 skill、模板、总规范或 IDE 接入方式。

## 不适用场景 / Do Not Use When

- 当前请求已经明确、单纯地落在某一个步骤，且没有路由歧义。
- 当前任务只是补充单一模板内容，不涉及步骤判断、镜像同步或影响分析。

## 输入

- 用户请求
- `packs/official-ai-video/workflow/workflow-spec.md`
- `packs/official-ai-video/workflow/quality-gates.md`
- 对应步骤的长文 skill 源
- 对应步骤的模板
- 项目映射与当前 IDE 运行入口

## 输出

- 当前应进入的步骤结论
- 是否属于母包维护还是项目执行
- 是否需要影响分析、回链修复或镜像同步
- 下一步应读取的上游输入和目标目录

## 核心规则

### 总路由职责

`film-workflow` 是总路由技能，用来判断当前请求属于：

- 工作流母包维护
- 项目级 Step 1 到 Step 6 执行
- 已完成步骤中的局部修订与影响分析

### 解析优先级

解析顺序固定为：

1. `packs/official-ai-video/workflow/workflow-spec.md`
2. `packs/official-ai-video/workflow/quality-gates.md`
3. 对应步骤的 `packs/official-ai-video/skills-longform/*.md`
4. 对应步骤的 `packs/official-ai-video/skills/<skill>/SKILL.md`
5. 对应步骤的 `packs/official-ai-video/templates/*.md`

### 路由规则

1. 先判断当前请求属于母包维护还是项目执行。
2. 若属于母包维护，只修改母包与运行镜像，不修改项目交付层。
3. 若属于项目执行，只进入一个正确步骤，不混写多个步骤。
4. 若属于已完成步骤中的局部修订，先做影响分析，再决定是否扩散修订。

### 全局口径

- Step 3 服务给人理解，允许简短叙事作用，但主描述必须立足可见事实。
- Step 4 服务给模型看，默认平台为 项目默认图片平台，默认模型为 项目默认模型配置。
- Step 4 正式文件固定包含 `快速导读`、`中文完整版本`、`English Version (Copy Ready)`。
- Step 5 默认消费 Step 4 的 `English Version (Copy Ready)`。
- Step 3、Step 4、Step 5 默认分别按一镜头卡、一关键帧文件、一动作链文件组织。
- 若维护的是官方 pack，修改 `packs/official-ai-video/` 后必须同步 `.codex/ai-video-workflow/`；修改 `packs/official-ai-video/skills/` 后还必须同步 `.codex/skills/`。

### 路由映射

- Step 1 -> `film-planner`
- Step 2 -> `film-setter`
- Step 3 -> `film-storyboarder`
- Step 4 -> `film-image-prompter`
- Step 5 -> `film-video-prompter`
- Step 6 -> `film-producer`

### 何时停止继续下游

以下情况不应继续往下游写：

- 上游输入不存在
- 上游事实互相冲突
- 当前问题本质上是上游修订，而不是下游生成
- 当前产物同时混入多个稳定状态
- 当前请求把多镜或多关键帧强行合并成一个文件

### 局部修订时的最小动作

1. 锁定被改的是哪个步骤、哪些文件、哪些事实。
2. 检查当前步骤是否有同层文件需要同步。
3. 回读必要上游，判断是否改写了继承事实。
4. 检查直接下游和必要的间接下游是否受影响。
5. 先对话回报，再决定是否扩散修订。

## 与总规范的关系 / 规则来源

- 本文件是 `film-workflow` 的长文规则源。
- 对应技能包位于 `packs/official-ai-video/skills/film-workflow/SKILL.md`。
- 若技能包与本文件冲突，以本文件和工作流主规范为准。
