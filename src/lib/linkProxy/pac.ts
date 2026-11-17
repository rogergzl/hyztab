import { proxyToken } from "./parse";
import { ProxyRule } from "./types";

/** Escape a value for safe embedding inside a double-quoted PAC string. */
const quote = (value: string): string =>
  JSON.stringify(value.replace(/\\/g, "\\\\").replace(/"/g, '\\"'));

/**
 * Build a PAC script that proxies only the configured hosts and connects
 * directly to everything else.
 *
 * Hosts are matched exactly (and case-insensitively, as PAC hostnames are
 * lower-cased by the browser). A subdomain is a different host and is left
 * alone unless it was configured on its own — the narrowest possible routing.
 */
export const buildPacScript = (rules: ProxyRule[]): string => {
  const lines = [
    "function FindProxyForURL(url, host) {",
    "  host = String(host).toLowerCase();",
  ];

  for (const rule of rules) {
    lines.push(
      `  if (host === ${quote(rule.host.toLowerCase())}) return ${quote(
        proxyToken(rule.server),
      )};`,
    );
  }

  lines.push('  return "DIRECT";', "}");
  return lines.join("\n");
};
