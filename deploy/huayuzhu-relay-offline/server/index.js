"use strict";

/**
 * 花与竹标签 · 转发节点
 *
 * One HTTP server that multiplexes:
 *   - /admin/* and /admin/api/*  -> Web management UI + JSON API
 *   - /health, /identities, /shares -> link-sharing relay API
 *   - absolute-form URLs and CONNECT -> HTTP forward proxy
 *
 * The extension uses this single address both as a proxy node (PAC `PROXY`)
 * and as the sharing relay URL.
 */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const config = require("./config");
const logger = require("./logger");
const share = require("./share");
const admin = require("./admin");
const proxy = require("./proxy");
const { HttpError } = require("./signature");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const sendStatic = (res, filename) => {
  const safe = path.normalize(filename).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(config.webDir, safe);
  if (!full.startsWith(config.webDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(full, (error, data) => {
    if (error) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }
    res.writeHead(200, {
      "content-type": MIME[path.extname(full)] || "application/octet-stream",
      "content-length": data.length,
      "cache-control": "no-cache",
    });
    res.end(data);
  });
};

const routeBase = (pathname) =>
  config.basePath && pathname.startsWith(config.basePath)
    ? pathname.slice(config.basePath.length) || "/"
    : pathname;

const server = http.createServer(async (req, res) => {
  // CONNECT never reaches the request handler (it has its own event), but
  // guard anyway in case a proxy sends it here.
  if (req.method === "CONNECT") return proxy.handleConnect(req, req.socket, Buffer.alloc(0));

  // Absolute-form URL => an HTTP proxy request, not a normal API call.
  if (/^https?:\/\//i.test(req.url || "")) {
    return proxy.handleRequest(req, res);
  }

  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = routeBase(url.pathname);

    // Web UI assets + admin API
    if (pathname === "/admin" || pathname === "/admin/") {
      return sendStatic(res, "index.html");
    }
    if (pathname.startsWith("/admin/api/")) {
      const handled = await admin.handle(req, res, url, pathname);
      if (handled) return;
      res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "接口不存在" }));
      return;
    }
    if (pathname === "/app.js" || pathname === "/styles.css") {
      return sendStatic(res, pathname.slice(1));
    }

    // Sharing relay API (also handles /health and OPTIONS)
    const handled = await share.handle(req, res, url);
    if (handled) return;

    share.sendJson(res, 404, { error: "接口不存在" });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = status === 500 ? "中转服务内部错误" : error.message;
    if (status === 500) logger.error("http", "未处理异常", { error: error.stack || error.message });
    if (!res.headersSent) share.sendJson(res, status, { error: message });
    else res.end();
  }
});

server.on("connect", proxy.handleConnect);

server.on("clientError", (error, socket) => {
  logger.warn("http", "客户端连接错误", { error: error.message });
  if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

server.listen(config.port, config.host, () => {
  logger.info("system", `转发节点已启动: http://${config.host}:${config.port}`);
  logger.info("system", `管理界面: http://<本机地址>:${config.port}/admin`);
  logger.info("system", `数据目录: ${config.dataDir}`);
  if (!config.adminToken) logger.warn("system", "未设置 RELAY_ADMIN_TOKEN，管理界面将无法登录");
});

const shutdown = () => {
  logger.info("system", "正在关闭转发节点...");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
