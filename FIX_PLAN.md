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

---

## 七、防呆机制专项修复（2026-08-28，H1~H6）

- 依据：防呆机制专项隔离测试 `G:\develop-G\tests\avw-foolproof-20260828\REPORT.md`（33 判定点：29 生效 / 2 缺失 / 2 存疑）；缺口登记 `docs/context-engineering/07-decisions-and-open-questions.md` Q10~Q13。
- 被测版本：master @ c8feb78；修复分支：`fix/foolproof-guards-20260828`。
- 原则：零额度（全部 --mock 或假 HOME/假凭据目录）；最小改动；每项带回归测试；init/sync/export 族英文文案、libtv 族中文文案。

| 编号 | 问题 | 对应缺口 | 严重度 |
| --- | --- | --- | --- |
| H1 | `libtv project delete` 无二次确认 | Q10 | 严重 |
| H2 | LibTV 凭据来源无调用级提示 | Q13 | 严重 |
| H3 | `new-pack` 缺工具仓库守卫 | Q12 | 一般 |
| H4 | init 守卫顺序先交互后校验、交互取消出口泄漏内部警告 | REPORT 问题 4 | 一般 |
| H5 | `libtv node/group create --run` 无 `--allow-generation` 生成闸 | Q11 | 提示 |
| H6 | init 绝对目标路径 + verify 失败 Hint（UX 补强） | REPORT 问题 6/7 | 提示·低优先 |

#### H1 `libtv project delete` 二次确认（Q10，严重）
- **现象**：`libtv project delete <uuid>` 一行即执行删除，无任何确认层；`-y, --yes` 帮助文案自述"跳过二次确认（占位）"，带不带 `-y` 行为相同（REPORT.md D6）。
- **根因**：`apps/cli/src/lib/libtv/register.ts` project delete 子命令（:381-391）action 直接调用 `backend.deleteProject`，确认机制从未实现，`-y/--yes` 仅为占位选项。
- **修复方案**：
  1. 无 `--yes` 且 TTY：inquirer confirm 二次确认（default false）；拒绝则抛 `CliUserError`（exit 1、不执行删除、不触后端）。
  2. 无 `--yes` 且非 TTY：拒绝执行，单行可读错误明确"破坏性操作需显式 --yes"。
  3. 带 `--yes`：直接执行。
  4. 帮助文案移除"占位"字样，写清真实语义（跳过二次确认、显式同意删除）。
  5. TTY 下 confirm 被关闭（Ctrl+C/stdin EOF）转为可读错误，不泄漏 `ExitPromptError` 内部形态。
- **验证方法**：`--mock` 下 CLI 子进程回归测试覆盖三条路径；手工复测 REPORT D6 最小复现路径。
- **回归测试**：`apps/cli/tests/libtv-cli.test.ts` 新增 project delete 用例（非交互无 --yes 拒绝且无堆栈；--yes 正常删除）。

#### H2 LibTV 凭据使用可见性（Q13，严重）
- **现象**：本机存在 `~/.libtv/credentials.json` 时，任意目录裸调用 libtv 命令静默携带全局真实凭据，无来源提示；以 `LIBTV_TOKEN` 为空判断"无凭据"不成立（env 与文件是两条独立通道）（REPORT.md D1）。
- **根因**：`apps/cli/src/lib/libtv/credentials.ts` `readLibTvCredentials` 静默解析两通道凭据；`register.ts` `backendWithCredentials` 拿到凭据后直接创建 `HttpLibTvBackend`，无任何调用级提示。
- **修复方案**（最小方案：可见性，不做闸门）：
  1. `credentials.ts` 新增凭据来源描述函数：来源=环境变量 `LIBTV_TOKEN`（存在时，若文件凭据同时在位则注明"token 以环境变量为准"）或解析到的凭据文件路径；账户标识字段存在（`useruuid`，或 `activeAccountId`）时一并显示脱敏形式（前 4 + **** + 后 4）。
  2. `register.ts` `backendWithCredentials` 非 mock 分支在创建 `HttpLibTvBackend` 之前（即任何真实 API 调用之前）向 stderr 打印一行来源提示；每个命令 action 仅调用一次 `backendWithCredentials`，故每命令最多一次。
  3. `--mock` 分支与无凭据路径（`requireLibTvCredentials` 抛错）行为不变。
  4. `docs/context-engineering/00-project-context.md` §6 补充说明：文件凭据为机器全局作用域，真实调用前会打印凭据来源提示。
- **验证方法**：`LIBTV_CONFIG_DIR` 打桩假凭据文件 + `--base-url` 指向本机不可达端口（不触真实 API），断言提示先于网络错误打印且 exit 1；env 通道（`LIBTV_TOKEN`）同样有提示；`--mock` 无提示。
- **回归测试**：`apps/cli/tests/libtv-credentials.test.ts`（函数级来源描述/mask）+ CLI 子进程用例。

#### H3 `new-pack` 工具仓库守卫（Q12，一般）
- **现象**：在工具仓库 `packs/` 目录内执行 `new-pack --name <x>` 成功创建脚手架（EXIT=0），无警告或拒绝；对照 init（嵌套拒绝）与 sync（工具仓库/源码树拒绝）两者皆无（REPORT.md G3）。
- **根因**：`apps/cli/src/index.ts` new-pack action 直接 `targetRoot: process.cwd()`，无任何仓库边界检查。
- **修复方案**：复用 `apps/cli/src/lib/project-root.ts` 的 `isToolRepositoryRoot` / `isSourceSubtree`：
  1. 目标为工具仓库根 → 拒绝（文案风格对齐 sync）。
  2. 目标位于源码子树（apps/packs/scaffolds/schemas/docs）内 → 默认拒绝；提供显式逃生旗标 `--allow-in-tool-repo`（"在仓库内新增官方 pack"为合法开发流），带旗标放行；帮助文案说明用途。
  3. 普通目录行为不变。
