import {
  COLUMN_OPTIONS,
  DEFAULT_GRID,
  MAX_COLUMNS,
  MAX_ROWS,
  MIN_COLUMNS,
  MIN_ROWS,
  ROW_OPTIONS,
  clampLinksGrid,
  gridCapacity,
} from "./linksGrid";

describe("db/linksGrid", () => {
  describe("defaults and options", () => {
    it("should default to six across and four down", () => {
      expect(DEFAULT_GRID).toEqual({ rows: 4, columns: 6 });
      expect(gridCapacity(DEFAULT_GRID)).toBe(24);
    });

    it("should offer every count inside the range", () => {
      expect(ROW_OPTIONS).toEqual([1, 2, 3, 4, 5, 6]);
      expect(COLUMN_OPTIONS).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
      ]);
      expect(ROW_OPTIONS[0]).toBe(MIN_ROWS);
      expect(ROW_OPTIONS[ROW_OPTIONS.length - 1]).toBe(MAX_ROWS);
      expect(COLUMN_OPTIONS[COLUMN_OPTIONS.length - 1]).toBe(MAX_COLUMNS);
    });
  });

  describe("clampLinksGrid()", () => {
    it("should pass a valid grid through", () => {
      expect(clampLinksGrid({ rows: 2, columns: 8 })).toEqual({
        rows: 2,
        columns: 8,
      });
    });

    it("should fall back for a missing grid", () => {
      // Nothing stored yet, which is the case for every existing profile.
      expect(clampLinksGrid(undefined)).toEqual(DEFAULT_GRID);
      expect(clampLinksGrid(null)).toEqual(DEFAULT_GRID);
      expect(clampLinksGrid({})).toEqual(DEFAULT_GRID);
    });

    it("should keep values inside the supported range", () => {
      expect(clampLinksGrid({ rows: 0, columns: 0 })).toEqual({
        rows: MIN_ROWS,
        columns: MIN_COLUMNS,
      });
      expect(clampLinksGrid({ rows: 99, columns: 99 })).toEqual({
        rows: MAX_ROWS,
        columns: MAX_COLUMNS,
      });
    });

    it("should discard values that are not usable numbers", () => {
      expect(clampLinksGrid({ rows: NaN, columns: NaN })).toEqual(DEFAULT_GRID);
      expect(clampLinksGrid({ rows: 2.9, columns: 3.9 })).toEqual({
        rows: 2,
        columns: 3,
      });
    });

    it("should fill in only the broken half", () => {
      expect(clampLinksGrid({ columns: 2 })).toEqual({
        rows: DEFAULT_GRID.rows,
        columns: 2,
      });
    });
  });
});
