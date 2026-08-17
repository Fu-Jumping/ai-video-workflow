# ai-video-workflow 修复计划

- 制定日期：2026-08-17
- **执行状态：全部完成（2026-08-17）**——F1~F13 全部处理，`pnpm verify:v0.2` 全绿（build + 261 测试 + example:verify），两轮测试项目手工验收通过（9 卡与 18 卡项目 export/verify-obsidian 全通过）。
- **第三轮真实环境复测（2026-08-17，r3）**：隔离子代理以真实创作者身份走查（克隆→创作→Obsidian→换人/改时长/整体重写→质量把关），开箱验证一次通过、10 张来源卡零丢失、模板直接可用、分步校验可用、质量把关命中内容问题；走查发现的 3 项跟进问题已修复（见状态表 G1/G2/G4）。产物 `G:\avw-r3-e2e-20260817\`。
- 依据：两轮隔离端到端测试（2026-08-17）
  - 第一轮（主链路）：`G:\avw-e2e-test-20260817\REPORT.md` / `测试报告.md`
  - 第二轮（审核与修改链路）：`G:\avw-r2-e2e-20260817\REPORT.md` / `测试报告.md`
- 被测版本：master @ ff1fd26（与本地 HEAD 一致）
- 修复范围：`apps/cli/src`（CLI 与校验器）、`packs/official-ai-video`（模板与规范）、`examples/`、`docs/`、测试基建

## 修复完成状态总表

| 编号 | 问题 | 状态 | 说明 |
| --- | --- | --- | --- |
| F1 | `pnpm verify:v0.2` 开箱必失败 | ✅ 已修 | vitest globalSetup 自动 sync 官方示例；r3 真实环境复测开箱一次通过 |
| F2 | Obsidian 来源卡投影同名冲突 | ✅ 已修 | scan.ts 按 `SRC-xxxx 来源卡` 投影 + export.ts 碰撞防御报错；9/18/10 卡项目均验收通过 |
| F3 | Step 4 模板自检残句被误判为资产 | ✅ 已修 | 模板文案重写 + reference-assets.ts 提取时剔除自检区块（双保险） |
| F4 | Step 2 模板结构与校验器冲突 | ✅ 已修 | 模板平铺化为 `## 角色一/场景一` 并写明结构约束；quality-gates §1.2 补约束说明 |
| F5 | verify 无分步校验能力 | ✅ 已修 | `verify --step <0-6>`（含 Step 3 预期中间态降级）；r3 实际使用确认 |
| F6 | 内容级门槛无机器执行 | ✅ 已修（A 档） | 避免双前缀 / 快速导读元语言词 / 负面约束按镜定制底线；r3 质量把关确认命中 |
| F7 | init 不播种 Step 2/4/5 模板 | ✅ 已修 | init 播种 02 设定 + 04/05 模板参考；r3 直接填写无坑 |
| F8 | 平台枚举不含 midjourney | ✅ 已修 | constants/types 增加 midjourney |
| F9 | raw/ 文件泄漏进 Obsidian 投影 | ✅ 已修 | scan.ts 排除归档目录；r3 确认 raw 不进观看层 |
| F10 | sync 镜像目录命名漂移 | ✅ 已修（文档口径） | WORKFLOW_OVERVIEW §2.4/§9 与 workflow-spec 改为"固定映射同步" |
| F11 | WORKFLOW_OVERVIEW §5 英文版口径 | ✅ 已修 | §5 改为与模板一致的三段合同 |
| F12 | git CRLF 噪音 | ✅ 已修 | .gitattributes |
| F13 | verify 偶发进程崩溃 | 🔭 观察项 | 未复现，未投入 |
| G1 | 03 分镜卡模板条目格式与校验器标题格式不符（r3 新发现） | ✅ 已修 | 模板改为 `### 分镜 N` 标题 + 模板合规断言守护 |
| G2 | 负面约束检查逐字匹配可绕过（r3 新发现） | ✅ 已修 | 归一化增强（全半角引号/反引号/空白），变体用例守护 |
| G3 | 注入脚本静默失败造成漏检假象（r3） | ℹ️ 操作不当 | 非工具缺陷，不修 |
| G4 | Step 0 基线"15 秒"口径漂移无兜底（r3） | ✅ 已修（文档） | 影响面排查手册补充 Step 0 口径检查项 |