- **验证方法**：函数级回归测试四条路径（假仓库根夹具构造 package.json name=ai-video-workflow + apps/cli + packs/official-ai-video）；手工复测 G3。
- **回归测试**：`apps/cli/tests/new-pack.test.ts` 新增守卫用例。

#### H4 init 守卫顺序与交互取消出口（REPORT 问题 4，一般）
- **现象**：在已有项目目录内跑 `init --name sub-proj`（缺 --image 等）先进入交互提示，管道关闭后崩溃并泄漏 `Warning: Detected unsettled top-level await at file:///...index.js:11732` 与 `Error: User force closed the prompt with 13 null`（REPORT.md A3/E 组）。
- **根因**：`apps/cli/src/index.ts` init action（:128-165）在调用 `createProject` 之前先用 inquirer 收集缺失参数；目标合法性校验（`init.ts` `createProject` 内 `validateSafeDirectoryName` + `assertCanInitializeProject`）发生在全部交互之后。inquirer 的 `ExitPromptError` 未转换为用户可读错误。
- **修复方案**：
  1. init handler 在进入任何交互提示之前先做可静态判定的目标检查：`--name` 已提供 → 直接 `validateSafeDirectoryName` + `assertCanInitializeProject`，失败即单行可读错误退出；`--name` 未提供 → 问完 name 后立即校验目标，再进入其余提示（ide/image/video）。
  2. `cli-errors.ts` 新增 `runCliPrompt` 包装：捕获 `ExitPromptError`（按 `error.name` 识别，不 import 未声明依赖）转为单行 `CliUserError`，走 `runCliAction` 正常出口（exit 1，无内部文件/行号泄漏）；init 用英文取消文案。
  3. 正常交互路径与全参数路径行为不变（`createProject` 内既有校验保留，重复只读检查幂等）。
- **验证方法**：CLI 子进程回归测试 (a) 已有项目内缺参 init → 无交互直接嵌套拒绝、exit 1；(b) stdin 关闭 → 单行错误、无 unsettled top-level await 警告、exit 1；(c) 全参数路径不受影响（既有 cli-dist init 用例守护）；手工复测 REPORT A3。
- **回归测试**：`apps/cli/tests/cli-dist.test.ts` 新增 init 守卫顺序与取消出口用例。

#### H5 `libtv node/group create --run` 生成闸（Q11，提示）
- **现象**：`node create -r`（"创建成功后触发生成一次"）与 `group create -r`（"创建成功后整组生成一次"）无任何 `--allow-generation` 检查；对照 refine 硬闸与 apply 显式开关（REPORT.md D5 行为存疑：结构缺闸成立）。
- **根因**：`register.ts` node create（:546 选项、:601 action 透传 `run`）与 group create（:735 选项、:745 透传）直通 backend，无检查。
- **修复方案**：与 refine 同型硬闸——node create、node 默认用法（`node [node]`，用户验收后追加纳入）与 group create 三处各增加 `--allow-generation` 选项；action 开头（`backendWithCredentials` 之前，`--mock` 下同样拦截）检查 `run === true` 且 `allowGeneration !== true` → 抛单行可读错误，文案语义对齐 refine；不带 `-r` 的路径完全不受影响。**实现要点**：`node` 父命令（默认用法）与其子命令 `node create` 存在同名 `-r/--run`、`--allow-generation` 选项，commander 会让父层先行消费这些旗标，子命令 `opts` 收不到——因此三处闸与 `run` 透传统一使用 `getOption` 的祖先冒泡语义判定，避免同名选项作用域差异造成误判。
- **验证方法**：`--mock` 下 CLI 子进程回归测试：`-r` 无开关拒绝 / `-r` + 开关通过 / 不带 `-r` 不受影响 / group create 同套用例 / node 默认用法拒绝与放行两路径；手工复测 D5。
- **回归测试**：`apps/cli/tests/libtv-cli.test.ts` 新增用例（node 默认用法放行路径用显式关闭 stdin 的子进程运行，避免 `readStdinNodeKeys` 在开放式管道上等待）。

#### H6 UX 补强：init 绝对目标路径 + verify 失败 Hint（REPORT 问题 6/7，提示·低优先）
- **现象**：① init 目标解析为 `<CWD>/<name>`，在名为 X 的目录内 `init --name X` 静默创建 `X/X` 嵌套，成功输出首行"已创建项目：X"易被误读（REPORT A5 备注/问题 6）；② verify 失败仅列问题码，未提示 doctor 诊断与 deviation add 通道（REPORT 问题 7）。
- **根因**：① `renderInitNextSteps` 首行只含项目名；② verify 失败分支无下一步引导。
- **修复方案**：
  1. init 成功输出首行补充解析后的绝对目标目录：`已创建项目：<name>（目标目录：<abs path>）`；既有"项目路径"行保留（cli-dist 既有断言不破坏）。
  2. verify 失败（非交互，即非 TTY 双端）在输出末尾追加一行 Hint：提示 doctor 诊断与 deviation add 登记通道；`verify --strict` 语义不变；verify 通过时不打印。
