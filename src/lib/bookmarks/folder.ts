import { bookmarksApi } from "./platform";

/** The folder this extension owns. */
export const FOLDER_NAME = "标签页备份书签，请勿删除";

/**
 * The bookmarks bar.
 *
 * Taken as the root's first child rather than a hard coded id: Chrome usually
 * calls it "1" and Firefox "toolbar_____", but neither is promised.
 */
const bookmarksBarId = async (
  api: NonNullable<ReturnType<typeof bookmarksApi>>,
): Promise<string> => {
  const [root] = await api.getTree();
  const bar = root?.children?.[0];

  if (!bar) throw new Error("找不到书签栏");
  return bar.id;
};

/** Look for the folder by name under a parent. */
const findByName = async (
  api: NonNullable<ReturnType<typeof bookmarksApi>>,
  parentId: string,
  title: string,
): Promise<string | null> => {
  const children = await api.getChildren(parentId);
  const match = children.find((child) => !child.url && child.title === title);
  return match ? match.id : null;
};

/**
 * Whether a recorded id still points at our folder.
 *
 * A recorded id goes stale whenever the user deletes or renames the folder, so
 * it is re-checked rather than trusted. `get` rejects when a node is gone,
 * which is a normal outcome here and not an error.
 */
export const folderExists = async (
  folderId: string | null,
): Promise<boolean> => {
  const api = bookmarksApi();
  if (!api || !folderId) return false;

  try {
    const [node] = await api.get(folderId);
    return Boolean(node) && !node.url && node.title === FOLDER_NAME;
  } catch (e) {
    return false;
  }
};

/**
 * Find our folder, creating it when it is missing.
 *
 * Recreate on demand rather than only at first run: the user is free to delete
 * it, and the bookmarks simply get written back.
 */
export const ensureFolder = async (folderId: string | null): Promise<string> => {
  const api = bookmarksApi();
  if (!api) throw new Error("当前浏览器不支持书签接口");

  if (folderId && (await folderExists(folderId))) return folderId;

  const bar = await bookmarksBarId(api);
  const existing = await findByName(api, bar, FOLDER_NAME);
  if (existing) return existing;

  const created = await api.create({ parentId: bar, title: FOLDER_NAME });
  return created.id;
};