**新增回归测试（15 个用例）**：template-compliance（02/03/04 模板与校验器契约守护）、obsidian-multisource（多来源卡投影 + raw 排除）、verify-step（分步校验 + 内容检查 + 变体命中）。**新增 CI**（.github/workflows/ci.yml）。**新增文档**：verify-and-iterate.md、impact-analysis.md、rewrite-handbook.md。

---

## 一、修复原则

1. **先修"开箱即坏"，再修"照抄即踩坑"，最后修体验类**。
2. **每个修复必须带回归测试**。两轮测试暴露的最大问题类别是"模板/示例与校验器口径漂移、且示例覆盖不足"——示例只有 1 个来源卡、模板与 checker 不一致，导致缺陷长期隐藏。修复的根是测试基建（见第三节）。
3. 代码改动最小化：优先改模板/文档/测试来对齐既有合同，其次改校验器，最后才改流程设计。
4. 验收口径：每里程碑以 `pnpm verify:v0.2` + 新增的模板合规测试全绿为准。

## 二、缺陷清单与修复方案

### P1（严重，2 项）

#### F1 官方验证 `pnpm verify:v0.2` 开箱必失败
- **现象**：vitest 阶段 72/246 测试失败（5 个测试文件），报 `missing-ide-runtime: Missing Codex runtime overview: .codex/ai-video-workflow/WORKFLOW_OVERVIEW.md`；手工 `sync --ide codex` 后全绿。
- **根因（比第一轮报告更精确）**：根 `package.json` 的 `example:verify` 脚本**已经包含** `sync --ide codex`，失败不在该脚本；而是 `apps/cli/tests/` 里对示例项目直接跑 verify/export 的测试文件（example-verify、obsidian-example、obsidian-verify、maintenance、cli-dist 等）在 **vitest 阶段（早于 example:verify）** 运行，此时示例的 `.codex/` 镜像不存在——而 `.codex/` 被 `examples/官方示例-云上早市/.gitignore` 显式忽略，仓库不可能自带。
- **修复**：为 `apps/cli` 的 vitest 增加 `globalSetup`（如 `apps/cli/tests/setup.ts`），在测试开始前对 `examples/官方示例-云上早市` 执行一次 `syncProject`（复用 `apps/cli/src/lib/sync.ts` 的导出，或调用 CLI sync 子进程），使 `pnpm test` 独立可跑；`.tmp` 输出目录纳入清理。不要提交 `.codex/`（与 .gitignore 语义冲突，且镜像内容会随母包漂移）。
- **验证**：clean clone → `pnpm install && pnpm build && pnpm test && pnpm example:verify` 全绿。
- **回归测试**：现有 246 用例即回归集；globalSetup 若失败应直接中断测试。

#### F2 Obsidian 来源卡投影同名冲突（两轮独立复现，最高优先）
- **现象**：`export-obsidian` 把 `_资料库/SRC-xxxx/source-card.md` 全部投影到同一路径 `01_阶段审核/00_前期研究/Source Card.md`：vault 静默丢失 N-1 张卡、`verify-obsidian` 必报 N-1 条 mismatch（9 卡→8 条，随卡数线性增长）、`rebuild-view` 最终校验步被同一缺陷阻断。官方示例仅 1 张卡，从未触发。
- **根因**：`apps/cli/src/lib/obsidian/scan.ts:11` `titleFromFileName` 以文件名派生标题（去分隔符转大写），`source-card.md` → `Source Card`；扫描与导出均不保留 `SRC-xxxx` 目录层级，manifest 不去重。
- **修复**：
  1. `scan.ts` 对 `_资料库/SRC-xxxx/source-card.md` 的投影名改用 `SRC-xxxx 来源卡`（保留来源 ID，杜绝碰撞）；
  2. `apps/cli/src/lib/obsidian/manifest.ts`（或 verify 端）对同 vaultPath 多条目**去重并在冲突时告警**（防御性兜底，防未来再出现同类文件名碰撞）；
  3. 检查 `rebuild-view`（`apps/cli/src/lib/maintenance.ts`）的 clean 逻辑对旧投影名 `Source Card.md` 的清理兼容（升级后旧投影需能被 clean 清除）。
