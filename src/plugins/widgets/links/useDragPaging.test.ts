import { resolveRelease } from "./useDragPaging";

/** The rail position React renders for a page and an extra drag offset. */
const railPosition = (page: number, hold: number, width: number): number =>
  -page * width + hold;

const WIDTH = 480;

describe("links/useDragPaging resolveRelease()", () => {
  it("should hold the view steady when a drag turns a page", () => {
    // A long pull left lands on the next page, and the returned offset must
    // leave the rail exactly where the finger let go.
    for (const offset of [-WIDTH * 0.3, -WIDTH, -WIDTH * 1.7]) {
      const settled = resolveRelease(0, offset, WIDTH);
      expect(settled.page).toBe(1);
      expect(railPosition(0, offset, WIDTH)).toBeCloseTo(
        railPosition(settled.page, settled.hold, WIDTH),
      );
    }
  });

  it("should hold the view steady when the drag does not turn a page", () => {
    // Below the threshold the page stays put and the offset is unchanged, so
    // the rail simply springs back from where it was released.
    const offset = -WIDTH * 0.05;
    const settled = resolveRelease(2, offset, WIDTH);

    expect(settled.page).toBe(2);
    expect(settled.hold).toBe(offset);
  });

  it("should turn forwards on a leftward drag and back on a rightward one", () => {
    expect(resolveRelease(1, -WIDTH * 0.5, WIDTH).page).toBe(2);
    expect(resolveRelease(1, WIDTH * 0.5, WIDTH).page).toBe(0);
  });

  it("should always land with the hold offset inside one page", () => {
    // The settle animation only ever travels the remainder of a page, never
    // more than one, so a release can never skip a page.
    for (const offset of [-WIDTH * 1.9, -WIDTH * 0.5, WIDTH * 0.5, WIDTH * 1.9]) {
      const settled = resolveRelease(3, offset, WIDTH);
      expect(Math.abs(settled.hold)).toBeLessThanOrEqual(WIDTH);
    }
  });

  it("should ignore a release with no measured width", () => {
    // A zero width would otherwise divide the threshold into nonsense.
    expect(resolveRelease(0, 0, 0).page).toBe(0);
    expect(resolveRelease(0, 0, 0).hold).toBe(0);
  });
});
