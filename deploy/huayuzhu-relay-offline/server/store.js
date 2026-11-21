"use strict";

/**
 * JSON-file persistence for the relay.
 *
 * Writes are atomic (write temp then rename) so a crash during a write cannot
 * leave a half-written shares file. All state lives under one data directory
 * which is mounted as a Docker volume.
 */

const fs = require("node:fs");
const path = require("node:path");
const config = require("./config");

fs.mkdirSync(config.dataDir, { recursive: true });

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") return fallback;
    throw new Error(`无法读取数据文件 ${path.basename(file)}: ${error.message}`);
  }
};

const writeJsonAtomic = (file, value) => {
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(temp, file);
};

// --- shares + identities -------------------------------------------------
const loadedShares = readJson(config.sharesFile, null);
const state = {
  identities:
    loadedShares && loadedShares.identities && typeof loadedShares.identities === "object"
      ? loadedShares.identities
      : {},
  shares:
    loadedShares && loadedShares.shares && typeof loadedShares.shares === "object"
      ? loadedShares.shares
      : {},
};

let writeQueue = Promise.resolve();
const saveShares = () => {
  writeQueue = writeQueue.then(() => writeJsonAtomic(config.sharesFile, state));
  return writeQueue;
};

// --- settings ------------------------------------------------------------
const loadedSettings = readJson(config.configFile, null);
const settings = {
  adminToken: config.adminToken,
  ...(loadedSettings && typeof loadedSettings === "object" ? loadedSettings : {}),
};
// Environment always wins over a stale file value for the token.
if (config.adminToken) settings.adminToken = config.adminToken;

const saveSettings = () => writeJsonAtomic(config.configFile, settings);

// --- logs ----------------------------------------------------------------
let logs = readJson(config.logsFile, []);
if (!Array.isArray(logs)) logs = [];
if (logs.length > config.maxLogEntries) logs = logs.slice(-config.maxLogEntries);

let logWriteQueue = Promise.resolve();
const appendLog = (entry) => {
  logs.push(entry);
  if (logs.length > config.maxLogEntries) logs.splice(0, logs.length - config.maxLogEntries);
  logWriteQueue = logWriteQueue.then(() => writeJsonAtomic(config.logsFile, logs));
  return logWriteQueue;
};

const clearLogs = () => {
  logs = [];
  logWriteQueue = logWriteQueue.then(() => writeJsonAtomic(config.logsFile, logs));
  return logWriteQueue;
};

module.exports = {
  state,
  settings,
  saveShares,
  saveSettings,
  getLogs: () => logs,
  appendLog,
  clearLogs,
};
