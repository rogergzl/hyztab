import { nameKey } from "./name";

/** A link as far as synchronisation is concerned. */
export type SyncLink = {
  /**
   * Stable local id, used to track the entry across renames. A link's name is
   * not an identity: editing the address changes the name derived from it, and
   * matching on that would create a second bookmark instead of rewriting the
   * first one.
   */
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
 * What is known about an entry that was already synced, keyed by link id.
 *
 * Older records are keyed by the normalised name instead; such a key is still
 * honoured while a link carries that name, so an existing folder is adopted
 * rather than duplicated. The ledger's job is to remember which bookmarks are
 * ours, so that only those are ever removed.
 */
export type LedgerEntry = {
  bookmarkId: string;
  url: string;
};

export type Ledger = Record<string, LedgerEntry>;

export type Plan = {
  /** Links with no bookmark yet, in slot order. */
  create: SyncLink[];
  /** Link id → the bookmark that already belongs to it, rewritten or not. */
  bind: Array<{ linkId: string; bookmarkId: string; url: string }>;
  /** Bookmarks whose title or address no longer matches their link. */
  update: Array<{
    linkId: string;
    bookmarkId: string;
    title: string;
    url: string;
  }>;
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
  bind: [],
  update: [],
  remove: [],
  takeOn: [],
});

/**
 * Work out the writes needed to bring the folder and the links together.
 *
 * A link is matched to its bookmark by id first, so renaming a link or editing
 * its address rewrites that one bookmark in place. Only a link the ledger has
 * never seen falls back to matching by name, which is what adopts a folder on
 * first attach and picks up records written before ids were stored.
 *
 * Addresses are still never used to recognise an entry: two links may share an
 * address, and a wrong match would leave a bookmark pointing somewhere
 * unreachable. Where two bookmarks carry the same name the earliest in the
 * folder wins, so the outcome is stable.
 *
 * Only bookmarks recorded in the ledger are ever removed, so an entry the user
 * filed in the folder by hand is never touched.
 */
export const planSync = (
  links: SyncLink[],
  entries: FolderEntry[],
  ledger: Ledger,
  { taking, capacity }: PlanOptions,
): Plan => {
  const plan = emptyPlan();

  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  // First entry wins for a given name, giving a stable choice with duplicates.
  const byName = new Map<string, FolderEntry>();
  for (const entry of [...entries].sort((a, b) => a.index - b.index)) {
    const key = nameKey(entry.title);
    if (!byName.has(key)) byName.set(key, entry);
  }

  const claimed = new Set<string>();

  for (const link of links) {
    const key = nameKey(link.title);
    // A record under the link's own id wins; a name-keyed one is what older
    // records look like, and is only used while the link still bears that name.
    const bound = ledger[link.id] ?? ledger[key];
    const entry = (bound ? byId.get(bound.bookmarkId) : undefined) ?? byName.get(key);

    if (!entry) {
      plan.create.push(link);
      continue;
    }

    claimed.add(entry.id);
    plan.bind.push({ linkId: link.id, bookmarkId: entry.id, url: link.url });

    if (entry.title !== link.title || entry.url !== link.url)
      plan.update.push({
        linkId: link.id,
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
    plan.bind = [];
    return plan;
  }

  // A bookmark we created whose link no longer exists. Keyed records for links
  // that still exist under that id or that name are left alone, and a bookmark
  // another link has since adopted is never queued.
  const liveIds = new Set(links.map((link) => link.id));
  const liveNames = new Set(links.map((link) => nameKey(link.title)));
  const queued = new Set<string>();

  for (const [key, value] of Object.entries(ledger)) {
    if (liveIds.has(key) || liveNames.has(key)) continue;
    if (claimed.has(value.bookmarkId)) continue;
    if (!byId.has(value.bookmarkId)) continue;
    if (queued.has(value.bookmarkId)) continue;

    queued.add(value.bookmarkId);
    plan.remove.push(value.bookmarkId);
  }

  // Earliest first, so a manual sync removes them in folder order.
  plan.remove.sort(
    (a, b) => (byId.get(a)?.index ?? 0) - (byId.get(b)?.index ?? 0),
  );

  return plan;
};

/** True when a plan has nothing left to do. */
export const planIsEmpty = (plan: Plan): boolean =>
  plan.create.length === 0 &&
  plan.update.length === 0 &&
  plan.remove.length === 0 &&
  plan.takeOn.length === 0;
