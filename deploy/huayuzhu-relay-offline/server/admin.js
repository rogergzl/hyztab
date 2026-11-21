"use strict";

/**
 * Web management API: token-gated overview, logs, identities and shares.
 * The static UI assets are served by index.js; this module only handles
 * /admin/api/* JSON endpoints.
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const config = require("./config");
const store = require("./store");
const logger = require("./logger");
const { sendJson, HttpError } = require("./share");

// In-memory sessions. A restart logs everyone out, which is acceptable for a
// self-hosted tool and avoids putting session secrets on disk.
const sessions = new Map();
const SESSION_TTL = 12 * 60 * 60 * 1000;

const hash = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

const issueSession = () => {
  const token = crypto.randomBytes(32).toString("base64url");
  sessions.set(token, Date.now() + SESSION_TTL);
  return token;
};

const requireAuth = (req, url) => {
  const header = req.headers["authorization"] || "";
  let token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) token = url.searchParams.get("token") || "";
  const expires = sessions.get(token);
  if (!expires || expires < Date.now()) {
    if (token) sessions.delete(token);
    throw new HttpError(401, "登录已失效，请重新登录");
  }
  return token;
};

const readBody = async (req) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > config.maxBody) throw new HttpError(413, "请求内容过大");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
};

const publicIdentity = (identity) => ({
  id: identity.id,
  name: identity.name,
  fingerprint: identity.fingerprint,
  registeredAt: identity.registeredAt || null,
});

const publicShare = (record) => ({
  id: record.id,
  owner: record.owner,
  ownerName: store.state.identities[record.owner]?.name || record.owner.slice(0, 12),
  recipientNames: (record.recipients || []).map(
    (r) => store.state.identities[r]?.name || r.slice(0, 12),
  ),
  url: record.payload?.url,
  updatedAt: record.updatedAt,
  publishedAt: record.publishedAt || null,
});

const handle = async (req, res, url, pathname) => {
  const method = req.method || "GET";

  // --- login (no auth required) -----------------------------------------
  if (pathname === "/admin/api/login" && method === "POST") {
    const body = await readBody(req);
    let parsed = {};
    try {
      parsed = JSON.parse(body || "{}");
    } catch (error) {
      throw new HttpError(400, "请求内容不是合法 JSON");
    }
    const configured = store.settings.adminToken || "";
    if (!configured) throw new HttpError(500, "尚未设置管理令牌，请设置 RELAY_ADMIN_TOKEN 环境变量");
    const provided = String(parsed.token ?? "");
    if (hash(provided) !== hash(configured)) {
      logger.warn("admin", "管理登录失败", { from: req.socket.remoteAddress });
      throw new HttpError(401, "管理令牌不正确");
    }
    const token = issueSession();
    logger.info("admin", "管理登录成功", { from: req.socket.remoteAddress });
    sendJson(res, 200, { token, expiresIn: SESSION_TTL });
    return true;
  }

  // --- everything below requires a session ------------------------------
  requireAuth(req, url);

  if (pathname === "/admin/api/overview" && method === "GET") {
    const recent = store.getLogs();
    sendJson(res, 200, {
      ok: true,
      uptime: Date.now() - config.startedAt,
      identities: Object.keys(store.state.identities).length,
      shares: Object.keys(store.state.shares).length,
      totalLogs: recent.length,
      proxyMode: config.proxyRequiresToken ? "token" : "open",
      version: "1.0.0",
    });
    return true;
  }

  if (pathname === "/admin/api/logs" && method === "GET") {
    const category = url.searchParams.get("category") || "";
    const level = url.searchParams.get("level") || "";
    const limit = Math.min(Number(url.searchParams.get("limit")) || 200, config.maxLogEntries);
    let entries = store.getLogs();
    if (category) entries = entries.filter((entry) => entry.category === category);
    if (level) entries = entries.filter((entry) => entry.level === level);
    sendJson(res, 200, entries.slice(-limit).reverse());
    return true;
  }

  if (pathname === "/admin/api/logs" && method === "DELETE") {
    await store.clearLogs();
    logger.info("admin", "已清空日志");
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (pathname === "/admin/api/identities" && method === "GET") {
    sendJson(res, 200, Object.values(store.state.identities).map(publicIdentity));
    return true;
  }

  if (pathname === "/admin/api/shares" && method === "GET") {
    sendJson(res, 200, Object.values(store.state.shares).map(publicShare));
    return true;
  }

  // Admin can revoke any share (key owners can still do it via the signed API).
  const revokeMatch = pathname.match(/^\/admin\/api\/shares\/([^/]+)$/);
  if (revokeMatch && method === "DELETE") {
    const id = decodeURIComponent(revokeMatch[1]);
    if (!store.state.shares[id]) throw new HttpError(404, "分享不存在");
    delete store.state.shares[id];
    await store.saveShares();
    logger.warn("admin", `管理员撤销分享 ${id}`);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (pathname === "/admin/api/settings" && method === "GET") {
    sendJson(res, 200, {
      proxyRequiresToken:
        typeof store.settings.proxyRequiresToken === "boolean"
          ? store.settings.proxyRequiresToken
          : Boolean(config.proxyRequiresToken),
      allowPrivateTargets: config.allowPrivateTargets,
      basePath: config.basePath,
      maxLogEntries: config.maxLogEntries,
    });
    return true;
  }

  if (pathname === "/admin/api/settings" && method === "POST") {
    const body = await readBody(req);
    let parsed = {};
    try {
      parsed = JSON.parse(body || "{}");
    } catch (error) {
      throw new HttpError(400, "请求内容不是合法 JSON");
    }
    if (typeof parsed.proxyRequiresToken === "boolean") {
      store.settings.proxyRequiresToken = parsed.proxyRequiresToken;
      config.proxyRequiresToken = parsed.proxyRequiresToken;
    }
    if (typeof parsed.adminToken === "string" && parsed.adminToken.trim()) {
      store.settings.adminToken = parsed.adminToken.trim();
      logger.warn("admin", "管理令牌已更新");
    }
    await store.saveSettings();
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (pathname === "/admin/api/logout" && method === "POST") {
    const token = requireAuth(req, url);
    sessions.delete(token);
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
};

module.exports = { handle };
