#!/usr/bin/env bash
# 花与竹标签 · 转发节点 离线一键部署（Linux）
# 用法：把本目录整体拷到服务器，chmod +x deploy.sh && ./deploy.sh
set -e

cd "$(dirname "$0")"

echo "==> 检查 Docker"
if ! command -v docker >/dev/null 2>&1; then
  echo "错误：未找到 docker，请先安装 Docker 与 Docker Compose 插件。" >&2
  exit 1
fi
docker info >/dev/null 2>&1 || { echo "错误：Docker 守护进程未运行。" >&2; exit 1; }

echo "==> 准备 .env"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "已生成 .env —— 请先编辑它，设置 RELAY_ADMIN_TOKEN 后再运行本脚本。"
  echo "例如：sed -i 's/^RELAY_ADMIN_TOKEN=.*/RELAY_ADMIN_TOKEN=你的强令牌/' .env"
  exit 1
fi
if grep -q '^RELAY_ADMIN_TOKEN=change-me-to-a-long-random-string' .env; then
  echo "错误：请先在 .env 中把 RELAY_ADMIN_TOKEN 改成自己的强随机字符串。" >&2
  exit 1
fi

echo "==> 导入镜像（离网可用，若已导入会跳过）"
if docker image inspect huayuzhu-relay-node:1.0.0 >/dev/null 2>&1; then
  echo "镜像已存在，跳过导入。"
else
  docker load -i image/huayuzhu-relay-node-image.tar
fi

echo "==> 准备数据目录"
mkdir -p data

echo "==> 启动服务"
if docker compose version >/dev/null 2>&1; then
  docker compose up -d
elif command -v docker-compose >/dev/null 2>&1; then
  docker-compose up -d
else
  echo "错误：未找到 docker compose（插件或独立命令）。" >&2
  exit 1
fi

echo
echo "==> 完成。等待健康检查..."
sleep 3
docker compose ps 2>/dev/null || docker-compose ps 2>/dev/null || true

PORT=$(grep '^RELAY_PORT=' .env | cut -d= -f2 | tr -d ' \r')
PORT=${PORT:-8787}
echo
echo "管理界面:  http://<服务器IP>:${PORT}/admin"
echo "健康检查:  http://<服务器IP>:${PORT}/health"
echo "扩展地址:  http://<服务器IP>:${PORT}/"
echo "日志查看:  docker compose logs -f"
