#!/usr/bin/env node
/**
 * Zero-dependency relay for 花与竹标签's account-free link sharing.
 *
 * The relay never sees a private key. Each local key pair signs requests with
 * ECDSA P-256; this service stores only public JWKs, fingerprints, the shared
 * link payload and a nonce cache. Run it on your own machine or server behind
 * HTTPS (a reverse proxy can terminate TLS).
 */

const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.SHARE_PORT || 8787);
const HOST = process.env.SHARE_HOST || "127.0.0.1";
const DATA_DIR = path.resolve(process.env.SHARE_DATA_DIR || "./share-data");
const DATA_FILE = path.join(DATA_DIR, "shares.json");
const BASE_PATH = (process.env.SHARE_BASE_PATH || "").replace(/\/$/, "");
const MAX_BODY = 256 * 1024;
const CLOCK_SKEW = 5 * 60 * 1000;
const NONCE_TTL = 10 * 60 * 1000;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const loadStore = () => {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return {
      identities: parsed.identities && typeof parsed.identities === "object" ? parsed.identities : {},
      shares: parsed.shares && typeof parsed.shares === "object" ? parsed.shares : {},
    };
  } catch (error) {
    if (error && error.code === "ENOENT") return { identities: {}, shares: {} };
    throw new Error(`无法读取分享数据文件 ${DATA_FILE}: ${error.message}`);
  }
};

fs.mkdirSync(DATA_DIR, { recursive: true });
let store = loadStore();

const saveStore = () => {
  const temp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(temp, DATA_FILE);
};

const sendJson = (res, status, data) => {
  const body = JSON.stringify(data ?? null);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type, x-identity, x-timestamp, x-nonce, x-signature",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  });
  res.end(body);
};

const readBody = async (req) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, "请求内容过大");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
};

const sha256Hex = (value) =>
  crypto.createHash("sha256").update(value, "utf8").digest("hex");

const publicFingerprint = (jwk) => {
  if (!jwk || typeof jwk !== "object") throw new HttpError(400, "公钥格式不正确");
  const { crv, kty, x, y } = jwk;
  if ([crv, kty, x, y].some((field) => typeof field !== "string"))
    throw new HttpError(400, "公钥格式不正确");
  return sha256Hex(JSON.stringify({ crv, kty, x, y }));
};

const canonical = (method, requestPath, timestamp, nonce, body) =>
  [
    method.toUpperCase(),
    requestPath,
    timestamp,
    nonce,
    sha256Hex(body),
  ].join("\n");

const seenNonces = new Map();

const pruneNonces = () => {
  const cutoff = Date.now() - NONCE_TTL;
  for (const [nonce, issued] of seenNonces) {
    if (issued < cutoff) seenNonces.delete(nonce);
  }
};

const verifySignature = ({ method, requestPath, body, publicKey, headers }) => {
  const identity = headers["x-identity"];
  const timestamp = headers["x-timestamp"];
  const nonce = headers["x-nonce"];
  const signature = headers["x-signature"];
  if (!identity || !timestamp || !nonce || !signature)
    throw new HttpError(401, "缺少签名信息");

  const issued = Number(timestamp);
  if (!Number.isFinite(issued) || Math.abs(Date.now() - issued) > CLOCK_SKEW)
    throw new HttpError(401, "请求签名已过期");
  if (seenNonces.has(nonce)) throw new HttpError(401, "签名不可重复使用");

  // A reverse proxy may strip the configured base path. Accept both forms so
  // the signature can be checked against exactly what the client signed.
  const paths = [requestPath];
  if (BASE_PATH && !requestPath.startsWith(BASE_PATH))
    paths.unshift(`${BASE_PATH}${requestPath}`);

  const message = paths.map((candidate) =>
    canonical(method, candidate, timestamp, nonce, body),
  );
  const signatureBytes = Buffer.from(signature, "base64url");

  let key;
  try {
    key = crypto.createPublicKey({ key: publicKey, format: "jwk" });
  } catch (error) {
    throw new HttpError(400, "公钥无法解析: " + error.message);
  }

  const ok = message.some((value) =>
    crypto.verify(
      "sha256",
      Buffer.from(value, "utf8"),
      { key, dsaEncoding: "ieee-p1363" },
      signatureBytes,
    ),
  );
  if (!ok) throw new HttpError(401, "签名校验失败");

  seenNonces.set(nonce, Date.now());
  pruneNonces();
  return identity;
};

