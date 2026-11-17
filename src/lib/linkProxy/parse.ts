import { ProxyServer } from "./types";

/**
 * Turn whatever the user typed into a PAC proxy server.
 *
 * Accepted forms:
 *   host:port
 *   http://host:port   (also https:// — PAC has a single HTTP proxy token)
 *   socks5://host:port
 *   socks4://host:port
 *
 * A bare `host` is not enough: without a port there is no reliable default
 * for an arbitrary LAN proxy, so it is rejected rather than guessed.
 */
export const parseProxyAddress = (input?: string): ProxyServer | null => {
  const value = (input ?? "").trim();
  if (!value) return null;

  let kind: ProxyServer["kind"] = "PROXY";
  let rest = value;

  const scheme = rest.match(/^([a-z][a-z0-9+.-]*):\/\//i);
  if (scheme) {
    const name = scheme[1].toLowerCase();
    if (name === "http" || name === "https") kind = "PROXY";
    else if (name === "socks5") kind = "SOCKS5";
    else if (name === "socks4") kind = "SOCKS4";
    else return null;
    rest = rest.slice(scheme[0].length);
  }

  // Strip any path or user info: a proxy address is just host and port.
  rest = rest.split("/")[0];
  if (rest.includes("@")) return null;

  // A bracketed IPv6 literal keeps its brackets so the `host:port` token
  // stays unambiguous. Plain hosts and IPv4 go through the other branch.
  const match = rest.match(/^(\[[0-9a-f:]+\]|[a-z0-9.-]+)(?::(\d+))?$/i);
  if (!match) return null;

  const raw = match[1].trim().toLowerCase();
  const host = raw.startsWith("[") ? raw : raw.replace(/[^a-z0-9.-]/g, "");
  const port = match[2] ? Number(match[2]) : 80;

  if (!host || (!host.startsWith("[") && !/^[a-z0-9.-]+$/.test(host)))
    return null;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;

  return { kind, host, port };
};

/** True when the address can be used to build a rule. */
export const isValidProxyAddress = (input?: string): boolean =>
  parseProxyAddress(input) !== null;

/** The PAC token that returns a proxy for a given server kind. */
export const proxyToken = (server: ProxyServer): string =>
  `${server.kind} ${server.host}:${server.port}`;
