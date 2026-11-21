import { nanoid } from "nanoid";

import { ShareIdentity } from "./types";

/** Base64url without padding, for compact signatures and fingerprints. */
export const base64url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const fromBase64url = (value: string): Uint8Array => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const subtle = (): SubtleCrypto => {
  const webcrypto = globalThis.crypto;
  if (!webcrypto?.subtle)
    throw new Error("当前环境不支持 Web Crypto，无法使用标签分享");
  return webcrypto.subtle;
};

const encoder = new TextEncoder();

export const sha256Hex = async (input: string): Promise<string> => {
  const digest = await subtle().digest("SHA-256", encoder.encode(input));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

/**
 * Stable fingerprint of a public key.
 *
 * Only the four fields that define a P-256 public point are hashed, so a JWK
 * exported by a different browser (which may add `ext` or `key_ops`) still
 * produces the same fingerprint.
 */
export const fingerprintOfPublicKey = async (
  publicKey: JsonWebKey,
): Promise<string> => {
  if (
    typeof publicKey.crv !== "string" ||
    typeof publicKey.kty !== "string" ||
    typeof publicKey.x !== "string" ||
    typeof publicKey.y !== "string"
  )
    throw new Error("公钥格式不正确");

  return sha256Hex(
    JSON.stringify({
      crv: publicKey.crv,
      kty: publicKey.kty,
      x: publicKey.x,
      y: publicKey.y,
    }),
  );
};

/** Generate a fresh signing identity. The private key never leaves storage. */
export const generateIdentity = async (
  name: string,
): Promise<ShareIdentity> => {
  const pair = await subtle().generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const [privateKey, publicKey] = await Promise.all([
    subtle().exportKey("jwk", pair.privateKey) as Promise<JsonWebKey>,
    subtle().exportKey("jwk", pair.publicKey) as Promise<JsonWebKey>,
  ]);

  return {
    id: nanoid(12),
    name: name.trim().slice(0, 40) || "未命名密钥",
    fingerprint: await fingerprintOfPublicKey(publicKey),
    publicKey,
    privateKey,
  };
};

/** The exact string both sides sign. Any change must be made on the relay too. */
export const canonicalRequest = async (input: {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  body: string;
}): Promise<string> =>
  [
    input.method.toUpperCase(),
    input.path,
    input.timestamp,
    input.nonce,
    await sha256Hex(input.body),
  ].join("\n");

/** Produce the auth headers for one relay request. */
export const signRequest = async (
  identity: ShareIdentity,
  method: string,
  path: string,
  body: string,
): Promise<Record<string, string>> => {
  if (!identity.privateKey)
    throw new Error("该密钥没有私钥（设置导出不包含私钥），请重新生成");

  const key = await subtle().importKey(
    "jwk",
    identity.privateKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const timestamp = String(Date.now());
  const nonce = base64url(globalThis.crypto.getRandomValues(new Uint8Array(16)));
  const message = await canonicalRequest({ method, path, timestamp, nonce, body });
  const signature = await subtle().sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(message),
  );

  return {
    "content-type": "application/json",
    "x-identity": identity.fingerprint,
    "x-timestamp": timestamp,
    "x-nonce": nonce,
    "x-signature": base64url(new Uint8Array(signature)),
  };
};