- **验证方法**：CLI 子进程回归测试各一条：init 输出含"目标目录：<abs>"；verify 失败 stderr 含 Hint 且 exit 1。
- **回归测试**：`apps/cli/tests/cli-dist.test.ts` 新增断言/用例。

### 验收门槛（本轮）

1. 每项修复对应模块既有测试套件 + 新增回归测试全绿。
2. 手工复测：REPORT.md 中 D6/D1/G3/A3/D5 最小复现路径逐条重放，确认"之前直接执行/缺闸"现在"拒绝且报错可操作"；全部 --mock 或假 HOME/假凭据目录，零额度。
3. 全量门禁：`pnpm verify:v0.2` 全绿（串行执行）+ `git diff --check` 通过。
4. 更新 `docs/context-engineering/07-decisions-and-open-questions.md` Q10~Q13 状态（写法对齐 Q9）。

---

## 八、防呆复测残余修复（2026-08-30，H7~H8）

- 依据：防呆复测报告 `G:\develop-G\tests\avw-foolproof-retest-20260830\REPORT.md`（评级"可靠"；新发现 一般-1、提示-1）；缺口登记 `docs/context-engineering/07-decisions-and-open-questions.md` Q14、Q15。用户确认"把残余的内容也一并修复"。
- 被测版本基线：master @ 06dcb7e（H1~H6 已全部验收通过）。
- 原则同 §七；本两轮验证均离线（本地 JSON 打桩服务 / 项目夹具），零额度、零真实 API。

| 编号 | 问题 | 对应缺口 | 严重度 |
| --- | --- | --- | --- |
| H7 | 无效 LibTV 凭据下列表命令静默"空成功" | Q14 | 一般 |
| H8 | Step 5 违禁参数检查不覆盖无镜头号的模板文件 | Q15 | 提示 |

#### H7 无效凭据下列表命令静默"空成功"（Q14，一般）
- **现象**：伪造凭据（`LIBTV_CONFIG_DIR` 隔离、假 token）运行真实后端 `libtv project list`，两次（文件凭据/env 通道各一次）均 exitCode=0、stdout 为空——鉴权失败表现为"账号下暂无项目"，与真实现状不可区分（复测报告 E2/E3）。
- **根因**：`api.ts` `unwrapResponse` 只识别同时含 `code` 与 `data` 的信封体；后端对无效 token 返回的其它 200 形状（如空对象）原样穿透，`http-backend.ts` `listProjects` 以 `result.projectMetaList ?? []` 静默回退空数组。HTTP 层（`api.ts` 非 2xx 抛错）与信封层检查都覆盖不到该形状。
- **修复方案**：
  1. `api.ts` `listProjects` 在返回前校验 `Array.isArray(result?.projectMetaList)`；不满足则抛 `CliUserError`，文案说明常见原因（凭据失效/接口结构变更）并给出动作（重新 `libtv login`、复现时带 `--debug`）。
  2. `http-backend.ts` `listProjects` 移除 `?? []` 静默回退（client 层已保证形状）。
  3. `getAccountInfo` 内部的 `listProjects` 调用已有 try/catch 兜底（accountId fallback），行为不变。
- **验证方法**：本地 JSON 打桩服务（127.0.0.1 随机端口，永不触真实 API）覆盖形状矩阵；CLI 子进程级用例复现复测 E2 场景（假凭据 + 空对象 200 响应）断言：exit 1、stdout 为空（不再"空成功"）、stderr 先凭据来源提示后可读错误。
- **回归测试**：`apps/cli/tests/libtv-credentials.test.ts` 新增两个 describe（client 形状矩阵 5 用例 + CLI 级 1 用例）。

#### H8 Step 5 违禁参数检查不覆盖无镜头号的模板文件（Q15，提示）
- **现象**：向镜头组级模板 `05_视频提示词/镜头组-001/视频提示词.md`（文件名不含 `镜头-<n>`、无 shotId）注入 `--ar 21:9` 等图片平台参数，verify 通过；同类注入落在 shot 域文件会被 `step5-forbidden-image-platform-parameter` 拦截（复测报告 B3 首次注入尝试）。
- **根因**：`verify.ts` `verifyStep5PlatformExecutionSettings` 的违禁参数扫描嵌在 `step === 5 && shotId !== undefined` 的 shot 域循环内；组级模板作为"照抄即合规"的种子会被复制进单镜文件，用户先踩一次 verify 失败才能发现，或模板自身永不触发检查。
- **修复方案**：
  1. 违禁参数扫描从 shot 域循环中拆出，独立遍历全部 `step === 5` 文件（含组级模板）；问题码、文案、path 字段不变。
  2. 平台执行合同、Seedance 设置、负面约束等其余 per-shot 检查保持 shot 域不变（组级文件无单镜合同语义）。
  3. 官方组级模板 `packs/official-ai-video/templates/05_视频提示词/视频提示词.md` 实测不含四项违禁参数（`--v 8.2`/`--ar`/`--style raw`/`--stylize`），"照抄即合规"不破坏；示例项目 `examples/官方示例-云上早市` Step 5 仅含 shot 域文件，不受影响。
- **验证方法**：verify.test.ts 新增组级模板注入用例（断言问题码 + path 指向组级文件）；既有 step5 用例（shot 域注入）继续通过证明无回归；全量门禁含 `example:verify` 守护示例项目。
- **回归测试**：`apps/cli/tests/verify.test.ts` 新增 1 用例。

### 验收门槛（本轮）

