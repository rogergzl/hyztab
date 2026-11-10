import {
  claimGesture,
  ownsGesture,
  releaseGesture,
} from "./gestureLock";

describe("links/gestureLock", () => {
  afterEach(() => releaseGesture());

  it("should let a page drag start when the grid is free", () => {
    expect(claimGesture("paging")).toBe(true);
    expect(ownsGesture("paging")).toBe(true);
  });

  it("should refuse a second page drag", () => {
    claimGesture("paging");
    expect(claimGesture("paging")).toBe(true); // Same owner is fine.
    releaseGesture("paging");
    expect(claimGesture("slot")).toBe(true);
    expect(claimGesture("paging")).toBe(false);
  });

  it("should let a tile drag take over from a page drag", () => {
    // The page drag claims on the first pixel, the tile drag only after a
    // long press, so the later one has to win.
    claimGesture("paging");
    expect(claimGesture("slot")).toBe(true);
    expect(ownsGesture("paging")).toBe(false);
    expect(ownsGesture("slot")).toBe(true);
  });

  it("should hand the grid back when the gesture ends", () => {
    claimGesture("slot");
    releaseGesture("slot");
    expect(ownsGesture("paging")).toBe(false);
    expect(claimGesture("paging")).toBe(true);
  });

  it("should ignore a release from a gesture that does not own it", () => {
    // A stale cleanup must not free the grid mid gesture.
    claimGesture("slot");
    releaseGesture("paging");
    expect(ownsGesture("slot")).toBe(true);
  });
});
