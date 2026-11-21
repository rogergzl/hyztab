"use strict";

/**
 * Runtime configuration for the relay node.
 *
 * Everything is driven by environment variables so the same image works on a
 * laptop, a Proxmox VM or 1Panel. Defaults favour a private LAN deployment:
 * the proxy listens on all interfaces, but an admin token is mandatory for the
 * management API and may be required for proxying too.
 */

const path = require("node:path");

const int = (value, fallback, min, max) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

const bool = (value, fallback) => {
  if (value === undefined || value === "") return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
};

const DATA_DIR = path.resolve(
  process.env.RELAY_DATA_DIR || path.join(__dirname, "..", "data"),
);
const WEB_DIR = path.join(__dirname, "..", "web");

const config = {
  // Network
  host: process.env.RELAY_HOST || "0.0.0.0",
  port: int(process.env.RELAY_PORT, 8787, 1, 65535),
  basePath: (process.env.RELAY_BASE_PATH || "").replace(/\/$/, ""),

  // Storage
  dataDir: DATA_DIR,
  sharesFile: path.join(DATA_DIR, "shares.json"),
  logsFile: path.join(DATA_DIR, "logs.json"),
  configFile: path.join(DATA_DIR, "settings.json"),

  // Web UI
  webDir: WEB_DIR,
  adminToken: process.env.RELAY_ADMIN_TOKEN || "",
  // When true, the proxy also requires the admin token (X-Relay-Token header
  // or Proxy-Authorization). Useful when the node is reachable from the LAN.
  proxyRequiresToken: bool(process.env.RELAY_PROXY_TOKEN, false),

  // Limits
  maxBody: int(process.env.RELAY_MAX_BODY_KB, 256, 1, 8192) * 1024,
  clockSkew: int(process.env.RELAY_CLOCK_SKEW_S, 300, 1, 3600) * 1000,
  nonceTtl: int(process.env.RELAY_NONCE_TTL_S, 600, 10, 86400) * 1000,
  maxLogEntries: int(process.env.RELAY_MAX_LOGS, 5000, 100, 100000),
  connectTimeout: int(process.env.RELAY_CONNECT_TIMEOUT_S, 30, 1, 300) * 1000,

  // Behaviour
  allowPrivateTargets: bool(process.env.RELAY_ALLOW_PRIVATE, true),
  logProxyBodies: false,

  startedAt: Date.now(),
};

module.exports = config;
