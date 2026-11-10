import { planIsEmpty, planSync, FolderEntry, Ledger, SyncLink } from "./plan";

const link = (id: string, title: string, url = "https://a.com"): SyncLink => ({
  id,
  title,
  url,
});

const entry = (
  id: string,
  title: string,
  url = "https://a.com",
  index = 0,
): FolderEntry => ({ id, title, url, index });

const options = { taking: false, capacity: 24 };

describe("bookmarks/plan", () => {
  it("should create a bookmark for a link that has none", () => {
    const plan = planSync([link("l1", "Steam")], [], {}, options);

    expect(plan.create).toHaveLength(1);
    expect(plan.create[0].title).toBe("Steam");
    expect(plan.update).toHaveLength(0);
  });

  it("should leave an already matching bookmark alone", () => {
    // Nothing changed, so a reconcile must be a no-op. This is what makes the
    // change fingerprint check safe.
    const plan = planSync(
      [link("l1", "Steam")],
      [entry("b1", "Steam")],
      {},
      options,
    );

    expect(planIsEmpty(plan)).toBe(true);
  });

  it("should match on the normalised name", () => {
    const plan = planSync(
      [link("l1", "Steam 余额")],
      [entry("b1", "steam 余额")],
      {},
      options,
    );

    expect(plan.create).toHaveLength(0);
  });

  it("should update the address in place when only the url changed", () => {
    // The name is the anchor, so the address is rewritten rather than
    // producing a second bookmark.
    const plan = planSync(
      [link("l1", "Steam", "https://new.com")],
      [entry("b1", "Steam", "https://old.com")],
      {},
      options,
    );

    expect(plan.create).toHaveLength(0);
    expect(plan.remove).toHaveLength(0);
    expect(plan.update).toEqual([
      { bookmarkId: "b1", title: "Steam", url: "https://new.com" },
    ]);
  });

  it("should never match on the address", () => {
    // Same address, different name: a new bookmark, not a match. Matching by
    // address could otherwise write the wrong one and break the bookmark.
    const plan = planSync(
      [link("l1", "Steam", "https://same.com")],
      [entry("b1", "NetEase", "https://same.com")],
      {},
      options,
    );

    expect(plan.create).toHaveLength(1);
    expect(plan.update).toHaveLength(0);
  });

  it("should pick the earliest bookmark when names repeat", () => {
    const plan = planSync(
      [link("l1", "Steam", "https://new.com")],
      [entry("b2", "Steam", "https://a.com", 1), entry("b1", "Steam", "https://a.com", 0)],
      {},
      options,
    );

    expect(plan.update[0].bookmarkId).toBe("b1");
  });

  describe("removal", () => {
    const ledger: Ledger = {
      gone: { bookmarkId: "b2", url: "https://gone.com" },
    };

    it("should queue a bookmark whose link is gone", () => {
      const plan = planSync([], [entry("b2", "Gone")], ledger, options);
      expect(plan.remove).toEqual(["b2"]);
    });

    it("should never queue a bookmark it did not create", () => {
      // The user may have filed something of their own in the folder; that is
      // not ours to delete.
      const plan = planSync([], [entry("user", "手动的书签")], ledger, options);
      expect(plan.remove).toEqual([]);
    });

    it("should not queue a bookmark that still has a link", () => {
      const plan = planSync(
        [link("l1", "Gone")],
        [entry("b2", "Gone")],
        ledger,
        options,
      );
      expect(plan.remove).toEqual([]);
    });
  });

  describe("first attach", () => {
    it("should take the folder's own order as the links", () => {
      const plan = planSync(
        [],
        [entry("b2", "第二", "https://b.com", 1), entry("b1", "第一", "https://a.com", 0)],
        {},
        { taking: true, capacity: 24 },
      );

      expect(plan.takeOn.map((item) => item.title)).toEqual(["第一", "第二"]);
      expect(plan.create).toHaveLength(0);
    });

    it("should stop at the number of free slots", () => {
      const entries = Array.from({ length: 5 }, (_, i) =>
        entry(`b${i}`, `第${i}个`, "https://a.com", i),
      );

      const plan = planSync([], entries, {}, { taking: true, capacity: 2 });
      expect(plan.takeOn).toHaveLength(2);
    });

    it("should not queue removals while taking on", () => {
      const plan = planSync([], [entry("b1", "第一")], {}, {
        taking: true,
        capacity: 24,
      });
      expect(plan.remove).toEqual([]);
    });
  });

  it("should survive an empty world", () => {
    expect(planIsEmpty(planSync([], [], {}, options))).toBe(true);
  });
});