1. 定向测试（verify / libtv-credentials）+ 全量门禁 `pnpm verify:v0.2` 全绿（串行）+ `git diff --check` 通过。
2. 手工重放两条最小复现路径（离线等价形式）确认修复生效。
3. 更新 `docs/context-engineering/07-decisions-and-open-questions.md` Q14、Q15 状态与 CHANGELOG。

---

## 九、R4 隔离测试发现（2026-10-25，I1—I7，登记待修）

- 依据：第 4 轮隔离端到端测试（坟场段同题重做，被测提交 `6519694`；测试根 `avw-r4-e2e-20261025/REPORT.md`，路径按 D12 机器映射解析；报告含主对话终审区）。用户 2026-10-25 拍板「登记」。LibTV 真实生成链因本机凭据失效未验证（外部状态，已拍板归档留待下次整测）。同轮拍板的「05 执行文件调序、可复制提示词前置」随本批直接修复，不占本节编号。

| 编号 | 问题 | 严重度 | 状态 |
| --- | --- | --- | --- |
| I1 | content check 的恢复指引未提示手改后需 `--force` | 一般 | ✅ 已修（J 批同修，`83c9555`/`211dad9`：8 处文案补 --force 提示） |
| I2 | `libtv --mock` 画布注册表为进程内存态，跨进程不可用 | 一般（限制） | ✅ 已修（文档口径：帮助与 zh/en 文档标注限制）；**持久化经用户 2026-10-26 拍板「不做、归入关闭项」** |
| I3 | `libtv apply --dry-run` 与 `plan` 不一致：未绑定画布时无法预演 | 一般 | ✅ 已修（`83c9555`：dry-run 未绑定按「未绑定」出预演） |
| I4 | Obsidian 单镜头页镜头组链接标签错（显示为分镜名） | 提示 | ✅ 已修（`dc7f7d3`：标签显示「镜头组-001」） |
| I5 | 07_发布物料模板「来源亮点」仍指向旧结构路径 | 提示 | ✅ 已修（`47a3a79`：四模板改指内容树路径） |
| I6 | `--allow-generation` 门禁检查位于鉴权之后 | 提示 | ✅ 已修（`83c9555`：门禁前移；行为变化=裸 apply 改报错退出，用户 2026-10-26 确认新口径） |
| I7 | `research ingest` 对本地文件 platform 记为 web，与 source_kind 不一致 | 提示 | ✅ 已修（`1e62e5f`：本地来源记 local，仅工具自动标注） |

#### I1 content check 的恢复指引未提示需要 --force（一般）
- 现象：手改 05 执行文件后 `content check` 报「请重新整理」，但裸 `content assemble` 因 manual-drift 保护不覆盖手改内容，按提示操作后 mismatch 仍在。
- 最小复现：手改任一 05 执行文件可复制提示词 → `content check` → `content assemble` → mismatch 仍在；须 `content assemble --force`（覆盖前备份到 `.tmp/`）才恢复。
- 修复方向：`content-summary-execution-mismatch` / `content-execution-stale` 文案补充「自动区块被手改时需 `content assemble --force`」。

#### I2 libtv --mock 非持久化，跨进程不可用（一般·限制）
- 现象：`libtv --mock project create` 的画布注册表为进程内存态，新进程即报 `Mock project not found`；mock 实际只服务仓库自身测试，无法用于离线链路演示。
- 修复方向：提供可选的 mock 状态持久化，或在 libtv 文档标注该限制。

#### I3 libtv apply --dry-run 也要求画布绑定（一般）
- 现象：`plan` 无需绑定即可出计划；`apply --dry-run` 未绑定时先报「缺少画布」，两者不一致，无法预演 apply。
- 修复方向：dry-run 在未绑定时按「未绑定」出预演计划。

#### I4 Obsidian 单镜头页链接标签错误（提示）
- 现象：单镜头页指向镜头组文件的链接标签显示为分镜名（如「分镜-01」），应为「镜头组-001」。
- 修复方向：修正投影层标签模板。

#### I5 发布物料模板旧结构路径（提示）
- 现象：07_发布物料模板的「来源亮点」引用 `../03_分镜脚本/镜头组-001/00_镜头组说明.md`，内容树模式下不存在。
- 修复方向：模板路径改为指向 `../内容/…`。
- 补注（2026-10-25 R5 复查，范围修正）：不止「来源亮点」一处——`07_发布物料/01_标题.md`、`02_简介正文.md`、`03_话题标签.md`、`04_封面文案.md` 四个模板文件均含 `../03_分镜脚本/镜头组-001/…` 旧路径引用。

#### I6 --allow-generation 门禁检查位于鉴权之后（提示）
- 现象：凭据失效时不带旗标先报「用户未授权」，门禁提示文案本身无法验证（R4 环境）。
- 修复方向：把缺 `--allow-generation` 的检查前移到鉴权之前。

#### I7 research ingest 本地文件 platform 记为 web（提示）
- 现象：本地 md 导入后 source-card 的 platform 为 web 而 source_kind 为 local-file，字段语义不一致。
- 修复方向：本地文件 platform 置空或标 local。

### 验收门槛（本节）

- I1—I7 逐项修复时按本文件 §一 修复原则（模板与文档服从校验器合同、最小改动、每项带回归测试），修复后更新本节状态与对应测试。

## 十、R5 验证轮发现（2026-10-25，J1—J7，登记待修）

