import { nearestCell, slotCells, trackSizes } from "./layout";

/**
 * A page of the frame's size holding six centred columns of 84 with an 8 gap:
 * 6*84 + 5*8 = 544 wide, so 358 is left over on each side of 1260. Two rows of
 * 84 with an 8 gap are 176 tall, so 164 is left over above and below 504.
 */
const page = { left: 0, top: 0, width: 1260, height: 504 };
const columns = [84, 84, 84, 84, 84, 84];
const rows = [84, 84];

describe("links/layout slotCells()", () => {
  it("should number every cell, left to right then row by row", () => {
    const cells = slotCells(page, columns, rows, 8, 8, 0);

    expect(cells).toHaveLength(12);
    expect(cells.map((cell) => cell.index)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);

    // Centres of the first and last cell.
    expect(cells[0].x).toBeCloseTo(358 + 42, 3);
    expect(cells[0].y).toBeCloseTo(164 + 42, 3);
    expect(cells[11].x).toBeCloseTo(358 + 5 * 92 + 42, 3);
    expect(cells[11].y).toBeCloseTo(164 + 92 + 42, 3);
  });

  it("should offset the numbering by where the page starts", () => {
    // Page two of a 6x2 grid begins at slot 12.
    const cells = slotCells(page, columns, rows, 8, 8, 12);

    expect(cells[0].index).toBe(12);
    expect(cells[11].index).toBe(23);
  });

  it("should use each track's own size rather than an average", () => {
    const cells = slotCells(page, [40, 120], [50], 0, 0, 0);

    // The grid is 160 wide, centred: 550 to 710.
    expect(cells[0].x).toBeCloseTo(550 + 20, 3);
    expect(cells[1].x).toBeCloseTo(590 + 60, 3);
  });

  it("should have nothing to say without tracks", () => {
    expect(slotCells(page, [], rows, 8, 8, 0)).toEqual([]);
    expect(slotCells(page, columns, [], 8, 8, 0)).toEqual([]);
  });
});

describe("links/layout nearestCell()", () => {
  const cells = slotCells(page, columns, rows, 8, 8, 0);

  it("should report the cell a point sits on", () => {
    expect(nearestCell(cells, 400, 206)?.index).toBe(0);
    expect(nearestCell(cells, 860, 206)?.index).toBe(5);
    expect(nearestCell(cells, 400, 298)?.index).toBe(6);
    expect(nearestCell(cells, 860, 298)?.index).toBe(11);
  });

  it("should follow the margin the grid is centred in", () => {
    // 400 is the first column's centre. Spreading the columns across the whole
    // frame instead (1260 / 6 = 210) would put this point in column two, which
    // is the error that made the right hand slots unreachable.
    expect(nearestCell(cells, 400, 206)?.index).toBe(0);
    expect(nearestCell(cells, 210, 206)?.index).toBe(0);
  });

  it("should pick the nearest cell rather than the one after a boundary", () => {
    // Centre of column 0 is 400, of column 1 is 492; the midpoint is 446.
    expect(nearestCell(cells, 445, 206)?.index).toBe(0);
    expect(nearestCell(cells, 447, 206)?.index).toBe(1);
  });

  it("should clamp a point dragged outside the grid", () => {
    expect(nearestCell(cells, -9999, -9999)?.index).toBe(0);
    expect(nearestCell(cells, 9999, 9999)?.index).toBe(11);
    // Far right but level with the first row: the last column of that row.
    expect(nearestCell(cells, 9999, 206)?.index).toBe(5);
  });

  it("should have no answer for an empty grid", () => {
    expect(nearestCell([], 0, 0)).toBeNull();
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
