import { nameKey } from "./name";

/** A link as far as synchronisation is concerned. */
export type SyncLink = {
  /** Stable local id, used to track the entry across renames. */
  id: string;
  /** Title written to the bookmark. */
  title: string;
  url: string;
};

/** A bookmark inside the folder. */
export type FolderEntry = {
  id: string;
  title: string;
  url: string;
  index: number;
};

/**
 * What is known about an entry that was already synced, keyed by name.
 *
 * Keying by name rather than by a link id means the links need no identifier
 * of their own, so nothing has to be migrated into existing link data. The
 * ledger's job is to remember which bookmarks are ours, so that only those are
 * ever removed.
 */
export type LedgerEntry = {
  bookmarkId: string;
  url: string;
};

export type Ledger = Record<string, LedgerEntry>;

export type Plan = {
  /** Links with no bookmark yet, in slot order. */
  create: SyncLink[];
  /** Bookmarks whose title or address no longer matches the link. */
  update: Array<{ bookmarkId: string; title: string; url: string }>;
  /** Bookmarks whose link is gone, applied only on a manual sync. */
  remove: string[];
  /** Bookmarks to take on as links, on first attach only. */
  takeOn: FolderEntry[];
};

export type PlanOptions = {
  /**
   * True on first attach, when the folder holds bookmarks but nothing has been
   * synced yet: the folder is then the source and its entries become links.
   */
  taking: boolean;
  /** How many slots are free for taking entries on. */
  capacity: number;
};

const emptyPlan = (): Plan => ({
  create: [],
  update: [],
  remove: [],
  takeOn: [],
});

/**
 * Work out the writes needed to bring the folder and the links together.
 *
 * Matching is by name, and only by name. An address is a value to write, never
 * a way to recognise an entry: matching addresses would risk writing the wrong
 * one, which would leave a bookmark pointing somewhere unreachable, while a
 * mismatched name is merely a wrong label. Where two bookmarks carry the same
 * name the one earliest in the folder wins, so the outcome is stable.
 *
 * Only bookmarks recorded in the ledger are ever removed, so an entry the user
 * added to the folder by hand is never touched.
 */
export const planSync = (
  links: SyncLink[],
  entries: FolderEntry[],
  ledger: Ledger,
  { taking, capacity }: PlanOptions,
): Plan => {
  const plan = emptyPlan();

  // First entry wins for a given name, giving a stable choice with duplicates.
  const byName = new Map<string, FolderEntry>();
  for (const entry of [...entries].sort((a, b) => a.index - b.index)) {
    const key = nameKey(entry.title);
    if (!byName.has(key)) byName.set(key, entry);
  }

  const claimed = new Set<string>();

  for (const link of links) {
    const key = nameKey(link.title);
    const entry = byName.get(key);

    if (!entry) {
      plan.create.push(link);
      continue;
    }

    claimed.add(entry.id);

    if (entry.title !== link.title || entry.url !== link.url)
      plan.update.push({
        bookmarkId: entry.id,
        title: link.title,
        url: link.url,
      });
  }

  if (taking) {
    // Nothing to converge on yet: adopt the folder's own order instead.
    plan.takeOn = entries
      .filter((entry) => !claimed.has(entry.id))
      .sort((a, b) => a.index - b.index)
      .slice(0, Math.max(0, capacity));
    plan.create = [];
    plan.update = [];
    return plan;
  }

  // Entries this extension created and no longer has a link for.
  const known = new Set(
    Object.values(ledger).map((entry) => entry.bookmarkId),
  );
  plan.remove = entries
    .filter((entry) => known.has(entry.id) && !claimed.has(entry.id))
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.id);

  return plan;
};

/** True when a plan has nothing left to do. */
export const planIsEmpty = (plan: Plan): boolean =>
  plan.create.length === 0 &&
  plan.update.length === 0 &&
  plan.remove.length === 0 &&
  plan.takeOn.length === 0;
