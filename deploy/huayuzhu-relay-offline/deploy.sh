#!/usr/bin/env bash
# 花与竹标签 · 转发节点 —— 交互式一键部署
#
# 一个脚本支持四种部署方式，所有配置都可通过 shell 交互修改：
#   1) 离网 tar + docker run   包内 image/*.tar 导入后运行，无网可用
#   2) docker run             用已有镜像（或 docker pull），不导入 tar
#   3) docker compose up      用包内 docker-compose.yml，兼容 1Panel
#   4) 直接 Node 运行          不用 Docker，需 Node 18+（源码随包附带）
#
# 所有部署内容都限制在本脚本所在的 ./ 目录下：
#   ./image/    镜像 tar      ./.env   配置      ./data/   持久化数据
#   ./server/ ./web/         直接 Node 运行所需源码
#
# 用法：
#   chmod +x deploy.sh && ./deploy.sh
#   自动化：./deploy.sh --mode=1 --non-interactive   （读现有 .env，不提问）
set -e

# 定位到脚本所在目录，保证下面所有 ./ 路径都落在服务端目录内
cd "$(dirname "${BASH_SOURCE[0]}")"
ROOT="$(pwd)"

IMAGE="huayuzhu-relay-node:1.0.0"
TAR="./image/huayuzhu-relay-node-image.tar"
NAME="huayuzhu-relay-node"

# ---------------------------------------------------------------- 参数解析
MODE_ARG=""
NONINTERACTIVE=0
for arg in "$@"; do
  case "$arg" in
    --mode=*) MODE_ARG="${arg#--mode=}" ;;
    --non-interactive|-y|--yes) NONINTERACTIVE=1 ;;
    -h|--help)
      echo "用法: ./deploy.sh [--mode=1|2|3|4] [--non-interactive]"
      echo "  1 离网tar+docker run  2 docker run  3 compose  4 直接Node"
      exit 0 ;;
    *) echo "未知参数: $arg" >&2; exit 1 ;;
  esac
done

can_prompt() {
  [ "$NONINTERACTIVE" = 0 ] && [ -t 0 ]
}

# 交互提问：有输入就用输入，回车或非交互用默认值
prompt() {
  local label="$1" def="$2" answer=""
  if can_prompt; then
    printf '%s [%s]: ' "$label" "$def"
    IFS= read -r answer || answer=""
  fi
  if [ -z "$answer" ]; then answer="$def"; fi
  printf '%s' "$answer"
}

prompt_bool() {
  local value
  value=$(prompt "$1 (y/n)" "$2")
  case "$value" in
    1|true|TRUE|yes|YES|y|Y|on|ON) printf 'true' ;;
    *) printf 'false' ;;
  esac
}

# 不 source .env，避免执行文件里的任意内容
conf() {
  local line
  line=$(grep -E "^$1=" ./.env 2>/dev/null | tail -n1 || true)
  printf '%s' "${line#*=}" | tr -d '\r'
}

gen_token() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 24
  elif command -v node >/dev/null 2>&1; then
    node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
  else
    printf '%s%s' "$(date +%s)" "$$" | sha256sum | cut -c1-48
  fi
}

echo "==> 部署目录: $ROOT"

# ---------------------------------------------------------------- 配置交互
echo
echo "==> 配置（回车沿用方括号内的值）"
if [ ! -f ./.env ]; then
  cp ./.env.example ./.env
  echo "已根据 .env.example 生成 ./.env"
fi

TOKEN=$(conf RELAY_ADMIN_TOKEN)
if [ -z "$TOKEN" ] || [ "$TOKEN" = "change-me-to-a-long-random-string" ]; then
  TOKEN=$(gen_token)
  echo "管理令牌还是默认值，已生成随机令牌；可直接回车使用。"
fi
ADMIN_TOKEN=$(prompt "管理界面令牌" "$TOKEN")
PORT=$(prompt "宿主机端口" "$(conf RELAY_PORT)"); PORT=${PORT:-8787}
BASE_PATH=$(prompt "反向代理子路径（直连留空，如 /relay）" "$(conf RELAY_BASE_PATH)")
PROXY_TOKEN=$(prompt_bool "代理访问是否也需要令牌（公网建议 y）" "$(conf RELAY_PROXY_TOKEN)")
ALLOW_PRIVATE=$(prompt_bool "是否允许代理访问私网地址（只做中转建议 n）" "$(conf RELAY_ALLOW_PRIVATE)")
MAX_LOGS=$(prompt "日志最多保留条数" "$(conf RELAY_MAX_LOGS)"); MAX_LOGS=${MAX_LOGS:-5000}

case "$PORT" in
  ''|*[!0-9]*) echo "错误：端口必须是数字。" >&2; exit 1 ;;
esac
if [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
  echo "错误：端口须在 1-65535。" >&2; exit 1
fi
case "$MAX_LOGS" in
  ''|*[!0-9]*) echo "错误：日志条数必须是数字。" >&2; exit 1 ;;
esac

