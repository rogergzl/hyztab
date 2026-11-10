import { FolderEntry } from "./plan";
import { bookmarksApi } from "./platform";

/**
 * The bookmarks in a folder, in the order they appear in the bar.
 *
 * The order is the authority for which slot a link occupies: folded folders
 * and separators are left out, and the position is the node's own index.
 */
export const readFolder = async (
  folderId: string | null,
): Promise<FolderEntry[]> => {
  const api = bookmarksApi();
  if (!api || !folderId) return [];

  const children = await api.getChildren(folderId);

  return children
    .filter((child) => Boolean(child.url))
    .map((child, position) => ({
      id: child.id,
      title: child.title,
      url: child.url ?? "",
      index: child.index ?? position,
    }))
    .sort((a, b) => a.index - b.index);
};
