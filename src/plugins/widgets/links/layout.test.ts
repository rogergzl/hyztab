import { DEFAULT_GRID, MAX_COLUMNS } from "../../../db/linksGrid";
import {
  CELL_GAP,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  clampPage,
  gridMetrics,
  pageCount,
  pageIndices,
  pageOfIndex,
  perPage,
  slotPlacement,
} from "./layout";

const em = (value: string): number => Number(value.replace("em", ""));

describe("links/layout", () => {
  describe("perPage()", () => {
    it("should multiply the columns by the rows", () => {
      // Six across, four down.
      expect(perPage({ rows: 4, columns: 6 })).toBe(24);
      expect(perPage(DEFAULT_GRID)).toBe(24);
      expect(perPage({ rows: 1, columns: 1 })).toBe(1);
      expect(perPage({ rows: 2, columns: 8 })).toBe(16);
    });
  });

  describe("pageCount()", () => {
    it("should round up to whole pages", () => {
      expect(pageCount(24, 24)).toBe(1);
      expect(pageCount(25, 24)).toBe(2);
      expect(pageCount(48, 24)).toBe(2);
      expect(pageCount(49, 24)).toBe(3);
    });

    it("should always report at least one page", () => {
      // An empty widget still renders a grid of slots, so there is a page.
      expect(pageCount(0, 24)).toBe(1);
    });

    it("should refuse to divide by a zero size", () => {
      expect(pageCount(5, 0)).toBe(5);
    });
  });

  describe("clampPage()", () => {
    it("should keep the page inside the available range", () => {
      expect(clampPage(0, 3)).toBe(0);
      expect(clampPage(2, 3)).toBe(2);
      expect(clampPage(5, 3)).toBe(2);
      expect(clampPage(-2, 3)).toBe(0);
    });

    it("should survive a page count that has shrunk to one", () => {
      expect(clampPage(4, 1)).toBe(0);
    });

    it("should treat an unusable page as the first one", () => {
      expect(clampPage(NaN, 3)).toBe(0);
      expect(clampPage(1.7, 3)).toBe(1);
    });
  });

  describe("pageIndices()", () => {
    it("should list every slot of the page, filled or not", () => {
      // All twenty four cells are addressable, which is what lets an empty one
      // be filled in place.
      const first = pageIndices(0, 24);
      expect(first).toHaveLength(24);
      expect(first[0]).toBe(0);
      expect(first[23]).toBe(23);
    });

    it("should count straight on for later pages", () => {
      expect(pageIndices(1, 24)[0]).toBe(24);
      expect(pageIndices(2, 4)).toEqual([8, 9, 10, 11]);
    });

    it("should have exactly as many entries as the page holds", () => {
      expect(pageIndices(0, 24)).toHaveLength(24);
      expect(pageIndices(0, 1)).toHaveLength(1);
    });
  });

  describe("pageOfIndex()", () => {
    it("should report the page a slot lands on", () => {
      expect(pageOfIndex(0, 24)).toBe(0);
      expect(pageOfIndex(23, 24)).toBe(0);
      expect(pageOfIndex(24, 24)).toBe(1);
      expect(pageOfIndex(48, 24)).toBe(2);
    });
  });

  describe("slotPlacement()", () => {
    const grid = { rows: 3, columns: 4 };

    it("should turn the popup down for a tile on the first row", () => {
      // Nothing above the top row but the frame edge, which would clip it.
      expect(slotPlacement(0, grid)).toEqual({ below: true, align: "start" });
      expect(slotPlacement(1, grid)).toEqual({ below: true, align: "centre" });
      expect(slotPlacement(3, grid)).toEqual({ below: true, align: "end" });
    });

    it("should keep the popup above for later rows", () => {
      expect(slotPlacement(4, grid).below).toBe(false);
      expect(slotPlacement(11, grid).below).toBe(false);
    });

    it("should line the popup up with the edges of the frame", () => {
      // Middle column tiles stay centred, edge ones hug their edge.
      expect(slotPlacement(4, grid).align).toBe("start");
      expect(slotPlacement(5, grid).align).toBe("centre");
      expect(slotPlacement(7, grid).align).toBe("end");
    });

    it("should centre everything in a single column", () => {
      // One column touches both edges, so either choice would overflow.
      expect(slotPlacement(0, { rows: 3, columns: 1 })).toEqual({
        below: true,
        align: "centre",
      });
      expect(slotPlacement(2, { rows: 3, columns: 1 }).align).toBe("centre");
    });

    it("should work out the position within the page, not the whole list", () => {
      // Slot 4 of page 2 still sits at the start of its first row.
      const size = grid.rows * grid.columns;
      const onSecondPage = size + 0;

      expect(slotPlacement(onSecondPage, grid)).toEqual({
        below: true,
        align: "start",
      });
      expect(slotPlacement(size + 7, grid)).toEqual({
        below: false,
        align: "end",
      });
    });

    it("should survive a silly grid", () => {
      expect(slotPlacement(5, { rows: 0, columns: 0 })).toEqual({
        below: true,
        align: "centre",
      });
      expect(slotPlacement(-2, grid).align).toBe("start");
    });
  });

  describe("gridMetrics()", () => {
    it("should fill the frame exactly when the height is what limits it", () => {
      // With few enough columns that the width is not the constraint, the
      // rows divide the frame's height exactly. The tolerance allows for the
      // rounding of the value written into the style attribute, which is
      // multiplied by the row count.
      for (const rows of [3, 4, 6]) {
        const { cell } = gridMetrics(rows, 4);
        expect(rows * em(cell) + (rows - 1) * CELL_GAP).toBeCloseTo(
          FRAME_HEIGHT,
          4,
        );
      }
    });

    it("should shrink the cells as the rows grow", () => {
      // Four rows of a six by four grid are five em tall.
      expect(gridMetrics(4, 6).cell).toBe("5em");
      expect(em(gridMetrics(6, 6).cell)).toBeLessThan(
        em(gridMetrics(4, 6).cell),
      );
      expect(em(gridMetrics(2, 6).cell)).toBeGreaterThan(
        em(gridMetrics(4, 6).cell),
      );
    });

    it("should let a wide frame hold many columns", () => {
      // The frame is wide, so the row count, not the column count, sets the
      // cell size until the columns genuinely run out of room.
      for (const columns of [8, 12, 14])
        expect(gridMetrics(6, columns).cell).toBe(gridMetrics(6, 6).cell);

      // Past that the cells give way so the grid still fits the frame.
      expect(em(gridMetrics(6, MAX_COLUMNS).cell)).toBeLessThan(
        em(gridMetrics(6, 6).cell),
      );
    });

    it("should never let the grid spill out of the frame", () => {
      for (const rows of [1, 3, 6]) {
        for (const columns of [1, 6, 12, MAX_COLUMNS]) {
          const { cell } = gridMetrics(rows, columns);
          expect(columns * em(cell) + (columns - 1) * CELL_GAP).toBeLessThanOrEqual(
            FRAME_WIDTH + 0.001,
          );
          expect(rows * em(cell) + (rows - 1) * CELL_GAP).toBeLessThanOrEqual(
            FRAME_HEIGHT + 0.001,
          );
        }
      }
    });

    it("should leave a margin around the contents of a cell", () => {
      // The contents must never fill the cell edge to edge, otherwise an icon
      // and a label are pressed against the tile border.
      for (const rows of [1, 4, 6]) {
        const { cell, content } = gridMetrics(rows, 6);
        expect(em(content) * 4.66).toBeLessThan(em(cell) * 0.9);
        expect(em(content) * 4.66).toBeCloseTo(em(cell) * 0.8, 2);
      }
    });

    it("should report the frame size it computed the cells for", () => {
      const metrics = gridMetrics(4, 6);
      expect(metrics.frameWidth).toBe(`${FRAME_WIDTH}em`);
      expect(metrics.frameHeight).toBe(`${FRAME_HEIGHT}em`);
    });

    it("should survive a silly grid", () => {
      expect(gridMetrics(0, 0).cell).toBe(
        `${Math.min(FRAME_HEIGHT, FRAME_WIDTH)}em`,
      );
      expect(em(gridMetrics(-3, -3).cell)).toBeGreaterThan(0);
      expect(em(gridMetrics(1.9, 2.9).cell)).toBeGreaterThan(0);
    });
  });
});
