import { nanoid } from "nanoid";

import { isValidProxyAddress } from "./parse";

/**
 * Named proxy nodes shared by all links widgets.
 *
 * Kept free of browser/storage APIs so the normalization and resolution rules
 * can be tested directly. Persistence lives in `db/linkProxyNodes`.
 */
export type ProxyNode = {
  id: string;
  /** Label shown in the link editor. */
  name: string;
  /** Raw address typed by the user, kept verbatim for editing. */
  address: string;
};

/** Keep a malformed import from filling the sidebar or sync storage. */
const MAX_NODES = 50;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Normalize any stored or incoming value into a usable node list. */
export const normalizeProxyNodes = (value: unknown): ProxyNode[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const nodes: ProxyNode[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;

    const address = typeof item.address === "string" ? item.address.trim() : "";
    if (!isValidProxyAddress(address)) continue;

    const name =
      typeof item.name === "string" && item.name.trim()
        ? item.name.trim().slice(0, 40)
        : address;
    const id =
      typeof item.id === "string" && item.id.trim() && !seen.has(item.id)
        ? item.id.trim()
        : nanoid(12);

    seen.add(id);
    nodes.push({ id, name, address });
    if (nodes.length >= MAX_NODES) break;
  }
  return nodes;
};

/**
 * Resolve the address a link should use.
 *
 * A node reference wins over the legacy inline address so editing a named node
 * updates every link that selected it. Links saved before nodes existed keep
 * working through their inline address, and links whose node was deleted fall
 * back to that address instead of silently losing the proxy.
 */
export const resolveProxyAddress = (
  proxy: { address?: string; nodeId?: string } | undefined,
  nodes: ProxyNode[] = [],
): string => {
  if (!proxy) return "";
  if (proxy.nodeId) {
    const node = nodes.find((item) => item.id === proxy.nodeId);
    if (node) return node.address;
  }
  return (proxy.address ?? "").trim();
};
