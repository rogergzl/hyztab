import React from "react";

import {
  bookmarksApi,
  createBookmark,
  ensureFolder,
  fingerprint,
  nameKey,
  planSync,
  readFolder,
  removeBookmark,
  updateBookmark,
  Ledger,
} from "../../../lib/bookmarks";
import { loadSyncState, saveSyncState } from "../../../db/bookmarkSync";

export type SyncLinkInput = { title: string; url: string };

export type BookmarkSyncStatus = {
  /** Whether this browser has a bookmarks API at all. */
  supported: boolean;
  /** Bookmarks waiting for a manual sync. */
  pending: number;
  /** A reconcile is running. */
  busy: boolean;
  /** Hover text describing the current state. */
  note: string;
  /** Delete the bookmarks whose links are gone. */
  syncRemovals: () => void;
};

type Options = {
  enabled: boolean;
  links: SyncLinkInput[];
  capacity: number;
  /**
   * Hold off while a link is being configured. Writing a bookmark on every
   * keystroke would leave several of them behind, so the first one is written
   * only once the edit is committed and the panel closed.
   */
  suspended?: boolean;
  /** Called with folder entries to adopt as links, on first attach. */
  onTakeOn: (entries: SyncLinkInput[]) => void;
};

/**
 * Keep the bookmark folder in step with the links.
 *
 * Runs on every new tab: a fingerprint of the links decides whether anything
 * can have changed at all, so a page opened with unchanged links costs no
 * bookmark API calls. Adding a link writes its bookmark straight away; a
 * removed link only leaves a bookmark waiting, which the manual sync clears.
 */
export const useBookmarkSync = ({
  capacity,
  enabled,
  links,
  onTakeOn,
  suspended,
}: Options): BookmarkSyncStatus => {
  const [pending, setPending] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const running = React.useRef(false);
  // A run asked for while another was in flight, so the last change is never
  // dropped: the newest state always gets its turn.
  const queued = React.useRef(false);

  const supported = Boolean(bookmarksApi());

  // The fingerprint is what the effect keys on, so it has to be a plain value
  // rather than the array, which is a new object on every render.
  const marked = React.useMemo(
    () => fingerprint(links.map((link) => [nameKey(link.title), link.url])),
    [JSON.stringify(links.map((link) => [link.title, link.url]))],
  );

  // Read through a ref so the effect does not restart as props change.
  const latest = React.useRef({ capacity, links, onTakeOn });
  latest.current = { capacity, links, onTakeOn };

  const reconcile = React.useCallback(
    async (forceRemovals: boolean): Promise<number> => {
      const api = bookmarksApi();
      if (!api || !enabled) return 0;

      const state = await loadSyncState();

      // Unchanged links cannot produce different bookmarks, so there is
      // nothing to look at. This is the steady state on every new tab.
      if (!forceRemovals && state.folderId && state.fingerprint === marked)
        return state.pending;

      const { links: current, capacity: slots, onTakeOn: take } = latest.current;

      const folderId = await ensureFolder(state.folderId);
      const entries = await readFolder(folderId);

      const syncLinks = current.map((link) => ({
        id: nameKey(link.title),
        title: link.title,
        url: link.url,
      }));

      // First attach: the folder already holds bookmarks and nothing has been
      // synced yet, so the folder is the source and its entries become links.
      const taking =
        entries.length > 0 &&
        syncLinks.length === 0 &&
        Object.keys(state.ledger).length === 0 &&
        !state.fingerprint;

      const plan = planSync(syncLinks, entries, state.ledger, {
        taking,
        capacity: slots,
      });

      const ledger: Ledger = { ...state.ledger };

      if (taking) {
        if (plan.takeOn.length > 0)
          take(plan.takeOn.map((entry) => ({ title: entry.title, url: entry.url })));
      } else {
        // Serial on purpose: overlapping writes leave the order indeterminate.
        for (const link of plan.create) {
          const bookmarkId = await createBookmark(folderId, {
            title: link.title,
            url: link.url,
          });
          ledger[nameKey(link.title)] = { bookmarkId, url: link.url };
        }

        for (const item of plan.update) {
          await updateBookmark(item.bookmarkId, item);
          ledger[nameKey(item.title)] = {
            bookmarkId: item.bookmarkId,
            url: item.url,
          };
        }
      }

      // Removals are the manual step, so they are only acted on when asked.
      if (forceRemovals) {
        for (const bookmarkId of plan.remove) {
          await removeBookmark(bookmarkId);
          for (const [key, value] of Object.entries(ledger))
            if (value.bookmarkId === bookmarkId) delete ledger[key];
        }
      }

      await saveSyncState({
        folderId,
        fingerprint: marked,
        ledger,
        pending: forceRemovals ? 0 : plan.remove.length,
      });

      return forceRemovals ? 0 : plan.remove.length;
    },
    [enabled, marked],
  );

  const start = React.useCallback(
    (forceRemovals: boolean) => {
      if (running.current) {
        // Already working: remember that another pass is wanted.
        queued.current = true;
        return;
      }

      running.current = true;
      setBusy(true);
      setError(null);

      reconcile(forceRemovals)
        .then(setPending)
        .catch((reason: Error) => setError(reason?.message ?? "书签同步失败"))
        .finally(() => {
          running.current = false;
          setBusy(false);

          if (queued.current) {
            queued.current = false;
            start(forceRemovals);
          }
        });
    },
    [reconcile],
  );

  React.useEffect(() => {
    if (!supported || !enabled || suspended) return;

    start(false);
  }, [supported, enabled, suspended, start]);

  const syncRemovals = React.useCallback(() => {
    if (!supported) return;
    start(true);
  }, [supported, start]);

  const note = !supported
    ? "当前浏览器不支持书签接口，无法同步"
    : suspended
      ? "关闭配置面板后同步"
      : error
      ? error
      : !enabled
        ? "书签同步已关闭，可在侧边栏的快速链接网格里开启"
        : pending > 0
          ? `有 ${pending} 项待同步，点击删除对应书签`
          : "已同步";

  return { supported, pending, busy, note, syncRemovals };
};