- 依据：第 5 轮隔离验证（同题重做，被测提交 `257e7c9`；测试根 `avw-r5-verify-20261025/REPORT.md`，含主对话终审区）。两条独立验证线：隔离子代理全新创作项目（R1+R2 全绿，546 用例）与主对话构想符合性核对/I1—I7 复查（全新 init、官方示例、R4 存量副本、真实旧项目快照副本四种载体实测；证据见测试目录 `.tmp/主对话核对-任务AB.md`）。用户 2026-10-25 拍板：①登记本节并附最小复现与根因定位；②**J1—J7 与 §九 I1—I7 合并一个小批一次修完**；③当前版本推送 GitHub；④阶段 04 工作树清理。
- 同轮复验：R4 拍板的 05 执行文件调序三侧生效（新项目/官方示例/存量自动迁移，二次整理幂等）；I1—I7 全部原样存在（I5 范围已在上节修正）。

| 编号 | 问题 | 严重度 | 状态 |
| --- | --- | --- | --- |
| J1 | 同镜跨分镜关键帧同号 → 04 执行文件双渲染争用，assemble/check 永不收敛且无冲突报错 | 严重 | ✅ 已修（`211dad9`：解析校验+争用显式报错+迁移器保留旧编号，真实旧项目载体收敛复核通过） |
| J2 | 素材文件路径双轨：记录自检按对象编号、粗剪时长探测按内部编号，且均未文档化 | 严重 | ✅ 已修（`22b1fb7`：以素材记录身份为唯一取径，说明补目录约定） |
| J3 | midjourney 项目 04 执行文件渲染「Midjourney」，verify 要求字面小写 `midjourney` | 一般 | ✅ 已修（`211dad9`：渲染层枚举小写+显示名另起行，校验器未动） |
| J4 | 关键帧「整镜连续编号」隐含规则未写入规范/模板/示例 | 一般 | ✅ 已修（`47a3a79`：workflow-spec §3.1 与分镜卡补规则） |
| J5 | 素材记录「当前选用」应填候选文件名未文档化（写「是」显示「未选」） | 一般 | ✅ 已修（`22b1fb7`：说明补示例与反例） |
| J6 | verify-and-iterate.md「Step 3 预期中间态」为旧版 03 镜头卡口径 | 提示 | ✅ 已修（`74b2b93`：zh/en 补内容树口径） |
| J7 | init 在当前目录建项目，快速上手未提醒先切到目标父目录 | 提示 | ✅ 已修（`74b2b93`：README 与 quickstart zh/en 补提醒） |

#### J1 同镜跨分镜关键帧同号，执行文件永不收敛（严重）
- 现象：同一镜头的两个分镜各自声明「关键帧 01」时，`04_图片提示词/…/镜头-NNN-关键帧-01.md` 被两份不同渲染结果争用：`content assemble` 每轮报「更新 1 个文件」而文件字节数轮间不变，`content check` 永远报 `content-execution-stale`，verify 随之永红，全程无「编号冲突」提示。两条独立路径均触发：子代理全新项目按模板常识填写；主对话真实旧项目迁移（`seeyouinthesouth_test` 快照副本，迁移器把旧项目镜内全局唯一的关键帧-01/-02 重编为分镜各自的「01」，镜头-015 即现成案例）。
- 根因（文件+函数级）：① 内容树解析不校验镜内关键帧编号唯一性；② `apps/cli/src/lib/content-assemble.ts` 按 (shot, storyboard, keyframe) 逐份渲染 step4 plan（约 :1108—1113），同 relPath 产生两条 plan；③ 写入侧 `changes.find(relPath)` 只认第一条（约 :1146/:1151），报告侧合并去重偏好 update（约 :1168）——「报更新、写一条、查两条」。
- 最小复现：任一项目同一镜头两个分镜文件各写 `#### 关键帧 01` → `content assemble` → `content check` → 反复整理不收敛。
- 修复方向：内容树解析对镜内关键帧编号做唯一性校验（重复即报错并指明分镜）；迁移器保留旧项目镜内全局关键帧编号、不按分镜重排；assemble 检测同 relPath 多 plan 冲突时显式报错而非静默双写。与 J4 文档规则同步落地。

#### J2 素材文件路径双轨（严重）
- 现象：同一支视频文件，verify 的素材记录自检按 `outputs/video/<记录对象编号>/`（如 `镜头-001`）查「已下载」，roughcut 时长探测按 `outputs/video/<内部编号>/`（如 `shot-001`）查同一文件；手工导入素材只放一处，则「verify 报 media-record-missing-file」或「粗剪时长列=未知」二者必居其一；两条路径约定均未写入 `素材记录/00_素材记录说明.md`。
- 根因：`apps/cli/src/lib/media-records.ts:306` 以记录身份 objectId 拼路径；`apps/cli/src/lib/roughcut.ts:132—134` 以 shot 内部编号拼路径。
- 最小复现：登记一条已下载视频记录（对象编号 镜头-001）→ 文件只放 `outputs/video/镜头-001/` → verify 通过但 `roughcut plan` 时长未知；文件只放 `outputs/video/shot-001/` → verify 报记录文件不存在。
- 修复方向：统一取径（以素材记录身份为唯一口径，roughcut 复用同一函数）；`素材记录说明` 补目录约定。