const requireStoredIdentity = ({ headers }) => {
  const identity = headers["x-identity"];
  const stored = store.identities[identity];
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
  BASE_PATH && pathname.startsWith(BASE_PATH)
    ? pathname.slice(BASE_PATH.length) || "/"
    : pathname;

const handle = async (req, res) => {
  const url = new URL(req.url, `http://${HOST}`);
  const requestPath = `${url.pathname}${url.search}`;
  const pathname = route(url.pathname);
  const method = req.method || "GET";

  if (method === "OPTIONS") {
    sendJson(res, 204, null);
    return;
  }

  if (method === "GET" && pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      identities: Object.keys(store.identities).length,
      shares: Object.keys(store.shares).length,
    });
    return;
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

  // Registration is self-signed: the key in the body is the key being
  // registered, so no prior identity can exist on the relay.
  if (method === "POST" && pathname === "/identities") {
    const fingerprint = publicFingerprint(parsed.publicKey);
    const signedBy = verifySignature({ method, requestPath, body, publicKey: parsed.publicKey, headers: req.headers });
    if (signedBy !== fingerprint)
      throw new HttpError(401, "注册身份与公钥不匹配");
    if (typeof parsed.name !== "string" || !parsed.name.trim())
      throw new HttpError(400, "请提供密钥名称");

    const identity = {
      id: fingerprint.slice(0, 12),
      name: parsed.name.trim().slice(0, 40),
      fingerprint,
      publicKey: parsed.publicKey,
    };
    store.identities[fingerprint] = identity;
    saveStore();
    sendJson(res, 200, identity);
    return;
  }

  if (method === "GET" && pathname === "/identities") {
    sendJson(res, 200, Object.values(store.identities));
    return;
  }

  if (method === "POST" && pathname === "/shares") {
    const stored = requireStoredIdentity({ headers: req.headers });
    const signedBy = verifySignature({ method, requestPath, body, publicKey: stored.publicKey, headers: req.headers });
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
      if (typeof recipient !== "string" || !store.identities[recipient])
        throw new HttpError(400, "接收用户尚未注册");
    }

    const payload = validatePayload(parsed.payload);
    const record = {
      id,
      owner: signedBy,
      recipients,
      payload,
      updatedAt: payload.updatedAt,
    };
    store.shares[id] = record;
    saveStore();
    sendJson(res, 200, record);
    return;
  }

  const shareMatch = pathname.match(/^\/shares\/([^/]+)$/);
  const listMatch = pathname === "/shares";

  if (method === "GET" && (listMatch || shareMatch)) {
    const stored = requireStoredIdentity({ headers: req.headers });
    verifySignature({ method, requestPath, body, publicKey: stored.publicKey, headers: req.headers });
    const recipient = url.searchParams.get("recipient");
    if (recipient !== stored.fingerprint)
      throw new HttpError(403, "只能读取发给自己的分享");

    if (shareMatch) {
      const record = store.shares[decodeURIComponent(shareMatch[1])];
      if (!record || !record.recipients.includes(recipient))
        throw new HttpError(404, "分享不存在或无权访问");
      sendJson(res, 200, record);
      return;
    }

    sendJson(res, 200, Object.values(store.shares).filter((record) => record.recipients.includes(recipient)));
    return;
  }

  if (method === "DELETE" && shareMatch) {
    const stored = requireStoredIdentity({ headers: req.headers });
    const signedBy = verifySignature({ method, requestPath, body, publicKey: stored.publicKey, headers: req.headers });
    const id = decodeURIComponent(shareMatch[1]);
    const record = store.shares[id];
    if (!record) throw new HttpError(404, "分享不存在");
    if (record.owner !== signedBy) throw new HttpError(403, "只能删除自己发布的分享");
    delete store.shares[id];
    saveStore();
    sendJson(res, 200, { ok: true });
    return;
  }

  throw new HttpError(404, "接口不存在");
};

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    const status = error instanceof HttpError ? error.status : 500;
    const message =
      status === 500 ? "中转服务内部错误" : error.message;
    if (status === 500) console.error(error);
    if (!res.headersSent) sendJson(res, status, { error: message });
    else res.end();
  });
});

server.listen(PORT, HOST, () => {
  console.log(`花与竹标签分享中转服务已启动: http://${HOST}:${PORT}`);
  console.log(`数据文件: ${DATA_FILE}`);
});