- **验证**：用第二轮测试项目 `G:\avw-r2-e2e-20260817\孤勇与悲歌`（9 张来源卡，天然验收样例）跑 export/verify-obsidian，9 卡全部可见且校验通过。
- **回归测试**：`tests/fixtures` 增加含 ≥2 张 source-card 的 fixture；`obsidian-verify.test.ts` 断言全部来源卡投影成功且 verify 通过。

### P2（一般，5 项）

#### F3 Step 4 模板自检残句被校验器误判为必带参考资产（第一轮）
- **现象**：按模板保留"中文自检"清单时，`verify` 报 `missing-step5-reference-asset: @xx三视图 / @xx场景图`。
- **根因**：`packs/official-ai-video/templates/04_图片提示词/图片提示词.md:53` 的 `- [ ] 已携带 Step 3 声明的全部 \`@xx三视图\` / \`@xx场景图\`。` 中字面 `@xx三视图/@xx场景图` 被 `apps/cli/src/lib/reference-assets.ts:20` 的 `referenceAssetPattern`（`/@([^@\s...]+?)(三视图|场景图)/gu`）当作真实资产提取。
- **修复（双保险）**：
  1. 模板文案改为"已携带 Step 3 声明的全部角色三视图与场景图引用"（第二轮已用同款改法验证通过）；
  2. `reference-assets.ts` 提取前先剔除 ``` 代码块与 `## 中文自检` 区块内容（防止未来模板再踩同类坑）。
- **验证**：按模板原样填充的最小合法项目 verify 通过（由 3.1 模板合规测试守护）。

#### F4 Step 2 模板结构与校验器隐性要求冲突（两轮独立复现）
- **现象**：模板原样结构（`## 角色细节` + `### 角色一`）必报 `missing-character-triview: 角色细节 must declare @角色细节三视图` / `missing-scene-reference-image` 假阳性；只有官方示例的 `## 角色名` 平铺结构能过。
- **根因**：`templates/02_世界设定/角色设定.md`（同 场景设定.md）的嵌套结构与 `reference-assets.ts:83/101` 的"`##` 段标题即实体名、段内须 `主角色：是` + `@<段标题>三视图`"合同不一致；`workflow-spec.md`/`quality-gates.md` 未写明该结构约束。
- **修复**：模板改为平铺结构（每个角色/场景直接作 `##` 段，段内含 `主角色：是`/`需要场景图：是` + 对应 @ 引用；角色清单表保留作索引）；`quality-gates.md` 增补"Step 2 结构约束"条目。不改校验器（平铺结构即合同，模板应服从合同）。
- **验证**：模板合规测试覆盖 02；两轮测试中"照示例结构改后通过"已证实方案可行。

#### F5 verify 无分步校验能力（第二轮新发现）
- **现象**：Step 3 刚完成时必然报 18 个"预期错误"（9 `invalid-keyframe-mapping` + 9 `broken-step3-step4-link`，`apps/cli/src/lib/verify.ts:287-419`），"每步审核通过再推进"在 Step 3 不成立；文档未说明哪些中间态报错可忽略。
- **修复（分两步）**：
  1. **短期（文档）**：quickstart 与 workflow-spec 明示"Step 3 的 keyframe 映射类错误为预期中间态，Step 4 完成后自动清零"；
  2. **中期（代码）**：`verify` 增加 `--step <n>` 选项：`--step 3` 时对"目标步骤文件尚不存在"导致的跨步错误降级为警告（如无 Step 4 文件时 keyframe 映射检查跳过），并输出 `expected-until: step4` 标注；默认全量模式行为不变。
