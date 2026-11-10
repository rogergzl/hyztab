import { Ledger } from "../lib/bookmarks";

/**
 * The bookmark sync record.
 *
 * Kept in local storage rather than synced settings: a bookmark id belongs to
 * one browser profile, so carrying it to another device would point at
 * bookmarks that do not exist there. This module is the only reader and writer
 * of the record; everything else goes through it.
 */
const KEY = "huayuzhu/bookmarks";

export type SyncState = {
  /** Id of the folder this extension owns, once it has been created. */
  folderId: string | null;
  /** Fingerprint of the links as they were at the last reconcile. */
  fingerprint: string;
  /** Bookmarks this extension created, keyed by name. */
  ledger: Ledger;
  /** How many bookmarks are waiting for a manual sync. */
  pending: number;
};

export const emptySyncState = (): SyncState => ({
  folderId: null,
  fingerprint: "",
  ledger: {},
  pending: 0,
});

const hasLocalStorage = (): boolean =>
  typeof browser !== "undefined" && Boolean(browser.storage?.local);

export const loadSyncState = async (): Promise<SyncState> => {
  if (!hasLocalStorage()) return emptySyncState();

  try {
    const stored = await browser.storage.local.get(KEY);
    return { ...emptySyncState(), ...(stored[KEY] ?? {}) };
  } catch (e) {
    // A broken record only costs one extra reconcile, so carry on.
    return emptySyncState();
  }
};

export const saveSyncState = async (state: SyncState): Promise<void> => {
  if (!hasLocalStorage()) return;

  try {
    await browser.storage.local.set({ [KEY]: state });
  } catch (e) {
    // Ignore: the next reconcile simply does the work again.
  }
};
