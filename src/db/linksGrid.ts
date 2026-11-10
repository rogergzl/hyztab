/**
 * Shared grid size for the quick links widget.
 *
 * This lives in the store rather than in each widget's data because every
 * links widget on the page shares one grid: changing it here changes them all.
 * It is the single authority for the shape and validity of that setting.
 */

export type LinksGrid = {
  rows: number;
  columns: number;
};

export const MIN_ROWS = 1;
export const MAX_ROWS = 6;

export const MIN_COLUMNS = 1;
/**
 * The grid keeps square cells inside a fixed frame, so a wide frame fits many
 * columns: at the default row count the frame holds about fourteen before the
 * cells have to shrink, and sixteen stays comfortable.
 */
export const MAX_COLUMNS = 16;

/** Six across and four down, so a page holds twenty four slots. */
export const DEFAULT_GRID: LinksGrid = { rows: 4, columns: 6 };

/** Clamp one value into range, falling back when it is unusable. */
const clamp = (
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number => {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
};

/**
 * Normalise a stored grid.
 *
 * Anything missing or out of range falls back to the default, so a stale or
 * hand edited value can never leave the widget without a usable size.
 */
export const clampLinksGrid = (
  grid?: Partial<LinksGrid> | null,
): LinksGrid => ({
  rows: clamp(grid?.rows, MIN_ROWS, MAX_ROWS, DEFAULT_GRID.rows),
  columns: clamp(grid?.columns, MIN_COLUMNS, MAX_COLUMNS, DEFAULT_GRID.columns),
});

/** How many links fit on one page. */
export const gridCapacity = (grid: LinksGrid): number =>
  grid.rows * grid.columns;

/** The row counts offered in the sidebar. */
export const ROW_OPTIONS = Array.from(
  { length: MAX_ROWS - MIN_ROWS + 1 },
  (_, index) => MIN_ROWS + index,
);

/** The column counts offered in the sidebar. */
export const COLUMN_OPTIONS = Array.from(
  { length: MAX_COLUMNS - MIN_COLUMNS + 1 },
  (_, index) => MIN_COLUMNS + index,
);