- **验证**：只有 Step 0~3 的项目 `verify --step 3` 通过/仅警告；全量模式仍报错（行为兼容）。
- **回归测试**：`verify.test.ts` 增加分步校验用例。

#### F6 内容级质量门槛无机器执行（第二轮核心发现）
- **现象**：quality-gates 列了大量内容门槛（心理词、导演解释、内部代号、偷继承、可复制版缩水等），checker 实际只实现 3 个禁词 + 4 个段标题存在性检查；"快速导读含导演解释""避免：避免：双前缀"等真实违规 verify 全绿；第二轮 26 条内容级审核意见全部人工审出。
- **修复（务实分档）**：
  - **A 档（本轮）**：`verify.ts` 实现 3~5 条规则化、低误报的内容检查：①"避免："重复前缀检测（`避免：避免：`）；②Step 4 快速导读/可复制版禁止导演解释类心理词（从 quality-gates 禁词表摘取首批词表）；③Step 5 负面约束首条"不得"句必须非模板原句（按镜定制性弱检查）。
  - **B 档（后续迭代）**：在 `quality-gates.md` 为每条门槛标注"机器检查 ✅ / 人工检查 👤"，形成 checker 覆盖地图，逐条自动化。
- **验证**：人工构造违规样例 → verify 命中；合规样例不误报。
- **回归测试**：`verify.test.ts` 新增对应用例。
- **预期管理**：两轮测试结论明确——内容审核的实际承载者是流程纪律（人/本地智能体），修复后仍应保留该预期，文档显式声明"verify 通过 ≠ 内容达标"。

#### F7 init 不播种 Step 2/4/5 模板（第一轮 P3，第二轮独立复现并升 P2）
- **现象**：`init` 后 `02_世界设定/`、`04_图片提示词/`、`05_视频提示词/` 为空目录；文档未提示模板在 `packs/official-ai-video/templates/` 可取，新手会卡住。
- **根因**：`apps/cli/src/lib/init.ts:21` `seedProjectDirectories` 只播种 00/01/03/06。
- **修复**：`seedProjectDirectories` 增加 02（角色/场景设定模板）与 04/05（按镜头组结构的占位说明/模板）播种；quickstart 同步说明。
- **验证**：init 后 02/04/05 目录非空。
- **回归测试**：`init.test.ts` 断言三个目录被播种。

### P3（提示，6 项）

- **F8 CLI 平台枚举不含 midjourney**（两轮独立复现）：`apps/cli/src/lib/constants.ts:36` `SUPPORTED_PLATFORMS` 增加 `"midjourney"`，同步 `project-config.ts` 的 zod 校验；`--image midjourney` 可登记。仅为配置登记能力（MJ 出图不经 CLI），README 平台列表同步更新。
- **F9 raw/ 文件被投影进 Obsidian 观看层**（第一轮）：`scan.ts` 投影时排除 `_资料库/SRC-xxxx/raw/` 目录，保持"raw 不进观看层"边界；`obsidian-export.test.ts` 增加 raw 排除用例。
- **F10 sync 镜像目录命名漂移**（第一轮）：`sync` 生成 `.codex/ai-video-workflow/skills/*.md` 对应母包 `skills-longform/*.md`。选择：统一 `sync.ts` 映射目录名，或在文档把"完整镜像"表述改为"内容同步镜像"并注明映射关系。推荐前者（一处改动）。
- **F11 `WORKFLOW_OVERVIEW.md` §5 仍写 Step 4 含英文版**（第一轮）：与实际模板/规范不符，删除或更正该段。
- **F12 git CRLF 噪音**（第二轮）：仓库根加 `.gitattributes`（`* text=auto` + md 统一 LF），或文档注明 Windows 用户建议 `git config core.autocrlf input`。
- **F13 verify 偶发进程崩溃**（第二轮，未复现）：观察项。若再复现（触发上下文：python heredoc 后同命令链运行 verify），按该上下文构造复现用例再投入修复；当前不投入。

## 三、测试基建（防回归的根）

