"use strict";

/**
 * HTTP forward proxy for the extension's proxy-node pool.
 *
 * The extension writes a PAC rule `PROXY host:port`, so the browser sends:
 *   - plain HTTP  -> absolute-form request line (GET http://host/path HTTP/1.1)
 *   - HTTPS       -> CONNECT host:443, then a raw TLS tunnel
 * Both are handled here. Every connection is logged for the Web UI.
 */

const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const config = require("./config");
const logger = require("./logger");
const { sendJson } = require("./share");

const isPrivateAddress = (host) => {
  const value = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (value === "localhost" || value.endsWith(".localhost")) return true;
  if (value.endsWith(".local") || value.endsWith(".lan")) return true;
  if (/^127\./.test(value) || /^10\./.test(value)) return true;
  if (/^192\.168\./.test(value)) return true;
  if (/^169\.254\./.test(value)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(value)) return true;
  if (value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:"))
    return true;
  return false;
};

const proxyNeedsToken = () => {
  const stored = require("./store").settings.proxyRequiresToken;
  return typeof stored === "boolean" ? stored : config.proxyRequiresToken;
};

const tokenAllowed = (req) => {
  if (!proxyNeedsToken()) return true;
  const expected = require("./store").settings.adminToken;
  if (!expected) return true; // no token configured means proxy is open by design
  const header = req.headers["x-relay-token"];
  const proxyAuth = req.headers["proxy-authorization"] || "";
  const basic = proxyAuth.match(/^Basic\s+(.+)$/i);
  if (basic) {
    const decoded = Buffer.from(basic[1], "base64").toString("utf8");
    return decoded === `:${expected}` || decoded === `${expected}:` || decoded.includes(expected);
  }
  return header === expected;
};

const deny = (res, status, message) => {
  if (res.writableEnded) return;
  if (res instanceof net.Socket) {
    res.end(`HTTP/1.1 ${status} ${message}\r\nContent-Length: 0\r\n\r\n`);
  } else {
    sendJson(res, status, { error: message });
  }
};

/** Handle an absolute-form HTTP proxy request. */
const handleRequest = (req, res) => {
  let target;
  try {
    target = new URL(req.url);
  } catch (error) {
    return deny(res, 400, "Bad Request");
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return deny(res, 400, "Unsupported scheme");
  }
  if (!config.allowPrivateTargets && isPrivateAddress(target.hostname)) {
    logger.warn("proxy", "已拒绝访问私网地址", { host: target.hostname });
    return deny(res, 403, "Private targets disabled");
  }
  if (!tokenAllowed(req)) {
    logger.warn("proxy", "代理令牌校验失败", { host: target.hostname });
    return deny(res, 407, "Proxy Authentication Required");
  }

  const clientIp =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket.remoteAddress;
  const transport = target.protocol === "https:" ? https : http;
  const started = Date.now();

  const upstream = transport.request(
    {
      hostname: target.hostname,
      port: target.port || (target.protocol === "https:" ? 443 : 80),
      method: req.method,
      path: `${target.pathname}${target.search}`,
      headers: { ...req.headers, host: target.host },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
      upstreamRes.on("end", () => {
        logger.info("proxy", `${req.method} ${target.host}${target.pathname}`, {
          status: upstreamRes.statusCode,
          ms: Date.now() - started,
          from: clientIp,
        });
      });
    },
  );

  upstream.setTimeout(config.connectTimeout, () => upstream.destroy());
  upstream.on("error", (error) => {
    logger.error("proxy", `转发失败 ${target.host}`, { error: error.message });
    deny(res, 502, "Bad Gateway");
  });
  req.pipe(upstream);
};

/** Handle a CONNECT tunnel for HTTPS. */
const handleConnect = (req, clientSocket, head) => {
  const target = req.url || "";
  const match = target.match(/^([^:]+):(\d+)$/);
  const host = match ? match[1] : target.split(":")[0];
  const port = match ? Number(match[2]) : 443;

  if (!config.allowPrivateTargets && isPrivateAddress(host)) {
    logger.warn("proxy", "已拒绝 CONNECT 到私网地址", { host });
    return deny(clientSocket, 403, "Forbidden");
  }
  if (!tokenAllowed(req)) {
    logger.warn("proxy", "CONNECT 令牌校验失败", { host });
    return deny(clientSocket, 407, "Proxy Authentication Required");
  }

  const clientIp = clientSocket.remoteAddress;
  const started = Date.now();
  const serverSocket = net.connect(port, host, () => {
    clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    if (head && head.length) serverSocket.write(head);
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });

  serverSocket.setTimeout(config.connectTimeout, () => serverSocket.destroy());
  const done = () => {
    logger.info("proxy", `CONNECT ${host}:${port}`, {
      ms: Date.now() - started,
      from: clientIp,
    });
  };
  serverSocket.on("close", done);
  serverSocket.on("error", (error) => {
    logger.error("proxy", `CONNECT 失败 ${host}:${port}`, { error: error.message });
    if (!clientSocket.destroyed) deny(clientSocket, 502, "Bad Gateway");
  });
  clientSocket.on("error", () => serverSocket.destroy());
};

module.exports = { handleRequest, handleConnect };