#### J3 midjourney 平台名大小写口径不一致（一般）
- 现象：midjourney 项目 04 执行文件「平台执行参数」表渲染 `| 图片平台 | Midjourney |`，`verify` 报 `missing-step4-platform-execution-setting`（要求小节含字面小写 `midjourney`）；真实旧项目迁移实测 24 个文件全部命中。
- 根因：`content-assemble.ts:464` 以 `PLATFORM_DISPLAY_NAMES.midjourney = "Midjourney"`（`constants.ts:58`）渲染；`verify.ts:58` 要求字面小写 `midjourney`。
- 最小复现：`init --image midjourney` 的内容树项目推进到 Step 4 并 assemble → verify（迁移项目实测；全新项目为渲染路径共用的代码层推断，待实机复核）。
- 修复方向：按 §一「模板与文档服从校验器合同」原则统一口径（校验器改大小写不敏感，或渲染层用枚举小写），择一后带回归测试。

#### J4 关键帧整镜连续编号规则未文档化（一般）
- 现象：关键帧编号须整镜连续（跨分镜不重启）是隐含规则，违反时表现为 J1 的「陈旧循环」而非「编号冲突」报错；`workflow-spec.md` §3.1、分镜模板与官方示例均未写明（官方示例全是单关键帧镜头）。
- 修复方向：workflow-spec §3.1 与分镜模板补规则说明；模板合规测试覆盖跨分镜多关键帧编号（配合 J1 唯一性校验）。

#### J5 素材记录「当前选用」语义未文档化（一般）
- 现象：记录级「当前选用」应填所选候选的文件名；写成「是」时 media-list 显示「未选」，仅可从 media-list 输出与源码推知。
- 修复方向：`素材记录/00_素材记录说明.md` 补示例与反例。

#### J6 verify-and-iterate.md Step 3 预期中间态为旧口径（提示）
- 现象：文档按旧版 03 镜头卡口径描述（invalid-keyframe-mapping / broken-step3-step4-link）；内容树项目 03 只有索引文件，实测 Step 3 无此中间态。
- 修复方向：补内容树模式口径。

#### J7 init 在当前目录建项目未提示（提示）
- 现象：init 在当前工作目录下建项目，快速上手未提醒先 `cd` 到目标父目录；R5 两轮（子代理与主对话）各误建一次（均已删除重建）。
- 修复方向：README/quickstart 补一句操作提醒。

#### J8 verify 整镜正文比对对 CRLF 敏感，旧项目迁移场景误报 content-execution-stale（一般，阶段 05 第一批发现）——✅ 已修（2026-10-26 主线小批 `a760d8f`）
- 现象：分镜文件含 CRLF 行尾时（Windows 旧项目迁移场景典型状态），`verify` 对 05 执行文件报 `content-execution-stale`，而同一状态下 `content check` 判一致、`content assemble` 幂等——两个命令结论相反。
- 根因（实证，阶段 05 执行对话）：`verify.ts` `sectionAfterHeading` 用 `content.split(/\r?\n/)` + `join("\n")` 取「可复制提示词」小节，把 CRLF 规范成 LF；比对对象 `shot.assembly.text` 保留分镜文件原样 CRLF → 逐字比较不等（实测两值 1026 vs 1038 字符，差异处为 `\r\n` vs `\n`；LF 规范化后归零）。`content-assemble.ts` 的 `extractCopyablePrompt` 用正则直接切原文（保留 `\r`），故 check 判等。
- 最小复现：任一项目把任一分镜文件转为 CRLF 行尾 → `content assemble` → `content check` 通过而 `verify` 报 1 条 `content-execution-stale`。
- 修复方向（用户 2026-10-26 拍板）：a) `verify` 比较前对两侧统一规范化行尾（改动最小）。回归测试须覆盖「CRLF 分镜项目 verify 与 content check 双绿」。
- 备注：不影响 J1 验收点；测试项目全为 LF，故 R4/R5 未暴露。
- 修复回填：verify 三处比较（summaryFresh、05 可复制提示词 vs 拼装正文、vs 汇总整段）前对两侧统一 LF 规范化；回归测试「CRLF 分镜项目 verify 与 check 双绿」红绿对照成立（修复前 verify.ok=false）；门禁 build / test（43 文件 562 用例）/ example:verify 全绿，docs 未动豁免 docs:build。

