#!/usr/bin/env bash
# 示例：本地 AI 视频项目 -> LibTV 素材执行链路
# 用法：
#   PROJECT=<项目路径> CANVAS=<画布UUID> bash examples/libtv/run-asset-pipeline.sh
set -euo pipefail

PROJECT="${PROJECT:?需要设置 PROJECT 为本地项目路径}"
CANVAS="${CANVAS:?需要设置 CANVAS 为画布 UUID}"

CLI="node apps/cli/dist/index.js"

echo "== 绑定画布 =="
(cd "$PROJECT" && "$CLI" libtv project use "$CANVAS")

echo "== 计划 =="
"$CLI" libtv plan --project "$PROJECT"

echo "== 上传锚点 =="
"$CLI" libtv --mock apply --project "$PROJECT" --only anchors --dry-run

echo "== 生成关键帧 =="
"$CLI" libtv --mock apply --project "$PROJECT" --only keyframes --dry-run

echo "== 状态 =="
"$CLI" libtv --mock status --project "$PROJECT"
