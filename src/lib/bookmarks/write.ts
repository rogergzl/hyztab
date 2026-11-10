import { bookmarksApi } from "./platform";

const requireApi = () => {
  const api = bookmarksApi();
  if (!api) throw new Error("当前浏览器不支持书签接口");
  return api;
};

/**
 * Add a bookmark and return its id.
 *
 * Writes are serial on purpose. `create` and `move` are asynchronous and the
 * resulting index is indeterminate while calls overlap, so each one is awaited
 * before the next is issued, otherwise the order comes out wrong.
 */
export const createBookmark = async (
  folderId: string,
  { title, url, index }: { title: string; url: string; index?: number },
): Promise<string> => {
  const node = await requireApi().create({ parentId: folderId, title, url, index });
  return node.id;
};

/** Rewrite a bookmark's title and address, keeping its position. */
export const updateBookmark = async (
  bookmarkId: string,
  { title, url }: { title: string; url: string },
): Promise<void> => {
  await requireApi().update(bookmarkId, { title, url });
};

/**
 * Delete a bookmark this extension created.
 *
 * Only ever called with an id taken from the ledger, never with one found by
 * searching the tree, so a bookmark the user filed by hand is out of reach.
 */
export const removeBookmark = async (bookmarkId: string): Promise<void> => {
  try {
    await requireApi().remove(bookmarkId);
  } catch (e) {
    // Already gone: nothing to undo, and the caller should carry on.
  }
};
