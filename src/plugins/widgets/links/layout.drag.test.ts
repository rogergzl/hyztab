import {
  centeredGridBox,
  nearestSlot,
  trackSizes,
} from "./layout";

/** A four column, three row page of 100 by 60 cells at (10, 20). */
const box = { left: 10, top: 20, width: 400, height: 180 };

describe("links/layout nearestSlot()", () => {
  it("should report the cell a point sits in", () => {
    // Centre of the first cell.
    expect(nearestSlot({ x: 60, y: 50 }, box, 4, 3)).toBe(0);
    // Centre of the last cell of the first row.
    expect(nearestSlot({ x: 360, y: 50 }, box, 4, 3)).toBe(3);
    // First cell of the second row.
    expect(nearestSlot({ x: 60, y: 110 }, box, 4, 3)).toBe(4);
    // Last cell of the last row.
    expect(nearestSlot({ x: 360, y: 170 }, box, 4, 3)).toBe(11);
  });

  it("should pick the nearest cell, not the one after the boundary", () => {
    // Just inside the left edge of the second cell.
    expect(nearestSlot({ x: 111, y: 50 }, box, 4, 3)).toBe(1);
    // Just inside the right edge of the first cell.
    expect(nearestSlot({ x: 109, y: 50 }, box, 4, 3)).toBe(0);
  });

  it("should clamp a point dragged outside the grid", () => {
    expect(nearestSlot({ x: -500, y: -500 }, box, 4, 3)).toBe(0);
    expect(nearestSlot({ x: 9999, y: 9999 }, box, 4, 3)).toBe(11);
    // To the right of the first row: the last column of that row.
    expect(nearestSlot({ x: 9999, y: 50 }, box, 4, 3)).toBe(3);
  });

  it("should follow the grid it is given", () => {
    expect(nearestSlot({ x: 60, y: 50 }, box, 2, 2)).toBe(0);
    expect(nearestSlot({ x: 360, y: 50 }, box, 2, 2)).toBe(1);
    expect(nearestSlot({ x: 60, y: 170 }, box, 2, 2)).toBe(2);
  });

  it("should survive a silly grid", () => {
    expect(nearestSlot({ x: 60, y: 50 }, box, 0, 0)).toBe(0);
    expect(nearestSlot({ x: 60, y: 50 }, { ...box, width: 0, height: 0 }, 4, 3)).toBe(0);
  });

  it("should map the tiles' area, not the frame around it", () => {
    // A real case: the frame is 1260 wide and holds eight columns of 84px that
    // are centred, so 294px of the frame is empty on each side. Measuring the
    // frame spreads the columns over that space and puts every drop about two
    // cells to the right, which is exactly what this guards against.
    const frame = { left: 0, top: 0, width: 1260, height: 504 };
    const tiles = { left: 294, top: 18, width: 672, height: 468 };

    // The centre of the third column: 294 + two columns + half a column.
    const point = { x: 294 + 2 * 84 + 42, y: 18 + 42 };

    expect(nearestSlot(point, tiles, 8, 6)).toBe(2);
    expect(nearestSlot(point, frame, 8, 6)).not.toBe(2);
  });
});

describe("links/layout centeredGridBox()", () => {
  // A page of the frame's size holding four centred columns of 72 with a 7 gap:
  // 4*72 + 3*7 = 309 wide, so 475.5 is left over on each side of 1260.
  const page = { left: 0, top: 0, width: 1260, height: 502 };
  const columns = [72, 72, 72, 72];
  const rows = [72, 72];

  it("should place a centred grid inside its page", () => {
    const box = centeredGridBox(page, columns, rows, 7, 7)!;

    expect(box.width).toBe(309);
    expect(box.height).toBe(151);
    expect(box.left).toBeCloseTo(475.5, 3);
    expect(box.top).toBeCloseTo(175.5, 3);
  });

  it("should describe the whole grid even when few slots are filled", () => {
    // The page always holds a cell per slot, so the track list is the grid
    // whatever the links look like. Measuring only the filled cells would give
    // a narrower box and map the right hand columns too far left.
    const box = centeredGridBox(page, columns, rows, 7, 7)!;
    const centreOfLastColumn = box.left + 3 * 79 + 36;

    expect(nearestSlot({ x: centreOfLastColumn, y: box.top + 36 }, box, 4, 2)).toBe(3);
  });

  it("should have nothing to say without tracks", () => {
    expect(centeredGridBox(page, [], rows, 7, 7)).toBeNull();
    expect(centeredGridBox(page, columns, [], 7, 7)).toBeNull();
  });
});

describe("links/layout trackSizes()", () => {
  it("should read a resolved track list", () => {
    expect(trackSizes("72px 72px 72px")).toEqual([72, 72, 72]);
  });

  it("should cope with the values a browser may return instead", () => {
    expect(trackSizes("")).toEqual([]);
    expect(trackSizes("none")).toEqual([]);
  });
});
