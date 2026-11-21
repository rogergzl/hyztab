# 花与竹标签

花与竹标签是一款可自定义的 Chrome / Edge 新标签页扩展（GPL-3.0，基于 Tabliss 二改），
主页：<https://aphqsia.com/>。

它把新标签页变成一个可自由摆放的工作台：行列可调的快速链接网格、时间 / 问候 / 搜索等
15 个组件、按域名路由的代理节点池、无需账号的标签分享、书签备份与离线教程。

> 标签分享是可选项，需要一个自托管中转服务；不部署也不影响扩展的其它功能。
> 该服务已打包成 Docker 镜像，见下方「可选：标签分享中转」。

## 项目内容

| 模块 | 现有内容 |
| --- | --- |
| 快速链接网格 | 行列 1~16 × 1~6（默认 6×4）；每格独立槽位；右键新增 / 编辑、左键访问、`1`~`9` 直达；滚轮 / 拖动 / 页码翻页；长按 0.4 秒拖动重排 |
| 名称与图标 | 短名称、完整名称；站点 favicon 或本地上传；可选读取站点 `<title>` |
| 代理访问 | 可配置多个默认代理节点；每个链接选择节点或自定义地址（http / socks5 / socks4）；按域名经 PAC 路由；其余网站可设兜底代理，留空则直连 |
| 书签文件夹 | 书签栏「标签页备份书签，请勿删除」，默认开启；镜像链接名称与网址；删除项手动同步 |
| 标签分享 | 配置自有 HTTP 中转与具名密钥后，可将链接发布给指定用户；对方校验指纹后一键添加，更新后手动刷新；无账号、私钥不上传；配套零依赖中转服务与公开转发节点镜像（自带 Web 管理界面与日志） |
| 背景 | Bing 每日壁纸、随机动图、纯色、渐变、自定义上传 |
| 页面组件 | 15 个组件插件（时钟、问候语、搜索、待办、笔记、天气、GitHub、NBA、文学钟、留言、笑话、工时、IP 信息等），可摆放与缩放；全新安装自上而下为时钟、问候语、搜索框、快速链接，搜索默认 Bing |
| 数据保存 | 配置 → `chrome.storage.sync`（自动分片）；自定义图标 → IndexedDB；快速链接 → 书签文件夹；整套设置 → 导入 / 导出；侧边栏「持久化配置」可另存/恢复本机快照（含分享私钥） |
| 使用教程 | 设置侧边栏底部的「打开教程」；离线单页，涵盖链接、代理、分享、书签与备份 |

书签文件夹仅含链接名称与网址。

## 仓库结构

| 路径 | 说明 |
| --- | --- |
| `src/` | 扩展源码（组件插件在 `src/plugins/`，数据中间层在 `src/db/` 与 `src/lib/`） |
| `target/` | 各平台 HTML / manifest 模板与图标；构建时自动复制 |
| `server/link-share-server.js` | 零依赖标签分享中转服务（`npm run share-server`） |
| `keys/chromium-pub.b64` | 固定扩展 ID 用的公钥（私钥不入库） |

> 本仓库只跟踪扩展源码与零依赖中转服务。转发节点服务端（源码 / 部署脚本 / 离线镜像包）
> 仅作者自用、不随源码公开；Windows 一键编译等本地便利脚本同样不上传。
> 需要服务端的可直接用下方 Docker Hub 公开镜像自行部署。

## 优点

- 扩展 ID 固定：`ahikgnldomceknpfnkdcfhcghfiodbdp`
- `storage.sync` 超限自动分片；自定义图标不占同步配额；扩展端提供真正可用的「持久化配置」本机快照，网页版保留浏览器持久化请求
- 默认图源国内可用（Bing / 自定义动图地址）
- 固定外框，行列变化时格子等比缩放；弹窗横向自动换行；默认布局随视口高度缩放，1280×720 / 1366×768 / 1920×1080 下不重叠
- 权限 `storage` / `favicon` / `bookmarks` / `proxy`；`<all_urls>` 按需申请、可撤回
- 代理为浏览器级 PAC 按域名路由；无规则时不接管网络，可设兜底代理避免覆盖系统代理；节点池支持一次配置、多处复用
- 书签同步默认开启，只删自有书签，删除需手动确认
- 标签分享无需账号：ECDSA 签名 + 指纹校验，私钥不进设置导出文件；可选配套自托管中转镜像（带 Web 管理界面与日志）

## 快速开始

