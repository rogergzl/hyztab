"use strict";

/**
 * ECDSA P-256 request signing, compatible with 花与竹标签's link sharing.
 *
 * Canonical message (both sides must agree):
 *   METHOD + "\n" + path + "\n" + timestamp + "\n" + nonce + "\n" + sha256(body)
 * Signature is raw IEEE-P1363 (r||s), base64url encoded, in x-signature.
 *
 * Path compatibility: the extension signs a RELATIVE path such as "shares"
 * while the HTTP request path is "/shares". Older relays only accepted the
 * request path, which rejects every real client request. We therefore verify
 * against every plausible form of the path so both old and new clients work.
 */

const crypto = require("node:crypto");
const config = require("./config");

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

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

/** All reasonable path forms the client may have signed. */
const candidatePaths = (requestPath) => {
  const forms = new Set();
  const add = (value) => {
    if (value) forms.add(value);
  };

  add(requestPath);
  // With or without a leading slash.
  add(requestPath.replace(/^\//, ""));
  add(`/${requestPath.replace(/^\//, "")}`);

  // A reverse proxy may strip the configured base path; accept both the
  // stripped and the full form so the signed value is always covered.
  if (config.basePath) {
    for (const form of [...forms]) add(`${config.basePath}${form}`);
  }
  return [...forms];
};

const seenNonces = new Map();
const pruneNonces = () => {
  const cutoff = Date.now() - config.nonceTtl;
  for (const [nonce, issued] of seenNonces) {
    if (issued < cutoff) seenNonces.delete(nonce);
  }
};

/**
 * Verify the signed request. Returns the signing identity (fingerprint).
 * `publicKey` is the stored JWK for known identities, or the JWK in the body
 * for self-signed registration.
 */
const verifySignature = ({ method, requestPath, body, publicKey, headers }) => {
  const identity = headers["x-identity"];
  const timestamp = headers["x-timestamp"];
  const nonce = headers["x-nonce"];
  const signature = headers["x-signature"];
  if (!identity || !timestamp || !nonce || !signature)
    throw new HttpError(401, "缺少签名信息");

  const issued = Number(timestamp);
  if (!Number.isFinite(issued) || Math.abs(Date.now() - issued) > config.clockSkew)
    throw new HttpError(401, "请求签名已过期");
  if (seenNonces.has(nonce)) throw new HttpError(401, "签名不可重复使用");

  let key;
  try {
    key = crypto.createPublicKey({ key: publicKey, format: "jwk" });
  } catch (error) {
    throw new HttpError(400, "公钥无法解析: " + error.message);
  }

  const signatureBytes = Buffer.from(signature, "base64url");
  const ok = candidatePaths(requestPath).some((candidate) =>
    crypto.verify(
      "sha256",
      Buffer.from(canonical(method, candidate, timestamp, nonce, body), "utf8"),
      { key, dsaEncoding: "ieee-p1363" },
      signatureBytes,
    ),
  );
  if (!ok) throw new HttpError(401, "签名校验失败");

  seenNonces.set(nonce, Date.now());
  pruneNonces();
  return identity;
};

module.exports = { HttpError, sha256Hex, publicFingerprint, verifySignature };