# 逐行写，避免值里的特殊字符被 shell 展开
printf '%s\n' \
  "# 由 deploy.sh 交互生成，可手动修改后重新运行脚本" \
  "RELAY_ADMIN_TOKEN=${ADMIN_TOKEN}" \
  "RELAY_PORT=${PORT}" \
  "RELAY_BASE_PATH=${BASE_PATH}" \
  "RELAY_PROXY_TOKEN=${PROXY_TOKEN}" \
  "RELAY_ALLOW_PRIVATE=${ALLOW_PRIVATE}" \
  "RELAY_MAX_LOGS=${MAX_LOGS}" \
  > ./.env

mkdir -p ./data

# ---------------------------------------------------------------- 环境探测
# 查询同级目录资源 + 本机运行时，自动推荐最合适的部署方式
probe_env() {
  local docker_cmd="无" docker_daemon="未运行" tar_state="无" image_state="无"
  local compose_state="无" node_state="无" src_state="无" node_ok=0 nv major

  command -v docker >/dev/null 2>&1 && docker_cmd="有"
  if [ "$docker_cmd" = "有" ] && docker info >/dev/null 2>&1; then
    docker_daemon="运行中"
  fi
  [ -f "$TAR" ] && tar_state="有"
  if [ "$docker_daemon" = "运行中" ] && docker image inspect "$IMAGE" >/dev/null 2>&1; then
    image_state="有"
  fi
  if [ "$docker_daemon" = "运行中" ]; then
    if docker compose version >/dev/null 2>&1; then
      compose_state="有"
    elif command -v docker-compose >/dev/null 2>&1; then
      compose_state="有（独立命令）"
    fi
  elif command -v docker-compose >/dev/null 2>&1; then
    compose_state="有（守护进程未运行）"
  fi
  if command -v node >/dev/null 2>&1; then
    nv=$(node -v 2>/dev/null | tr -d 'v')
    major=${nv%%.*}
    case "$major" in
      ''|*[!0-9]*) node_state="版本未知 (v$nv)" ;;
      *) if [ "$major" -ge 18 ]; then
           node_ok=1; node_state="有 (v$nv)"
         else
           node_state="版本过低 (v$nv，需 18+)"
         fi ;;
    esac
  fi
  [ -f ./server/index.js ] && [ -d ./web ] && src_state="有"

  echo
  echo "==> 环境探测（本目录资源 + 本机运行时）"
  printf '  %-18s %s\n' "Docker 命令" "$docker_cmd"
  printf '  %-18s %s\n' "Docker 守护进程" "$docker_daemon"
  printf '  %-18s %s\n' "离网镜像 tar" "$tar_state"
  printf '  %-18s %s\n' "本地镜像" "$image_state"
  printf '  %-18s %s\n' "Compose" "$compose_state"
  printf '  %-18s %s\n' "Node.js" "$node_state"
  printf '  %-18s %s\n' "随包源码 server/web" "$src_state"

  OK1="不可用"; OK2="不可用"; OK3="不可用"; OK4="不可用"
  [ "$docker_daemon" = "运行中" ] && OK2="可用"
  if [ "$OK2" = "可用" ] && [ "$tar_state" = "有" ]; then OK1="可用"; fi
  if [ "$OK2" = "可用" ] && [ "$compose_state" != "无" ] &&
     { [ "$image_state" = "有" ] || [ "$tar_state" = "有" ]; }; then OK3="可用"; fi
  if [ "$node_ok" = 1 ] && [ "$src_state" = "有" ]; then OK4="可用"; fi

  if [ "$OK1" = "可用" ]; then
    RECOMMEND=1; REASON="检测到离网镜像 tar 且 Docker 可用"
  elif [ "$OK2" = "可用" ] && [ "$image_state" = "有" ]; then
    RECOMMEND=2; REASON="本地已有镜像，无需导入 tar"
  elif [ "$OK3" = "可用" ]; then
    RECOMMEND=3; REASON="检测到 Compose，可用编排方式"
  elif [ "$OK4" = "可用" ]; then
    RECOMMEND=4; REASON="Docker 不可用，但 Node 与随包源码齐备"
  elif [ "$OK2" = "可用" ]; then
    RECOMMEND=2; REASON="Docker 可用，可按需拉取镜像"
  else
    RECOMMEND=1; REASON="未检测到可用运行时，建议安装 Docker 后用离网镜像"
  fi
  echo
  echo "==> 自动推荐: 方式 $RECOMMEND —— $REASON"
}

probe_env

# ---------------------------------------------------------------- 部署方式
echo
echo "==> 选择部署方式（回车采用推荐值）"
echo "  1) 离网 tar + docker run   [$OK1] —— 包内镜像导入后运行，无网可用"
echo "  2) docker run              [$OK2] —— 用已有镜像或 docker pull，不导入 tar"
echo "  3) docker compose up       [$OK3] —— 用包内 compose，兼容 1Panel"
echo "  4) 直接 Node 运行          [$OK4] —— 不用 Docker，需 Node 18+"
MODE=$(prompt "请选择 1-4" "${MODE_ARG:-$RECOMMEND}")
case "$MODE" in
  1|2|3|4) ;;
  *) echo "错误：无效的选择 $MODE" >&2; exit 1 ;;
