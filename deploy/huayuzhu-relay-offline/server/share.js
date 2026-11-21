"use strict";

/**
 * Account-free link sharing API, protocol-compatible with the extension.
 *
 * Every mutating action is written to the audit log so the Web UI can show a
 * "who published / revoked / fetched what, when" timeline.
 */

const store = require("./store");
const logger = require("./logger");
const config = require("./config");
const {
  HttpError,
  publicFingerprint,
  verifySignature,
} = require("./signature");

const sendJson = (res, status, data) => {
  const body = JSON.stringify(data ?? null);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "access-control-allow-origin": "*",
    "access-control-allow-headers":
      "content-type, x-identity, x-timestamp, x-nonce, x-signature",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  });
  res.end(body);
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

const identityName = (fingerprint) => {
  const found = store.state.identities[fingerprint];
  return found ? found.name : fingerprint.slice(0, 12);
};

const requireStoredIdentity = (headers) => {
  const identity = headers["x-identity"];
  const stored = store.state.identities[identity];
  if (!stored) throw new HttpError(403, "密钥尚未注册");
  return stored;
};

const validatePayload = (payload) => {
  if (!payload || typeof payload !== "object") throw new HttpError(400, "缺少分享内容");
  let url;
  try {
    url = new URL(payload.url);
  } catch (error) {
    throw new HttpError(400, "分享网址格式不正确");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new HttpError(400, "分享网址只支持 http / https");
  if (typeof payload.updatedAt !== "number")
    throw new HttpError(400, "缺少更新时间");
  return payload;
};

const route = (pathname) =>
  config.basePath && pathname.startsWith(config.basePath)
    ? pathname.slice(config.basePath.length) || "/"
    : pathname;

const handle = async (req, res, url) => {
  const method = req.method || "GET";
  const requestPath = `${url.pathname}${url.search}`;
  const pathname = route(url.pathname);

  if (method === "OPTIONS") {
    sendJson(res, 204, null);
    return true;
  }

  if (method === "GET" && pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "relay-node",
      identities: Object.keys(store.state.identities).length,
      shares: Object.keys(store.state.shares).length,
      uptime: Date.now() - config.startedAt,
    });
    return true;
  }

  const body = method === "GET" ? "" : await readBody(req);
  let parsed = {};
  if (body) {
    try {
      parsed = JSON.parse(body);
    } catch (error) {
      throw new HttpError(400, "请求内容不是合法 JSON");
    }
  }

  // Self-signed registration: the key in the body is the one being registered.
  if (method === "POST" && pathname === "/identities") {
    const fingerprint = publicFingerprint(parsed.publicKey);
    const signedBy = verifySignature({
      method, requestPath, body, publicKey: parsed.publicKey, headers: req.headers,
    });
    if (signedBy !== fingerprint) throw new HttpError(401, "注册身份与公钥不匹配");
    if (typeof parsed.name !== "string" || !parsed.name.trim())
      throw new HttpError(400, "请提供密钥名称");

    const identity = {
      id: fingerprint.slice(0, 12),
      name: parsed.name.trim().slice(0, 40),
      fingerprint,
      publicKey: parsed.publicKey,
      registeredAt: new Date().toISOString(),
    };
    store.state.identities[fingerprint] = identity;
    await store.saveShares();
    logger.info("share", `注册密钥「${identity.name}」`, { fingerprint: fingerprint.slice(0, 12) });
    sendJson(res, 200, identity);
    return true;
  }

  if (method === "GET" && pathname === "/identities") {
    sendJson(res, 200, Object.values(store.state.identities));
    return true;
  }

  if (method === "POST" && pathname === "/shares") {
    const stored = requireStoredIdentity(req.headers);
    const signedBy = verifySignature({
      method, requestPath, body, publicKey: stored.publicKey, headers: req.headers,
    });
    if (signedBy !== stored.fingerprint) throw new HttpError(401, "签名身份不匹配");
    if (parsed.owner !== signedBy) throw new HttpError(403, "不能用自己的密钥发布他人分享");

    const id = typeof parsed.id === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(parsed.id)
      ? parsed.id
      : null;
    if (!id) throw new HttpError(400, "分享 id 格式不正确");
    if (!Array.isArray(parsed.recipients) || parsed.recipients.length === 0 || parsed.recipients.length > 50)
      throw new HttpError(400, "接收用户数量应在 1 到 50 之间");
    const recipients = [...new Set(parsed.recipients)];
    for (const recipient of recipients) {
      if (typeof recipient !== "string" || !store.state.identities[recipient])
        throw new HttpError(400, "接收用户尚未注册");
    }

    const payload = validatePayload(parsed.payload);
    const isUpdate = Boolean(store.state.shares[id]);
    const record = {
      id,
      owner: signedBy,
      recipients,
      payload,
      updatedAt: payload.updatedAt,
      publishedAt: store.state.shares[id]?.publishedAt || new Date().toISOString(),
    };
    store.state.shares[id] = record;
    await store.saveShares();
    logger.info("share", `${isUpdate ? "更新" : "发布"}分享 ${id}`, {
      owner: identityName(signedBy),
      recipients: recipients.map(identityName),
      url: payload.url,
    });
    sendJson(res, 200, record);
    return true;
  }

  const shareMatch = pathname.match(/^\/shares\/([^/]+)$/);
  const listMatch = pathname === "/shares";

  if (method === "GET" && (listMatch || shareMatch)) {
    const stored = requireStoredIdentity(req.headers);
    const signedBy = verifySignature({
      method, requestPath, body, publicKey: stored.publicKey, headers: req.headers,
    });
    const recipient = url.searchParams.get("recipient");
    if (recipient !== signedBy) throw new HttpError(403, "只能读取发给自己的分享");

    if (shareMatch) {
      const id = decodeURIComponent(shareMatch[1]);
      const record = store.state.shares[id];
      if (!record || !record.recipients.includes(recipient))
        throw new HttpError(404, "分享不存在或无权访问");
      logger.info("share", `读取分享 ${id}`, { by: identityName(recipient) });
      sendJson(res, 200, record);
      return true;
    }

    const records = Object.values(store.state.shares).filter((record) =>
      record.recipients.includes(recipient),
    );
    logger.info("share", `列出收到的分享 (${records.length})`, { by: identityName(recipient) });
    sendJson(res, 200, records);
    return true;
  }

  if (method === "DELETE" && shareMatch) {
    const stored = requireStoredIdentity(req.headers);
    const signedBy = verifySignature({
      method, requestPath, body, publicKey: stored.publicKey, headers: req.headers,
    });
    const id = decodeURIComponent(shareMatch[1]);
    const record = store.state.shares[id];
    if (!record) throw new HttpError(404, "分享不存在");
    if (record.owner !== signedBy) throw new HttpError(403, "只能删除自己发布的分享");
    delete store.state.shares[id];
    await store.saveShares();
    logger.info("share", `删除分享 ${id}`, { by: identityName(signedBy) });
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
};

module.exports = { handle, sendJson, HttpError };