需要 Node.js 18+。首次使用先 `npm install`。

**1. 本地构建并安装扩展**

```bash
npm install
npm run build:chromium        # 输出 dist/chromium/
```

在 Edge / Chrome 扩展页开启「开发人员模式」→「加载已解压的扩展程序」→ 指向 `dist/chromium/`。

> Edge / Chrome 不能直接拖入 zip 安装。zip 仅用于备份或分发，开发安装请始终指向 `dist/chromium/` 文件夹。
> Windows 下如需一键编译 zip，可自行在项目根目录放一个调用上面命令的 `.bat`；此类便利脚本不随仓库分发。

**2. 测试**

```bash
npm test                       # tsc + jest
```

## 可选：标签分享中转

扩展的「标签分享」需要一个中转服务（扩展本身不建服务器）。**不需要分享功能就跳过本节**，
其它功能不受影响。

### 部署前准备

| 需要 | 说明 |
| --- | --- |
| 一台能跑 Docker 的 Linux | 云主机 / 内网服务器 / NAS 均可；1Panel、宝塔等面板可直接导入 compose |
| 一个强随机令牌 | 登录管理界面用，也是分享签名的校验依据（`openssl rand -hex 24` 可生成） |
| 一个可用端口 | 默认 `8787`，需要放行；公网建议前面挂 Nginx 终止 TLS |
| 一个持久化目录 | 挂到容器 `/app/data`；分享、密钥、日志、设置都在里面，备份就是打包它 |
| 扩展端先创建密钥 | 密钥由扩展生成（私钥不出浏览器），服务端只存公钥与指纹 |

### 部署（Docker）

镜像：`lindagao/huayuzhu-relay-node:1.0.2`（[Docker Hub](https://hub.docker.com/r/lindagao/huayuzhu-relay-node)）

```bash
docker run -d --name huayuzhu-relay-node --restart unless-stopped \
  -p 8787:8787 -v "$(pwd)/data:/app/data" \
  -e RELAY_ADMIN_TOKEN='换成你的强随机令牌' \
  lindagao/huayuzhu-relay-node:1.0.2
```

用 compose：

```yaml
services:
  relay-node:
    image: lindagao/huayuzhu-relay-node:1.0.2
    container_name: huayuzhu-relay-node
    restart: unless-stopped
    ports: ["8787:8787"]
    environment:
      RELAY_ADMIN_TOKEN: "换成你的强随机令牌"
    volumes:
      - ./data:/app/data
```

```bash
mkdir -p ./data && docker compose up -d
```

### 部署后

- 管理界面 `http://<服务器IP>:8787/admin`，用上面的令牌登录；
- 把 `http://<服务器IP>:8787/` 填进扩展「标签分享」的服务地址；同一地址也可作「代理节点」；
- 其余配置（代理是否需令牌、是否允许访问私网、日志条数、更换令牌）都在面板里改，
  立即生效并写入 `data/settings.json`，重启保留；端口与子路径属于启动参数，面板只读展示；
- 面板「密钥」页可对每个已注册身份做单密钥管理：改名、禁用/启用、删除（连带撤销其分享）。

**局域网临时用**：不装 Docker 也可以 `npm run share-server`（零依赖，数据存本地 `share-data/`）。

> 浏览器 PAC 无法携带令牌，扩展直连时 `RELAY_PROXY_TOKEN` 应保持 `false`；
> 只做外网中转建议把 `RELAY_ALLOW_PRIVATE` 设为 `false`，避免被当作内网探测跳板。

## 已知问题

暂无。原先「格子换位置无法落实到真实位置」已在 2026-11-17 重写为
「按编号取最近格子」的方式修复。

## 合规性声明

本项目由上游项目 **Tabliss**（[`joelshepherd/tabliss`](https://github.com/joelshepherd/tabliss)）二改，
原作与修改部分均以 **GPL-3.0** 授权。本仓库为**修改版**，最近修改 2026-11-22。

- [`LICENSE.txt`](LICENSE.txt) 为 GPL-3.0 全文，须原样保留、不得删改。
- 上游未附带版权声明；据实保留其项目名称与仓库地址，显示名更改不改变归属。
- 本作品及衍生物须继续以 GPL-3.0 发布，不得改挂其它许可证或附加额外限制；分发非源码形式时须提供完整对应源码。
- 第三方依赖许可证随 `npm install` 获得；分发构建产物时保留 `main.js.LICENSE.txt`。

本仓库仅提供源码，不上架商店、不提供官方发布包。
