import { DB } from "../lib";
import {
  normalizeProxyNodes,
  resolveProxyAddress,
} from "../lib/linkProxy";
import { db } from "./state";

/**
 * Persistence for the named proxy pool.
 *
 * Validation and address resolution are pure functions in `lib/linkProxy`;
 * this module only reads and writes the authoritative page level state.
 */

export type { ProxyNode } from "../lib/linkProxy";
export { normalizeProxyNodes, resolveProxyAddress };

/** The authoritative node list, read through the database middle layer. */
export const selectProxyNodes = () =>
  normalizeProxyNodes(DB.get(db, "linkProxyNodes"));

/** Replace the whole node list. Invalid entries are dropped at the boundary. */
export const setProxyNodes = (nodes: unknown): void => {
  DB.put(db, "linkProxyNodes", normalizeProxyNodes(nodes));
};

/**
 * Add a node and return its id, or null when the address is unusable.
 * Names may repeat; addresses need not be unique — two labels can point to the
 * same proxy if the user wants different descriptions in different contexts.
 */
export const addProxyNode = (name: string, address: string): string | null => {
  const normalized = normalizeProxyNodes([{ name, address }]);
  if (normalized.length === 0) return null;

  setProxyNodes([...selectProxyNodes(), normalized[0]]);
  return normalized[0].id;
};

/** Remove a node. Links pointing at it fall back to their own address field. */
export const removeProxyNode = (id: string): void => {
  setProxyNodes(selectProxyNodes().filter((node) => node.id !== id));
};
