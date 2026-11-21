"use strict";

/** Structured logging: console for docker logs + persistent JSON for the UI. */

const store = require("./store");

const emit = (level, category, message, detail) => {
  const entry = {
    at: new Date().toISOString(),
    level,
    category,
    message,
    detail: detail || null,
  };
  const extra = detail ? " " + JSON.stringify(detail) : "";
  const line = `[${entry.at}] ${level.toUpperCase()} ${category}: ${message}${extra}`;
  if (level === "error") console.error(line);
  else console.log(line);
  store.appendLog(entry).catch((error) =>
    console.error("写入日志失败:", error.message),
  );
};

module.exports = {
  info: (category, message, detail) => emit("info", category, message, detail),
  warn: (category, message, detail) => emit("warn", category, message, detail),
  error: (category, message, detail) => emit("error", category, message, detail),
};
