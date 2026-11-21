#!/usr/bin/env bash
# 花与竹标签 · 转发节点 —— 部署根目录启动入口
#
# 本脚本只做一件事：定位到脚本所在目录，然后调用离线包内真正的部署脚本
#   ./huayuzhu-relay-offline/deploy.sh
# 真正的部署逻辑（docker run、路径锚定、.env 处理）都在那一个脚本里，
# 避免两处实现不一致。所有部署内容仍限制在 ./huayuzhu-relay-offline/ 下。
#
# Linux 服务器用法：
#   chmod +x start.sh && ./start.sh
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$DIR/huayuzhu-relay-offline/deploy.sh"

if [ ! -f "$TARGET" ]; then
  echo "错误：找不到 $TARGET" >&2
  echo "请确认 huayuzhu-relay-offline 目录与本脚本放在一起。" >&2
  exit 1
fi

exec bash "$TARGET" "$@"
