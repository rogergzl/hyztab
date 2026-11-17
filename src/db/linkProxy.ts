import { collectRules, LinkProxy, ProxyRule, ProxySource } from "../lib/linkProxy";
import { DB } from "../lib";
import { db, WidgetState } from "./state";

/**
 * Reads every links widget's saved links and turns their proxy settings into
 * routing rules. This is the single place that knows widgets store their data
 * under `data/<id>` and that only `widget/links` instances carry addresses.
 */

const LINKS_KEY = "widget/links";

type StoredLinks = { links?: ProxySource[] };

const isLinksWidget = (value: unknown): value is WidgetState =>
  Boolean(value) && (value as WidgetState).key === LINKS_KEY;

/** All links across every links widget on the page, in widget order. */
export const selectAllLinks = (): ProxySource[] => {
  const widgets = Array.from(DB.prefix(db, "widget/"))
    .map(([, value]) => value)
    .filter(isLinksWidget)
    .sort((a, b) => a.order - b.order);

  const links: ProxySource[] = [];
  for (const widget of widgets) {
    const stored = DB.get(db, `data/${widget.id}`) as StoredLinks | undefined;
    if (stored && Array.isArray(stored.links)) links.push(...stored.links);
  }
  return links;
};

/** The current proxy rules, derived from authoritative saved state. */
export const selectProxyRules = (): ProxyRule[] => collectRules(selectAllLinks());

/** Read one link's proxy setting without exposing the whole store to callers. */
export const proxyOf = (link: ProxySource): LinkProxy | undefined => link.proxy;
