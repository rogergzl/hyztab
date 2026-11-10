type BookmarksApi = typeof browser.bookmarks;

/**
 * The bookmarks API, or null where the browser has none.
 *
 * Capability detection rather than browser sniffing: what matters is whether
 * the API is there, not what the browser calls itself. Safari has no bookmarks
 * API at all, and Firefox for Android likewise.
 */
export const bookmarksApi = (): BookmarksApi | null => {
  if (typeof browser === "undefined") return null;

  const api = browser.bookmarks as BookmarksApi | undefined;
  return api && typeof api.create === "function" ? api : null;
};

/**
 * A name for the browser, for display and logs only.
 *
 * Brave reports itself as Chrome on purpose, so the user agent cannot be
 * trusted on its own; it exposes `navigator.brave` instead.
 */
export const browserName = (): string => {
  if (typeof navigator === "undefined") return "未知浏览器";

  const nav = navigator as Navigator & { brave?: unknown };
  if (nav.brave) return "Brave";

  const agent = nav.userAgent ?? "";
  if (/Edg\//.test(agent)) return "Edge";
  if (/OPR\//.test(agent)) return "Opera";
  if (/Firefox\//.test(agent)) return "Firefox";
  if (/Chrome\//.test(agent)) return "Chrome";

  return "未知浏览器";
};
