import type { LinksGrid } from "../../../db/linksGrid";
import type { LinkPlacement } from "./types";

/**
 * Layout maths for the links widget.
 *
 * The grid size itself lives in the store, so these are pure functions over a
 * grid and a link list: how a page is sliced, and which slots it shows. Nothing
 * here touches the DOM or the store.
 */

/** How many links fit on a single page. */
export const perPage = (grid: LinksGrid): number => grid.rows * grid.columns;

/** Total number of pages, never less than one so the frame stays stable. */
export const pageCount = (total: number, size: number): number =>
  Math.max(1, Math.ceil(total / Math.max(1, size)));

/** Keep a page index inside the valid range. */
export const clampPage = (page: number, pages: number): number =>
  Math.min(Math.max(0, Math.floor(page) || 0), Math.max(0, pages - 1));

/** The page a link at `index` lands on, used when jumping to a fresh link. */
export const pageOfIndex = (index: number, size: number): number =>
  Math.floor(Math.max(0, index) / Math.max(1, size));

/**
 * The area the cells occupy inside a page, from the browser's own resolved
 * track sizes.
 *
 * Measuring the cells themselves is not enough: a page that is not completely
 * filled has fewer cells than the grid has slots, so their bounding box is
 * smaller than the grid and every position maps skewed. The resolved track
 * list always describes the whole grid, however much of it is filled.
 *
 * Tracks are centred inside the page (`justify-content`/`align-content`), so
 * the grid is offset by half of what is left over.
 */
export const centeredGridBox = (
  page: GridBox,
  columnTracks: number[],
  rowTracks: number[],
  columnGap: number,
  rowGap: number,
): GridBox | null => {
  if (columnTracks.length === 0 || rowTracks.length === 0) return null;

  const span = (tracks: number[], gap: number) =>
    tracks.reduce((total, size) => total + size, 0) +
    gap * (tracks.length - 1);

  const width = span(columnTracks, columnGap);
  const height = span(rowTracks, rowGap);

  return {
    left: page.left + (page.width - width) / 2,
    top: page.top + (page.height - height) / 2,
    width,
    height,
  };
};

/** Read the sizes out of a resolved `grid-template-*` list. */
export const trackSizes = (value: string): number[] =>
  value
    .split(" ")
    .map((part) => Number.parseFloat(part))
    .filter((size) => Number.isFinite(size) && size > 0);

/** The box a page of cells occupies, in viewport coordinates. */
export type GridBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * The slot a point falls nearest to.
 *
 * Equal cells tile the page, so the cell containing the point is also the
 * nearest one. Points outside the box clamp to the edge cell, which is what
 * makes a tile dragged past the grid land in the last row or column rather
 * than nowhere.
 */
export const nearestSlot = (
  point: { x: number; y: number },
  box: GridBox,
  columns: number,
  rows: number,
): number => {
  const across = Math.max(1, Math.floor(columns) || 1);
  const down = Math.max(1, Math.floor(rows) || 1);

  /**
   * Which line a coordinate falls on.
   *
   * A box with no size has no geometry to work from; the first cell is the
   * safe answer, whereas dividing by it would report the last one.
   */
  const line = (offset: number, size: number, count: number): number => {
    if (!(size > 0)) return 0;

    const raw = Math.floor(offset / size);
    return Number.isFinite(raw) ? Math.min(count - 1, Math.max(0, raw)) : 0;
  };

  const column = line(point.x - box.left, box.width / across, across);
  const row = line(point.y - box.top, box.height / down, down);

  return row * across + column;
};

/** The absolute slot indices shown on a page, including cells that hold no link
 * yet. Every cell of the grid is addressable, so an empty one can be filled in
 * place rather than only ever appending at the end.
 */
export const pageIndices = (page: number, size: number): number[] =>
  Array.from({ length: size }, (_, offset) => page * size + offset);

/**
 * Where a slot sits on its page.
 *
 * The hover popup is drawn inside the frame the pages slide within, so a tile
 * on the top row has to turn it downwards, and a tile against a side edge has
 * to line it up with that edge instead of centring and overflowing.
 */
export const slotPlacement = (
  index: number,
  grid: LinksGrid,
): LinkPlacement => {
  const columns = Math.max(1, grid.columns);
  const position = Math.max(0, index) % (Math.max(1, grid.rows) * columns);
  const column = position % columns;
  const row = Math.floor(position / columns);

  const align: LinkPlacement["align"] =
    column === 0 ? "start" : column === columns - 1 ? "end" : "centre";

  return {
    below: row === 0,
    // A single column touches both edges, so centring is the only sane choice.
    align: columns === 1 ? "centre" : align,
  };
};

/** The frame, in em, which the grid is laid out inside. */
export const FRAME_WIDTH = 52.5;
export const FRAME_HEIGHT = 20.9;
/** Gap between cells, in em. */
export const CELL_GAP = 0.3;
/** Height of a filled cell's contents, as a multiple of the cell font size. */
const CONTENT_HEIGHT = 4.66;
/** Share of a cell the contents may fill, leaving a margin on every side. */
const CONTENT_FILL = 0.8;

// Enough decimals that rounding cannot visibly shorten the grid, since the
// error is multiplied by the row count.
const round = (value: number): number =>
  Math.round(value * 100000) / 100000;

export type GridMetrics = {
  /** Frame width, as a css length. */
  frameWidth: string;
  /** Frame height, as a css length. */
  frameHeight: string;
  /** Edge length of a square cell, as a css length. */
  cell: string;
  /** Font size the cell's contents are drawn at, as a css length. */
  content: string;
};

/**
 * Square cell size, the frame size, and the font size cell contents use.
 *
 * The frame stays a fixed size, so the grid has to fit inside it. Cells are
 * square, which means their edge is whichever is smaller: what the rows allow
 * across the frame's height, or what the columns allow across its width.
 * Contents are sized from the cell rather than from the widget, so an icon and
 * a label always fit inside their cell with a margin all round, whatever the
 * rows and columns are set to.
 */
export const gridMetrics = (rows: number, columns: number): GridMetrics => {
  const rowCount = Math.max(1, Math.floor(rows) || 1);
  const columnCount = Math.max(1, Math.floor(columns) || 1);

  const fromHeight = (FRAME_HEIGHT - (rowCount - 1) * CELL_GAP) / rowCount;
  const fromWidth = (FRAME_WIDTH - (columnCount - 1) * CELL_GAP) / columnCount;
  const cell = Math.min(fromHeight, fromWidth);

  return {
    frameWidth: `${FRAME_WIDTH}em`,
    frameHeight: `${FRAME_HEIGHT}em`,
    cell: `${round(cell)}em`,
    content: `${round((CONTENT_FILL * cell) / CONTENT_HEIGHT)}em`,
  };
};
