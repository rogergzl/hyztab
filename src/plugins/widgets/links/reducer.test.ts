import {
  addLink,
  addLinks,
  insertLink,
  removeLink,
  updateLink,
  reorderLink,
} from "./actions";
import { reducer } from "./reducer";

describe("links/reducer()", () => {
  it("should add new links", () => {
    expect(reducer([], addLink())).toEqual([{}]);
    expect(reducer([{ url: "https://aphqsia.com/" }], addLink())).toEqual([
      { url: "https://aphqsia.com/" },
      {},
    ]);
  });

  it("should add a whole page of empty slots", () => {
    // Growing a page at a time is what makes a second page reachable from a
    // full first page.
    const full = Array.from({ length: 24 }, () => ({}));
    const grown = reducer(full, addLinks(24));

    expect(grown).toHaveLength(48);
    expect(grown[24]).toEqual({});
    expect(grown[47]).toEqual({});
  });

  it("should ignore a silly count", () => {
    const state = [{ url: "https://a.com" }];
    expect(reducer(state, addLinks(0))).toEqual(state);
    expect(reducer(state, addLinks(-5))).toEqual(state);
  });

  it("should add links with data", () => {
    expect(
      reducer([], addLink({ url: "https://aphqsia.com", name: "Tabliss" })),
    ).toEqual([{ url: "https://aphqsia.com", name: "Tabliss" }]);
  });

  it("should insert into a slot that already exists", () => {
    expect(
      reducer(
        [{ url: "https://aphqsia.com/" }, { url: "https://aphqsia.com/about" }],
        insertLink(1, { url: "https://aphqsia.com/support" }),
      ),
    ).toEqual([
      { url: "https://aphqsia.com/" },
      { url: "https://aphqsia.com/support" },
      { url: "https://aphqsia.com/about" },
    ]);
  });

  it("should pad empty slots when filling a later cell", () => {
    // Clicking the third cell of an almost empty grid must leave the two
    // cells before it present and empty, not silently append at the end.
    expect(reducer([], insertLink(2, { url: "https://a.com" }))).toEqual([
      {},
      {},
      { url: "https://a.com" },
    ]);
  });

  it("should append when the slot is the next free one", () => {
    expect(reducer([{ url: "https://a.com" }], insertLink(1))).toEqual([
      { url: "https://a.com" },
      {},
    ]);
  });

  it("should empty a slot rather than closing the gap", () => {
    // The list is the grid: removing must not shift later links one cell left.
    expect(
      reducer(
        [
          { url: "https://aphqsia.com/" },
          { url: "https://aphqsia.com/about.html" },
          { url: "https://aphqsia.com/support.html" },
        ],
        removeLink(1),
      ),
    ).toEqual([
      { url: "https://aphqsia.com/" },
      {},
      { url: "https://aphqsia.com/support.html" },
    ]);
  });

  it("should update links", () => {
    expect(
      reducer(
        [
          { url: "https://aphqsia.com/" },
          { url: "https://aphqsia.com/about.html" },
        ],
        updateLink(0, { name: "Tabliss", url: "https://aphqsia.com/" }),
      ),
    ).toEqual([
      { name: "Tabliss", url: "https://aphqsia.com/" },
      { url: "https://aphqsia.com/about.html" },
    ]);
  });

  it("should reorder links", () => {
    expect(
      reducer(
        [
          { url: "https://aphqsia.com/" },
          { url: "https://aphqsia.com/about.html" },
          { url: "https://aphqsia.com/support.html" },
        ],
        reorderLink(1, 0),
      ),
    ).toEqual([
      { url: "https://aphqsia.com/about.html" },
      { url: "https://aphqsia.com/" },
      { url: "https://aphqsia.com/support.html" },
    ]);

    expect(
      reducer(
        [
          { url: "https://aphqsia.com/" },
          { url: "https://aphqsia.com/about.html" },
          { url: "https://aphqsia.com/support.html" },
        ],
        reorderLink(1, 2),
      ),
    ).toEqual([
      { url: "https://aphqsia.com/" },
      { url: "https://aphqsia.com/support.html" },
      { url: "https://aphqsia.com/about.html" },
    ]);
  });

  it("should throw on unknown action", () => {
    expect(() => reducer([], { type: "UNKNOWN" } as any)).toThrow();
  });
});
