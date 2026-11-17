import { proxyToken } from "./parse";
import { ProxyRule, ProxyServer } from "./types";

/** Escape a value for safe embedding inside a double-quoted PAC string. */
const quote = (value: string): string =>
  JSON.stringify(value.replace(/\\/g, "\\\\").replace(/"/g, '\\"'));

/**
 * Build a PAC script that proxies the configured hosts and routes everything
 * else through `fallback` when one is given.
 *
 * Hosts are matched exactly (and case-insensitively, as PAC hostnames are
 * lower-cased by the browser). A subdomain is a different host and is left
 * alone unless it was configured on its own — the narrowest possible routing.
 *
 * The fallback exists because a PAC cannot say "use the system proxy": any
 * host it does not name is decided by this script alone. Without a fallback a
 * user who normally browses through Clash or v2ray would find every other site
 * silently going direct. With one, the chain `PROXY x; DIRECT` keeps that
 * proxy in play and still works when it is not running.
 */
export const buildPacScript = (
  rules: ProxyRule[],
  fallback?: ProxyServer | null,
): string => {
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

  // A PAC return can list several proxies; the browser tries them in order.
  // Ending with DIRECT means an idle fallback proxy costs a failed connect
  // attempt, never a broken page.
  lines.push(
    `  return ${quote(fallback ? `${proxyToken(fallback)}; DIRECT` : "DIRECT")};`,
  );
  lines.push("}");
  return lines.join("\n");
};
