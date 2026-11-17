/**
 * Proxy routing for quick links.
 *
 * Chrome/Edge only expose proxy configuration at the browser level through a
 * PAC script, which can select a proxy by hostname but not by tab, link or
 * request. These types are the shared vocabulary between the link editor,
 * the rule collector and the browser API bridge. They are deliberately kept
 * free of DOM and browser globals so they can be tested in isolation.
 */

/**
 * A proxy address as understood by a PAC script. `kind` maps directly to the
 * token PAC returns: HTTP proxies use `PROXY`, the rest use their SOCKS token.
 */
export type ProxyServer = {
  kind: "PROXY" | "SOCKS5" | "SOCKS4";
  host: string;
  port: number;
};

/** One hostname → server rule, extracted from a configured link. */
export type ProxyRule = {
  /** Lower-cased hostname from the link's url. */
  host: string;
  server: ProxyServer;
};

/** Per-link proxy settings stored alongside the link's other fields. */
export type LinkProxy = {
  /** The proxy address the user typed, kept verbatim for the editor. */
  address: string;
};
