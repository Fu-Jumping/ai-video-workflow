# 变更请求模板（change request）

> 用途：修改**已完成**步骤内容或既有规范前的申请与影响分析记录。规则：先影响分析并回报对话，确认后再动（`packs/official-ai-video/workflow/quality-gates.md` §1）；语义层排查依据 `docs/zh/workflow/impact-analysis.md`。

## 变更基本信息

- 提出人 / 日期：
- 变更对象：（步骤 / 文件 / 规范 / 模板 / 代码）
- 变更类型：（局部修订 / 换人换景 / 时长规格调整 / 色彩纪律调整 / 整体重写 / 其他）

## 变更内容

- 现状（引用原文位置）：
- 目标状态：
- 动机：

## 影响分析

### 定位改动面

- 命中文件（`grep` / `impact` 命令结果，标注筛选依据）：

### 继承链影响（按 `docs/zh/workflow/impact-analysis.md` §一 逐层判断）

| 下游层 | 是否受影响 | 需联动文件 | 语义判据（色彩纪律 / 动作指纹 / 视线落点 / 时长一致性 / 母题口径） |
| --- | --- | --- | --- |
| Step 1 → | | | |
| Step 2 → | | | |
| Step 3 → | | | |
| Step 4 → | | | |
| Step 5 → | | | |
| Step 6 → | | | |
| Step 7 → | | | |

### 观看层与执行面

- Obsidian 投影是否需重建（增量 / clean-view / rebuild-view）：
- LibTV 执行面是否失效（节点 / 引用边 / 状态）：
- deviations.yaml 是否需要登记偏离：

## 验证计划

- 修改前基线（当前 verify 状态）：
- 修改后验证：`verify`（全量）+ 影响层复核 + `export-obsidian` / `verify-obsidian`（如有观看层）

## 审批

- 用户确认：（等待确认 / 已确认 / 驳回）
- 确认时间 / 备注：
