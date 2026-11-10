import { RefObject, useEffect, useRef } from "react";

import { claimGesture, ownsGesture, releaseGesture } from "./gestureLock";
import { centeredGridBox, nearestSlot, trackSizes } from "./layout";

/** How long a press has to last before it picks a tile up. */
const LONG_PRESS = 380;
/** Movement before the long press lands abandons it in favour of the gesture
 *  the browser was already tracking (a page swipe, a scroll). */
const SLOP = 8;

type Options = {
  /** The clipped area holding the pages. */
  viewport: RefObject<HTMLElement | null>;
  enabled: boolean;
  columns: number;
  rows: number;
  /** Move a link from one slot to another. */
  onMove: (from: number, to: number) => void;
};

/**
 * Pick a tile up with a long press and drop it onto another cell.
 *
 * Everything during the gesture is written straight to the DOM through a CSS
 * variable and a class, so React re-renders nothing while a tile is moving.
 * React is only told once, at the end, which slot it landed in.
 */
export const useLinkDrag = ({
  columns,
  enabled,
  onMove,
  rows,
  viewport,
}: Options): void => {
  // Read through refs so the listeners never need re-binding mid gesture.
  const latest = useRef({ columns, onMove, rows });
  latest.current = { columns, onMove, rows };

  useEffect(() => {
    const area = viewport.current;
    if (!area || !enabled) return;

    let source: HTMLElement | null = null;
    let page: HTMLElement | null = null;
    let target: HTMLElement | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pointerId = -1;
    let start = { x: 0, y: 0 };
    // Where the tile's centre sat when it was picked up. Every offset is
    // measured against this, which is what puts the tile under the pointer
    // rather than at a distance from it.
    let anchor = { x: 0, y: 0 };
    let lifted = false;
    let abandoned = false;
    let landing = -1;
    // Set when a press ends in a drop, so the click it would otherwise fire is
    // swallowed instead of opening the link.
    let swallowClick = false;

    const clearTimer = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };

    const clearTarget = () => {
      if (target) target.classList.remove("is-dropTarget");
      target = null;
    };

    const drop = () => {
      if (source) {
        source.classList.remove("is-dragging");
        source.style.removeProperty("--drag-x");
        source.style.removeProperty("--drag-y");
      }
      clearTarget();
      source = null;
      page = null;
      pointerId = -1;
      lifted = false;
      abandoned = false;
      landing = -1;
      releaseGesture("slot");
    };

    /** Tiles of a page, in the order they are laid out. */
    const tilesOf = (box: HTMLElement) =>
      Array.from(box.children) as HTMLElement[];

    /**
     * The grid the page lays out, and where it sits.
     *
     * Taken from the resolved track sizes rather than from the cells: a page
     * holds a cell per slot whether or not each slot has a link, so counting
     * cells would undercount a partly used page and skew every position. The
     * resolved tracks describe the whole grid either way.
     */
    const gridOf = (box: HTMLElement) => {
      const style = getComputedStyle(box);
      const columnTracks = trackSizes(style.gridTemplateColumns);
      const rowTracks = trackSizes(style.gridTemplateRows);
      if (columnTracks.length === 0 || rowTracks.length === 0) return null;

      const rect = box.getBoundingClientRect();
      const bounds = centeredGridBox(
        {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
        columnTracks,
        rowTracks,
        Number.parseFloat(style.columnGap) || 0,
        Number.parseFloat(style.rowGap) || 0,
      );
      if (!bounds) return null;

      // The grid's own shape is the authority for the mapping, so a stale
      // setting cannot skew where a drop lands.
      return { bounds, columns: columnTracks.length, rows: rowTracks.length };
    };

    /**
     * The first slot a page shows.
     *
     * Slots are numbered across the whole list while a drag happens inside one
     * page, so the page's place in the rail has to be added back or a drop on
     * page two would be written into page one.
     */
    const pageStartOf = (box: HTMLElement, size: number): number => {
      const track = box.parentElement;
      if (!track) return 0;

      return Math.max(0, Array.prototype.indexOf.call(track.children, box)) * size;
    };

    /**
     * The slot the tile is over, in absolute slot numbers.
     *
     * Measured from the tile's own centre, not from the pointer: the tile
     * keeps the offset it was grabbed at, so a tile picked up by its corner
     * hangs a whole cell away from the pointer. Judging by the pointer would
     * light one cell up and drop the tile in another. The tile's centre is
     * where the tile looks like it is, and that is what has to decide both.
     *
     * The cell under that point is asked of the document, so the cell that
     * lights up and the cell the tile lands in are the same element. The tile
     * ignores the pointer while it travels, so the hit test sees the cell
     * beneath it rather than the tile itself.
     *
     * A centre over a gap or outside the grid has no cell under it, so those
     * fall back to arithmetic and still snap to the nearest cell.
     */
    const slotUnderTile = (): number | null => {
      if (!page || !source) return null;

      const grid = gridOf(page);
      if (!grid) return null;

      const start = pageStartOf(page, grid.columns * grid.rows);

      // The live rect, which already includes the drag offset.
      const rect = source.getBoundingClientRect();
      const centre = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };

      const under = document
        .elementFromPoint(centre.x, centre.y)
        ?.closest?.(".Link") as HTMLElement | null;

      if (under && under !== source && page.contains(under))
        return start + tilesOf(page).indexOf(under);

      return (
        start + nearestSlot(centre, grid.bounds, grid.columns, grid.rows)
      );
    };

    /** Put the tile's centre on a point. */
    const moveTo = (x: number, y: number) => {
      if (!source) return;

      source.style.setProperty("--drag-x", `${x - anchor.x}px`);
      source.style.setProperty("--drag-y", `${y - anchor.y}px`);
    };

    /** Light up the cell the tile is over. */
    const markTarget = () => {
      if (!page) return;

      const slot = slotUnderTile();
      if (slot === null || slot === landing) return;

      clearTarget();
      landing = slot;

      const grid = gridOf(page);
      if (!grid) return;

      const start = pageStartOf(page, grid.columns * grid.rows);
      const cell = tilesOf(page)[slot - start];
      if (cell && cell !== source) {
        target = cell;
        target.classList.add("is-dropTarget");
      }
    };

    /**
     * The slot of the cell currently carrying the landing effect.
     *
     * Read back from the element that is lit rather than recomputed, so the
     * cell that shows the effect and the cell the tile is written into are
     * one and the same thing by definition. Whatever decides the effect
     * decides the drop; there is no second calculation to disagree with it.
     */
    const litSlot = (): number | null => {
      if (!page) return null;

      const lit = page.querySelector<HTMLElement>(".is-dropTarget");
      if (!lit) return null;

      const grid = gridOf(page);
      if (!grid) return null;

      const start = pageStartOf(page, grid.columns * grid.rows);
      const at = tilesOf(page).indexOf(lit);
      return at < 0 ? null : start + at;
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || !event.isPrimary) return;

      const tile = (event.target as HTMLElement)?.closest?.(
        ".Link",
      ) as HTMLElement | null;
      const box = tile?.closest(".LinkPage") as HTMLElement | null;
      if (!tile || !box) return;

      swallowClick = false;
      source = tile;
      page = box;
      pointerId = event.pointerId;
      start = { x: event.clientX, y: event.clientY };
      lifted = false;
      abandoned = false;
      landing = -1;

      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        if (abandoned || !source) return;
        if (!claimGesture("slot")) return;

        lifted = true;
        if (area.setPointerCapture) area.setPointerCapture(pointerId);
        source.classList.add("is-dragging");

        // Centre the tile on the pointer as it is picked up. The tile, the
        // pointer and the cell that lights up then all agree by construction,
        // instead of differing by however the tile happened to be grabbed.
        const bounds = source.getBoundingClientRect();
        anchor = {
          x: bounds.left + bounds.width / 2,
          y: bounds.top + bounds.height / 2,
        };
        moveTo(start.x, start.y);
        markTarget();
      }, LONG_PRESS);
    };

    const onMove = (event: PointerEvent) => {
      if (!source || event.pointerId !== pointerId) return;

      if (!lifted) {
        // Still waiting for the press to become a long press. Any real
        // movement means the user is swiping or scrolling instead.
        const travelled = Math.hypot(
          event.clientX - start.x,
          event.clientY - start.y,
        );
        if (travelled > SLOP) {
          abandoned = true;
          clearTimer();
        }
        return;
      }

      moveTo(event.clientX, event.clientY);
      markTarget();
    };

    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;

      clearTimer();
      if (area.hasPointerCapture?.(pointerId))
        area.releasePointerCapture(pointerId);

      // Derived from where the tile sits among its page's children, so the
      // move does not depend on an attribute being present.
      const grid = page ? gridOf(page) : null;
      const from =
        source && page && grid
          ? pageStartOf(page, grid.columns * grid.rows) +
            tilesOf(page).indexOf(source)
          : -1;
      // Wherever the effect is showing, that is where it goes.
      const to = litSlot() ?? landing;
      const dropped = lifted && from >= 0 && to !== null && to >= 0 && to !== from;

      drop();
      if (lifted) swallowClick = true;
      if (dropped) latest.current.onMove(from, to);
    };

    const onCancel = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      clearTimer();
      drop();
    };

    // A tile is an anchor, and an anchor drags natively: the browser would
    // take over a few pixels into the press, show a "no drop" cursor, and stop
    // delivering pointer moves, so the tile would freeze where it was picked
    // up. Cancelling the drag leaves the gesture entirely to this hook.
    const onDragStart = (event: DragEvent) => {
      const tile = (event.target as HTMLElement)?.closest?.(".Link");
      if (tile) event.preventDefault();
    };

    // A press that ended in a drop must not also open the link underneath it.
    const onClick = (event: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    };

    area.addEventListener("pointerdown", onDown);
    area.addEventListener("pointermove", onMove);
    area.addEventListener("pointerup", onUp);
    area.addEventListener("pointercancel", onCancel);
    area.addEventListener("click", onClick, true);
    area.addEventListener("dragstart", onDragStart);

    return () => {
      clearTimer();
      if (ownsGesture("slot")) drop();

      area.removeEventListener("pointerdown", onDown);
      area.removeEventListener("pointermove", onMove);
      area.removeEventListener("pointerup", onUp);
      area.removeEventListener("pointercancel", onCancel);
      area.removeEventListener("click", onClick, true);
      area.removeEventListener("dragstart", onDragStart);
    };
  }, [enabled, viewport]);
};