#### J9 content-tree 小节解析对整文件 CRLF 失效（一般，2026-10-26 J8 小批发现）——✅ 已修（2026-10-26 主线小批 `e9b9b64`）
- 现象：分镜文件整份为 CRLF 行尾时（Windows 编辑器保存或 git autocrlf 检出即触发），小节一个都识别不出：verify 连报三条 content-identity-invalid（缺本段正文/关键帧/视频提示词区块），内容树完全不可用。
- 根因（J8 小批实测）：JS 正则的 `.` 不把回车符当普通字符，`SECTION_HEADING_PATTERN = /^(#{2,3})\s+(.+)$/u` 在行尾带 \r 时不命中 → `splitSections` 切不出任何小节。探针：LF 解析 0 问题，同内容整文件 CRLF 解析连报 3 条 content-identity-invalid（临时探针测试已复现并移除）。
- 最小复现：任一项目把任一分镜文件整体转为 CRLF 行尾 → verify / content check 连报缺区块。
- 修复方向（候选，待拍板）：`splitSections` 改 `content.split(/\r?\n/)`（与 verify 的 sectionAfterHeading 同法）；KEYFRAME_HEADING_PATTERN 等按行匹配的正则同步核对；回归测试「整文件 CRLF 分镜项目解析与 verify 双绿」。注意与 J8 的现场差异：迁移器产出的文件是「标题 LF + 块内 CRLF」混合形态，J8 只覆盖比对层。
/)`（与 verify 的 sectionAfterHeading 同法）；KEYFRAME_HEADING_PATTERN 等按行匹配的正则同步核对；回归测试「整文件 CRLF 分镜项目解析与 verify 双绿」。注意与 J8 的现场差异：迁移器产出的文件是「标题 LF + 块内 CRLF」混合形态，J8 只覆盖比对层。
- 修复回填（2026-10-26 主线小批直修，用户拍板）：splitSections 切行改归一回车符 + firstHeading 行尾容忍回车符；区块标记解析（\s 容忍且依赖原始下标）不动。回归测试「整文件 CRLF 分镜项目解析与 verify 双绿」红绿对照成立（修复前必红）；全量 43 文件 563 用例、build、example:verify 全绿。

#### J10 迁移器同一分镜多张关键帧只迁第一张（一般）——✅ 已修（2026-10-26 主线小批 `c803782`）
- 现象：旧项目同一分镜挂多张关键帧时，迁移只取第一个匹配的旧 04 文件，其余关键帧静默丢失。
- 根因：`migration-preview.ts` 用 `find` 取该分镜第一份关键帧文件。
- 修复：收集该分镜全部旧 04 文件、按镜内编号排序逐张写入；编号沿用旧编号不重排（J1 口径）。回归测试覆盖两张关键帧同分镜全部迁入 + 迁移后 check 收敛 verify 通过，红绿对照成立；564 用例全绿。
- 备注：此前「维持现状」的拍板（2026-10-26 阶段 05 回执 §8.4）由用户当日改为「可以做」，本条据此执行。
### 验收门槛（本节）

- J1—J7 与 §九 I1—I7 按用户拍板合并一个小批修复；逐项按 §一 修复原则执行（模板与文档服从校验器合同、最小改动、每项带回归测试）；修复后更新两节状态与对应测试。
- **批次完成登记（2026-10-26，主对话独立检查后回填）**：J1—J7 与 I1—I7 全部修复于阶段 05 第一批（7 个分项提交 `211dad9`…`74b2b93`，15 个新增回归测试，基线 546 → 561 用例）；每项修复前红/修复后绿证据与逐项细节见阶段工作树交付报告（已抢救至主工作区 `.tmp/stage-05-archive/stage-05-batch1-report.md`）。快进合并 57a3c4d → `74b2b93`，合并后主工作区四道门禁全绿（build / test 43 文件 561 用例 / example:verify / docs:build）。独立检查另证实：J1 真实旧项目载体（midjourney）的 verify 平台报错 28→0、stale 2→0，绝对路径链接报错维持既有内容问题不变。I2 的 mock 持久化与「同分镜多关键帧迁移」维持现状（用户拍板）。J8 留待下批修复。


## 十一、R6 快速复测轮发现（2026-10-26，K1—K5）

- 依据：第 6 轮隔离复测（被测提交 `80ddab9`；测试根 `avw-r6-retest-20261026/REPORT.md`，含主对话终审区）。主链路全绿，B1—B11 修复点全部隔离复现生效（I/J 系列确认根治）。新发现 5 项均经主对话代码级核实；用户 2026-10-26 拍板：全部登记，K1/K2/K5 当轮直修，K3/K4 留待后续。

| 编号 | 问题 | 严重度 | 状态 |
| --- | --- | --- | --- |
| K1 | 正文裸 `https://` 链接被误判为绝对路径链接（`[A-Za-z]:\/` 命中 URL 里的 `s:/`） | 一般 | ✅ 已修（`098c862`：盘符分支负向后行断言，两处同改） |
| K2 | 项目级校验剥离行内代码而观看层校验不剥离，同一内容两套口径，投影侧无法自修 | 一般 | ✅ 已修（`098c862`：verify-obsidian 同口径剥离） |
| K3 | `research ingest` 自动编号只看 `_资料库/` 现有目录，不读资料索引手工占号，易撞号 | 提示 | 待修 |
| K4 | 素材记录「身份键」内部格式（如 `video:镜头-001/视频`）未写入说明；解析失败报错不含字段 | 提示 | 待修 |
| K5 | 中文 `README.zh-CN.md` 与新手页缺「先 cd 到父目录再 init」提醒（J7 覆盖面遗漏） | 提示 | ✅ 已修（`4d5693e`：两处中文入口补同款提醒） |

#### K1/K2 详情

- K1 现象与根因：`verify.ts`/`obsidian/verify.ts` 的 `absoluteLinkPattern` 中 `[A-Za-z]:\/` 会把 `https://` 里的 `s:/` 当盘符路径；正文（非行内代码）裸外链只能塞进反引号绕过。修复：盘符分支加 `(?<![A-Za-z])` 断言（`someC:/x` 这类粘连写法随之放行，可接受）；`file://`、`vscode://`、markdown 根链接 `](/` 检测不变。
- K2 现象与根因：项目级 `verify.ts` 检测前 `content.replace(inlineCodePattern, "")`，观看层 `verifyNoAbsoluteLinks` 直接测原文——行内代码里的路径在项目侧合法、投影侧报错且用户无从修复。修复：观看层同口径剥离。
- 回归测试：verify.test.ts「K1」断言裸 https 不报、盘符路径仍报；obsidian-verify.test.ts「K2」断言行内代码路径过项目与观看层双校验；均红绿对照成立。
- 观察项 O1（随登记留档）：`roughcut plan --check` 在缺素材时退出码 1 属交付门禁口径，建议后续在用户文档点明，不单开编号。

### 验收门槛（本节）

