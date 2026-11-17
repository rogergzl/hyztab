import { parseProxyAddress } from "./parse";
import { LinkProxy, ProxyRule } from "./types";

/** The minimal shape a link needs in order to contribute a proxy rule. */
export type ProxySource = {
  url?: string;
  proxy?: LinkProxy;
};

/** Read a hostname from a url, or null when it is missing or malformed. */
export const hostOf = (url?: string): string | null => {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase() || null;
  } catch (e) {
    return null;
  }
};

/**
 * Turn configured links into hostname rules.
 *
 * Only links with both a valid url and a valid proxy address contribute.
 * Duplicate hosts keep the first rule, so the outcome never depends on how
 * many times the same site was added. A single authority for this mapping
 * keeps the editor, the saved data and the PAC script in agreement.
 */
export const collectRules = (links: ProxySource[]): ProxyRule[] => {
  const seen = new Set<string>();
  const rules: ProxyRule[] = [];

  for (const link of links) {
    if (!link.proxy) continue;

    const host = hostOf(link.url);
    const server = parseProxyAddress(link.proxy.address);
    if (!host || !server || seen.has(host)) continue;

    seen.add(host);
    rules.push({ host, server });
  }

  return rules;
};
