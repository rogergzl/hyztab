#!/usr/bin/env bash
# 花与竹标签 · 转发节点 —— 离线一键部署（docker run，不依赖 compose 插件）
#
# 所有部署内容都限制在本脚本所在的 ./ 目录下，不写别处：
#   ./image/huayuzhu-relay-node-image.tar   预构建镜像
#   ./.env                                  配置（含管理令牌）
#   ./data/                                 持久化数据（分享/密钥/日志/设置）
#
# 用法：把整个目录拷到服务器，chmod +x deploy.sh && ./deploy.sh
# 想用 docker compose / 1Panel 的话，包里也保留了 docker-compose.yml，
# 手动 docker load -i image/*.tar 后 docker compose up -d 即可。
set -e

# 定位到脚本所在目录，保证下面所有 ./ 路径都落在服务端目录内
cd "$(dirname "$0")"
ROOT="$(pwd)"

IMAGE="huayuzhu-relay-node:1.0.0"
TAR="./image/huayuzhu-relay-node-image.tar"
NAME="huayuzhu-relay-node"

echo "==> 部署目录: $ROOT"

echo "==> 检查 Docker"
if ! command -v docker >/dev/null 2>&1; then
  echo "错误：未找到 docker，请先安装 Docker。" >&2
  exit 1
fi
docker info >/dev/null 2>&1 || { echo "错误：Docker 守护进程未运行。" >&2; exit 1; }

echo "==> 准备 ./.env"
if [ ! -f ./.env ]; then
  cp ./.env.example ./.env
  echo "已生成 ./.env —— 请先设置 RELAY_ADMIN_TOKEN 后再运行本脚本。"
  echo "例如: sed -i 's|^RELAY_ADMIN_TOKEN=.*|RELAY_ADMIN_TOKEN=你的强令牌|' ./.env"
  exit 1
fi
# 逐行解析需要的键，避免 source 执行 .env 里的任意内容
conf() {
  local key="$1" line
  line=$(grep -E "^${key}=" ./.env | head -n1 || true)
  printf '%s' "${line#*=}" | tr -d '\r'
}
ADMIN_TOKEN=$(conf RELAY_ADMIN_TOKEN)
PORT=$(conf RELAY_PORT);             PORT=${PORT:-8787}
BASE_PATH=$(conf RELAY_BASE_PATH)
PROXY_TOKEN=$(conf RELAY_PROXY_TOKEN);   PROXY_TOKEN=${PROXY_TOKEN:-false}
ALLOW_PRIVATE=$(conf RELAY_ALLOW_PRIVATE); ALLOW_PRIVATE=${ALLOW_PRIVATE:-true}
MAX_LOGS=$(conf RELAY_MAX_LOGS);     MAX_LOGS=${MAX_LOGS:-5000}

if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = "change-me-to-a-long-random-string" ]; then
  echo "错误：请先在 ./.env 中把 RELAY_ADMIN_TOKEN 改成自己的强随机字符串。" >&2
  exit 1
fi
if [ ! -f "$TAR" ]; then
  echo "错误：找不到镜像文件 $TAR（请确认 image/ 目录随包一起拷贝）。" >&2
  exit 1
fi

echo "==> 导入镜像（离网可用；已导入则跳过）"
if docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "镜像 $IMAGE 已存在，跳过导入。"
else
  docker load -i "$TAR"
fi

echo "==> 处理同名旧容器"
if docker ps -a --format '{{.Names}}' | grep -qx "$NAME"; then
  echo "发现同名容器 $NAME，先停止并删除（数据保存在 ./data，不受影响）。"
  docker rm -f "$NAME" >/dev/null
fi

echo "==> 准备数据目录 ./data"
mkdir -p ./data

echo "==> 启动容器（数据卷: $ROOT/data -> /app/data）"
docker run -d \
  --name "$NAME" \
  --restart unless-stopped \
  -p "${PORT}:8787" \
  -v "${ROOT}/data:/app/data" \
  -e RELAY_HOST=0.0.0.0 \
  -e RELAY_PORT=8787 \
  -e RELAY_DATA_DIR=/app/data \
  -e "RELAY_ADMIN_TOKEN=${ADMIN_TOKEN}" \
  -e "RELAY_BASE_PATH=${BASE_PATH}" \
  -e "RELAY_PROXY_TOKEN=${PROXY_TOKEN}" \
  -e "RELAY_ALLOW_PRIVATE=${ALLOW_PRIVATE}" \
  -e "RELAY_MAX_LOGS=${MAX_LOGS}" \
  -e TZ=Asia/Shanghai \
  --health-cmd "node -e \"require('http').get('http://127.0.0.1:8787/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))\"" \
  --health-interval 30s \
  --health-timeout 5s \
  --health-retries 3 \
  --health-start-period 5s \
  "$IMAGE"

echo
echo "==> 完成。等待健康检查..."
sleep 3
docker ps --filter "name=$NAME" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' || true

echo
echo "管理界面:  http://<服务器IP>:${PORT}/admin"
echo "健康检查:  http://<服务器IP>:${PORT}/health"
echo "扩展地址:  http://<服务器IP>:${PORT}/"
echo
echo "全部部署内容都在 ./ 下:"
echo "  镜像  $TAR"
echo "  配置  ./.env"
echo "  数据  ./data/"
echo "日志:      docker logs -f $NAME"
echo "停止/删除: docker rm -f $NAME"