- K1/K2/K5 已修并有回归测试与门禁记录；K3/K4 择机修（建议与下次小批合并），修复时按 §一 原则执行并回填状态。

## 十二、Issue #3 提案落地：Step 1 动笔前决策访谈门禁（2026-10-26，L1—L3）

- 依据：外部用户 KillZero12138 在 GitHub `Fu-Jumping/ai-video-workflow` 提交 Issue #3（2026-10-26）：剧本模式实测中，智能体不提问直接改写剧本并写完故事内核，`verify` 仍报通过——Step 1 只有"写后审核点"，没有"写前访谈门禁"。主对话已逐处核对，issue 引用的 10 处文件与行号和本地代码全部属实。
- 用户拍板（2026-10-26）：按提案全盘采纳口径（提案中的"原始剧本.md"对齐本地命名 `剧本.md`）；verify 先软警告、稳定后再议硬拦截；主线小批直修（不开阶段工作树）；开修后统一回复 issue。第二拍板（同日）：约束强化 1+2（首答必须是访谈问题 + 访谈留痕校验）当轮直修；E2E 行为验证排入下次测试轮；强化完成后回复 issue。

| 编号 | 内容 | 状态 |
| --- | --- | --- |
| L1 | P0 契约与模板：workflow-spec Step 1 补"动笔前决策访谈"；quality-gates 补 Step 1 决策门槛（§2.5）与 §1.3/§8 归属；film-planner 长文源与 SKILL 补访谈协议；新增模板 `01_概念策划/00_决策记录.md`（P0 九问骨架，状态 `confirmed`/`pending`/`user-delegated default`）；故事内核模板加"先访谈"抬头；init 播种与首条消息、生成 AGENTS.md 对话引导、根 AGENTS.md 停下确认清单同步口径 | ✅ 已修（`7dc2256`） |
| L2 | P1 校验信号：verify 新增警告通道（`warnings`，不阻塞 ok）与三条 Step 1 软检查——内核含 `[assumption]`、内核已填但无决策记录、决策记录仍有 `pending`；doctor 输出决策提醒与"先访谈再进 Step 2"提示 | ✅ 已修（`7dc2256`） |
| L3 | P2 文档与测试：中英 quickstart 与 step-01 用户文档补"先访谈后动笔"；init/sync/verify-step 测试覆盖新模板、生成文本与三类警告；官方示例补一份已确认决策记录保持零警告 | ✅ 已修（`7dc2256`） |
| L4 | 约束强化（第二拍板）：契约与生成文本钉死「进入 Step 1 的第一个实质性回复必须是访谈问题，不得先给分析、梗概或剧本改写」；决策记录模板"访谈记录"节改「日期+覆盖编号+答复要点」留痕格式；verify 新增第四条软警告 `step1-interview-log-empty`（访谈记录仍为模板占位）；官方示例访谈记录补日期 | ✅ 已修（2026-10-26 强化小批） |

### 验收门槛（本节）

- 全新 init 项目（两种起点）自带 `00_决策记录.md`；README、首条消息、生成的项目 AGENTS.md 都说"先访谈后动笔"（sync.test 断言钉住）。
- verify 全绿语义不变（软警告不阻塞）：新项目零警告；"内核已填没决策记录 / 决策记录有 `pending` / 内核含 `[assumption]`"三态各出对应警告（红绿对照测试）。
- 官方示例补决策记录后 example:verify 仍全绿零警告；`pnpm verify:v0.2`（build + 全量测试 + example:verify）通过。
- **批次完成登记（2026-10-26，主对话直修）**：L1—L3 全部落地（提交 `7dc2256`）。门禁：`pnpm build`（CLI + docs:build）绿；测试 43 文件 571 用例全绿（新增 5 个 Step 1 决策门禁用例：新项目零警告、`[assumption]`/缺决策记录/`pending` 三态警告、全确认后零警告）；example:verify 通过且零警告；另以 dist CLI 冒烟验证真实输出——`verify` 打印 `Warnings (1, non-blocking)` 且仍 `Verification passed`，`doctor` 输出 Step 1 决策提醒与"先访谈再进 Step 2"下一步提示。实现要点：`VerificationResult` 新增可选 `warnings` 键（空时省略，兼容既有 `toEqual({ ok, issues })` 断言）；内核"已填写"判定用「字段：内容」非表格行计数（阈值 3），模板抬头（引用块/标题）中的 `[assumption]` 字样不算正文标记。
- **强化批登记（2026-10-26，第二拍板，L4）**：首答访谈规则写入 film-planner 长文源与 SKILL、quality-gates §2.5、生成的项目 AGENTS.md 对话引导（sync.test 断言钉住）、step-01 中英用户文档；决策记录模板访谈记录节改留痕格式（占位行形态为合同：`- 第 N 组（…）：` 冒号后无内容）；verify 新增 `step1-interview-log-empty`（内核已填 + 决策记录存在 + 访谈记录节缺失或仍为占位 → 软警告）；doctor 分组表同步。门禁：build 绿、43 文件 572 用例全绿（新增访谈占位警告用例，"全确认零警告"用例同步补留痕）、example:verify 零警告、dist 冒烟单条 `step1-interview-log-empty` 输出正确。边界说明：存在性检查抓不住"伪造已确认记录"（机器无法证明用户真的答复过），由留痕提高伪造成本 + E2E 行为验证兜底；E2E（粗剧本→先问再写）排入下次隔离测试轮，软警告升硬拦截待该轮后另议；Issue #3 已于同日回复（改动尚未推送远端，回复中已说明将随下次推送合入）。