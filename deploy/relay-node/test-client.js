"use strict";

/**
 * Manual integration test: signs requests exactly like the extension's
 * src/lib/linkShare/crypto.ts (relative path, base64url, P-256/P1363).
 * Run against a live node: node test-client.js http://127.0.0.1:8899
 */

const crypto = require("node:crypto");

const BASE = process.argv[2] || "http://127.0.0.1:8899";

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const sha256Hex = (value) =>
  crypto.createHash("sha256").update(value, "utf8").digest("hex");

// Generate a P-256 key pair and export JWKs like WebCrypto does.
const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});
const pubJwk = publicKey.export({ format: "jwk" });
const privJwk = privateKey.export({ format: "jwk" });
const publicForFingerprint = {
  crv: pubJwk.crv,
  kty: pubJwk.kty,
  x: pubJwk.x,
  y: pubJwk.y,
};
const fingerprint = sha256Hex(JSON.stringify(publicForFingerprint));

const sign = (method, path, body) => {
  const ts = String(Date.now());
  const nonce = b64url(crypto.randomBytes(16));
  const canonical = [method.toUpperCase(), path, ts, nonce, sha256Hex(body)].join("\n");
  const sig = crypto.sign(
    "sha256",
    Buffer.from(canonical, "utf8"),
    { key: privateKey, dsaEncoding: "ieee-p1363" },
  );
  return {
    "content-type": "application/json",
    "x-identity": fingerprint,
    "x-timestamp": ts,
    "x-nonce": nonce,
    "x-signature": b64url(sig),
  };
};

const call = async (method, path, body, identity) => {
  const payload = body === undefined ? "" : JSON.stringify(body);
  const headers = identity
    ? sign(method, path, payload)
    : { "content-type": "application/json" };
  const response = await fetch(`${BASE}/${path.replace(/^\//, "")}`, {
    method,
    headers,
    body: method === "GET" || method === "DELETE" ? undefined : payload,
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${JSON.stringify(data)}`);
  return data;
};

(async () => {
  console.log("指纹:", fingerprint.slice(0, 12));

  const registered = await call("POST", "identities", {
    name: "测试密钥",
    publicKey: publicForFingerprint,
  }, true);
  console.log("✓ 注册身份:", registered.id, registered.name);

  const identities = await call("GET", "identities");
  console.log("✓ 身份列表:", identities.length);

  const shareId = "test-share-0001";
  await call("POST", "shares", {
    id: shareId,
    owner: fingerprint,
    recipients: [fingerprint],
    payload: {
      url: "https://aphqsia.com/",
      name: "主页",
      updatedAt: Date.now(),
    },
  }, true);
  console.log("✓ 发布分享:", shareId);

  const incoming = await call("GET", `shares?recipient=${encodeURIComponent(fingerprint)}`, undefined, true);
  console.log("✓ 收到的分享:", incoming.length, incoming[0]?.payload?.url);

  const one = await call("GET", `shares/${shareId}?recipient=${encodeURIComponent(fingerprint)}`, undefined, true);
  console.log("✓ 读取单个分享:", one.id);

  await call("DELETE", `shares/${shareId}`, undefined, true);
  console.log("✓ 删除分享");

  console.log("\n全部通过 — 扩展签名协议完全兼容");
})().catch((error) => {
  console.error("✗ 测试失败:", error.message);
  process.exit(1);
});