esac

need_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "错误：未找到 docker，请先安装 Docker。" >&2; exit 1
  fi
  docker info >/dev/null 2>&1 || { echo "错误：Docker 守护进程未运行。" >&2; exit 1; }
}

remove_old_container() {
  if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx "$NAME"; then
    echo "移除同名容器 $NAME（数据保存在 ./data，不受影响）"
    docker rm -f "$NAME" >/dev/null
  fi
}

run_container() {
  local image="$1"
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
    "$image"
}

case "$MODE" in
  1)
    need_docker
    if [ ! -f "$TAR" ]; then
      echo "错误：找不到镜像文件 $TAR" >&2; exit 1
    fi
    echo "==> 导入镜像（离网可用；已导入则跳过）"
    if docker image inspect "$IMAGE" >/dev/null 2>&1; then
      echo "镜像 $IMAGE 已存在，跳过导入。"
    else
      docker load -i "$TAR"
    fi
    remove_old_container
    echo "==> 启动容器（数据卷: $ROOT/data -> /app/data）"
    run_container "$IMAGE"
    ;;

  2)
    need_docker
    IMAGE=$(prompt "镜像名（本地已有或从仓库拉取）" "${RELAY_IMAGE:-$IMAGE}")
    if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
      if [ "$(prompt_bool "本地没有该镜像，尝试 docker pull（需联网）" "y")" = true ]; then
        docker pull "$IMAGE"
      else
        echo "错误：本地无镜像且未拉取。可改用方式 1 导入离网 tar。" >&2; exit 1
      fi
    fi
    remove_old_container
    echo "==> 启动容器（数据卷: $ROOT/data -> /app/data）"
    run_container "$IMAGE"
    ;;

  3)
    need_docker
    if docker image inspect "$IMAGE" >/dev/null 2>&1; then
      echo "镜像 $IMAGE 已存在。"
    elif [ -f "$TAR" ]; then
      echo "==> 镜像不存在，先从包内 tar 导入"
      docker load -i "$TAR"
    else
      echo "错误：compose 需要镜像 $IMAGE，且找不到 $TAR" >&2; exit 1
    fi
    remove_old_container
    echo "==> docker compose up -d"
    if docker compose version >/dev/null 2>&1; then
      docker compose up -d
    elif command -v docker-compose >/dev/null 2>&1; then
      docker-compose up -d
    else
      echo "错误：未安装 compose 插件，请改用方式 1/2。" >&2; exit 1
    fi
    ;;
esac

# ---------------------------------------------------------------- 直接 Node
if [ "$MODE" = 4 ]; then
  if ! command -v node >/dev/null 2>&1; then
    echo "错误：未找到 node，请先安装 Node.js 18+。" >&2; exit 1
  fi
  if [ ! -f ./server/index.js ] || [ ! -d ./web ]; then
    echo "错误：包内缺少 server/ 或 web/ 源码，无法直接运行。" >&2; exit 1
  fi
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    remove_old_container
  fi
  export RELAY_HOST=0.0.0.0 \
         RELAY_PORT=8787 \
         RELAY_DATA_DIR="$ROOT/data" \
         RELAY_ADMIN_TOKEN="$ADMIN_TOKEN" \
         RELAY_BASE_PATH="$BASE_PATH" \
         RELAY_PROXY_TOKEN="$PROXY_TOKEN" \
         RELAY_ALLOW_PRIVATE="$ALLOW_PRIVATE" \
         RELAY_MAX_LOGS="$MAX_LOGS" \
         TZ=Asia/Shanghai
  BG=$(prompt_bool "后台运行（写 server.log / server.pid），否则前台" "${RELAY_NODE_BG:-false}")
  if [ "$BG" = true ]; then
    nohup node ./server/index.js > "$ROOT/server.log" 2>&1 &
    printf '%s\n' "$!" > "$ROOT/server.pid"
    echo "已后台启动，PID 写入 ./server.pid，日志 ./server.log"
  else
    echo "前台运行，Ctrl+C 停止。"
    exec node ./server/index.js
  fi
fi

# ---------------------------------------------------------------- 完成提示
if [ "$MODE" != 4 ] || [ "$BG" = true ]; then
  echo
  echo "==> 完成。等待健康检查..."
  sleep 3
  if command -v docker >/dev/null 2>&1 && [ "$MODE" != 4 ]; then
    docker ps --filter "name=$NAME" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' || true
  fi
fi

echo
echo "管理界面:  http://<服务器IP>:${PORT}/admin"
echo "健康检查:  http://<服务器IP>:${PORT}/health"
echo "扩展地址:  http://<服务器IP>:${PORT}/"
echo
echo "全部部署内容都在 ./ 下:"
echo "  配置  ./.env"
echo "  数据  ./data/"
if [ "$MODE" = 4 ]; then
  echo "日志:      ./server.log"
  echo "停止:      kill \$(cat ./server.pid)"
else
  echo "日志:      docker logs -f $NAME"
  echo "停止:      docker rm -f $NAME"
fi