1. **模板合规回归测试（新增 `tests/template-compliance.test.ts`）**：对 `packs/official-ai-video/templates/` 每个模板，程序化填充一个最小合法项目并断言 `verify` 通过。这是 F3/F4 类"照抄即踩坑"问题的总守护——两轮测试证明模板与校验器没有做过"模板→通过"的回归。
2. **多来源卡 fixture（F2 守护）**：`tests/fixtures/` 增加含 ≥2 张 source-card 的项目 fixture，obsidian 相关测试全部改用/覆盖该 fixture，杜绝"示例单卡掩盖缺陷"类问题。
3. **CI（当前仓库无 CI）**：建议 GitHub Actions 工作流跑 `pnpm verify:v0.2` + 模板合规测试（含 clean clone 场景）。没有 CI，示例覆盖不足类缺陷会反复出现。
4. **验收样例复用**：第二轮测试项目 `G:\avw-r2-e2e-20260817\孤勇与悲歌`（9 来源卡、git 12 提交、含重写历史）可直接作为 F2/F9 修复的手工验收样例。

## 四、文档修订清单

| 文档 | 修订内容 | 对应缺陷 |
| --- | --- | --- |
| `docs/zh/quickstart/*` | Step 3 中间态错误说明；init 播种范围说明；模板取用路径 | F5、F7 |
| `packs/official-ai-video/workflow/quality-gates.md` | Step 2 结构约束；门槛"机器/人工"标注；内容审核预期声明（verify 通过≠内容达标） | F4、F6 |
| `packs/official-ai-video/workflow/workflow-spec.md` | 同上同步；Step 4 无英文版口径 | F4、F6、F11 |
| `README.md` / `README.zh-CN.md` | verify:v0.2 行为描述与实际一致；平台枚举列表；"完整镜像"表述 | F1、F8、F10 |
| `WORKFLOW_OVERVIEW.md` | §5 英文版段删除；镜像表述 | F10、F11 |
| 新增：影响面排查手册 | Step1→2→3→4→5 继承链 + 语义判据（色彩/动作/视线/母题）清单——第二轮证明影响面识别全靠人工，先文档化流程，中期再做 `avw impact <关键词>` 辅助命令（roadmap） | F5 相关 |
| 新增：源层重写操作手册 | git tag 建议、clean-view 时序、增量导出的旧投影清理（增量模式不删旧编号投影） | F2 相关 |

## 五、执行顺序与里程碑

| 里程碑 | 内容 | 预计 | 验收 |
| --- | --- | --- | --- |
| M1 | F2（投影冲突）+ F1（vitest globalSetup sync） | 0.5~1 天 | 两轮测试项目 verify-obsidian 通过；clean clone 全绿 |
| M2 | F3 + F4 + F7（模板与 init） | 1 天 | 模板合规测试新增并全绿；init 后 02/04/05 有模板 |
| M3 | F5 文档 + F6 A 档 + F8 + F9 | 1 天 | 分步校验可用；违规样例被命中；midjourney 可登记；raw 不进观看层 |
| M4 | F10/F11/F12 + 测试基建（多卡 fixture、CI）+ 文档清单 | 0.5 天 | `pnpm verify:v0.2` + 模板合规测试全绿；文档修订落地 |

每里程碑提交后跑 `pnpm verify:v0.2`（含新增测试）全绿为过；F13 单独观察。

## 六、总体验收标准

1. clean clone → `pnpm install && pnpm build && pnpm verify:v0.2` 全绿（F1）。
2. ≥2 来源卡项目 export/verify-obsidian 通过、全部卡可见（F2），rebuild-view 可用。
3. 按官方模板从零填充的项目 verify 一次通过（F3/F4，模板合规测试守护）。
4. 中途项目 `verify --step 3` 不再有 18 个预期错误（F5）；内容违规样例被命中（F6）。
5. `init` 后 Step 2/4/5 有模板（F7）；`--image midjourney` 可登记（F8）。
6. 两轮测试报告的每个问题编号在此计划中可追溯（F1~F13），修复后状态更新回测试报告或本计划。
