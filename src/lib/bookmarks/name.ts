/**
 * Turning names into matching keys, and links into a change fingerprint.
 *
 * Both are pure so they can be reasoned about and tested without a browser.
 * The name is the only identifier a bookmark exposes, so the way it is
 * normalised decides whether two items are considered the same thing.
 */

/**
 * Normalise a name into the key used for matching.
 *
 * A bookmark carries nothing but a title and an address, so the title is the
 * identity. Folding case, width and whitespace means "Steam 余额 " and
 * "steam余额" are recognised as the same entry rather than one being treated
 * as a new bookmark.
 */
export const nameKey = (name?: string): string => {
  try {
    return (name ?? "")
      .normalize("NFKC")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  } catch (e) {
    // normalize is unavailable in a very old engine: fall back to the basics.
    return (name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  }
};

/**
 * A stable fingerprint of the links as they would be synced.
 *
 * Comparing fingerprints is how the new tab page decides whether a reconcile
 * is needed at all: links that have not changed cannot produce different
 * bookmarks, so the check avoids touching the bookmarks API entirely.
 */
export const fingerprint = (entries: Array<[string, string]>): string => {
  let hash = 5381;
  const text = entries.map(([key, url]) => `${key}\u0000${url}`).join("\u0001");

  for (let index = 0; index < text.length; index += 1) {
    // djb2: cheap, stable, and order sensitive, which is what is wanted here.
    hash = ((hash << 5) + hash) ^ text.charCodeAt(index);
  }

  return `${entries.length}:${(hash >>> 0).toString(36)}`;
};
