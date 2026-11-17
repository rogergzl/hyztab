import { RefObject, useEffect, useRef } from "react";

import { claimGesture, ownsGesture, releaseGesture } from "./gestureLock";
import { SlotCell, nearestCell, slotCells, trackSizes } from "./layout";

/** How long a press has to last before it picks a tile up. */
const LONG_PRESS = 380;
/** Movement before the long press lands abandons it in favour of the gesture
 *  the browser was already tracking (a page swipe, a scroll). */
const SLOP = 8;

type Options = {
  /** The clipped area holding the pages. */
  viewport: RefObject<HTMLElement | null>;
  enabled: boolean;
  /** Fallback column count, used when the resolved tracks cannot be read. */
  columns: number;
  rows: number;
  /** Move a link from one slot to another. */
  onMove: (from: number, to: number) => void;
};

/**
 * Pick a tile up with a long press and drop it onto the closest numbered slot.
 *
 * Every cell is numbered by its place in the grid — first row left to right,
 * then the second row, and so on — and the numbering is read from the page as
 * it is laid out now, not from the widget's configured defaults. So changing
 * the grid size in the sidebar changes what a drag can reach immediately.
 *
 * Where the tile lands is decided purely by distance between the pointer and
 * each slot's centre. Nothing is hit-tested against the document, because the
 * elements under a moving tile are a poor guide: a stacked popup, a page rail
 * or an overlapping widget can answer in their place, which is what made so
 * few slots reachable before.
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
    let cells: SlotCell[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pointerId = -1;
    let start = { x: 0, y: 0 };
    // Where the tile's centre sat when it was picked up, so every offset is
    // measured against the same origin.
    let anchor = { x: 0, y: 0 };
    let lifted = false;
    let abandoned = false;
    // Absolute slot number that is currently lit and will receive the tile.
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
      cells = [];
      pointerId = -1;
      lifted = false;
      abandoned = false;
      landing = -1;
      releaseGesture("slot");
    };

    /** The absolute slot a tile occupies. */
    const slotOf = (element: HTMLElement | null): number => {
      if (!element) return -1;

      const stored = Number(element.dataset.slot);
      if (Number.isFinite(stored)) return stored;

      if (!page) return -1;
      const at = Array.prototype.indexOf.call(page.children, element);
      return at < 0 ? -1 : startOf(page) + at;
    };

    /** The absolute slot of the first cell on a page. */
    const startOf = (box: HTMLElement): number => {
      const first = box.firstElementChild as HTMLElement | null;
      const stored = Number(first?.dataset.slot);
      if (Number.isFinite(stored)) return stored;

      const track = box.parentElement;
      const index = track
        ? Array.prototype.indexOf.call(track.children, box)
        : 0;

      return (
        Math.max(0, index) *
        Math.max(1, latest.current.columns) *
        Math.max(1, latest.current.rows)
      );
    };

    /**
     * Number every cell of a page, at the centre of the space it occupies.
     *
     * Track sizes come from the browser's resolved `grid-template-*`, which
     * describes the whole grid whether or not each slot holds a link. When a
     * browser will not resolve them, the page is split evenly using the counts
     * the component knows, so a drag still works rather than reaching nothing.
     */
    const readCells = (box: HTMLElement): SlotCell[] => {
      const style = getComputedStyle(box);
      const rect = box.getBoundingClientRect();
      const columnGap = Number.parseFloat(style.columnGap) || 0;
      const rowGap = Number.parseFloat(style.rowGap) || 0;

      let columnTracks = trackSizes(style.gridTemplateColumns);
      let rowTracks = trackSizes(style.gridTemplateRows);

      if (columnTracks.length === 0) {
        const across = Math.max(1, Math.floor(latest.current.columns) || 1);
        const width = (rect.width - columnGap * (across - 1)) / across;
        columnTracks =
          width > 0 ? Array.from({ length: across }, () => width) : [];
      }

      if (rowTracks.length === 0) {
        const down = Math.max(1, Math.floor(latest.current.rows) || 1);
        const height = (rect.height - rowGap * (down - 1)) / down;
        rowTracks = height > 0 ? Array.from({ length: down }, () => height) : [];
      }

      return slotCells(
        {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
        columnTracks,
        rowTracks,
        columnGap,
        rowGap,
        startOf(box),
      );
    };

    /** The tile that occupies a slot, if it is on the page. */
    const cellAt = (index: number): HTMLElement | null =>
      page?.querySelector<HTMLElement>(`[data-slot="${index}"]`) ?? null;

    /** Put the tile's centre on a point. */
    const moveTo = (x: number, y: number) => {
      if (!source) return;

      source.style.setProperty("--drag-x", `${x - anchor.x}px`);
      source.style.setProperty("--drag-y", `${y - anchor.y}px`);
    };

    /**
     * Light up the numbered slot nearest the pointer.
     *
     * The same number is what the tile is dropped into, so the cell that shows
     * the effect is always the cell that receives the link.
     */
    const markTarget = (x: number, y: number) => {
      if (!page || cells.length === 0) return;

      const cell = nearestCell(cells, x, y);
      if (!cell || cell.index === landing) return;

      clearTarget();
      landing = cell.index;

      const element = cellAt(cell.index);
      if (element && element !== source) {
        target = element;
        target.classList.add("is-dropTarget");
      }
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
      cells = [];

      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        if (abandoned || !source || !page) return;
        if (!claimGesture("slot")) return;

        lifted = true;
        if (area.setPointerCapture) area.setPointerCapture(pointerId);
        source.classList.add("is-dragging");

        // Number the grid as it is laid out right now, so the reachable slots
        // always match the columns and rows showing in the sidebar.
        cells = readCells(page);

        // Centre the tile on the pointer as it is picked up, so the tile and
        // the pointer agree and an edge slot is reachable by moving to it.
        const bounds = source.getBoundingClientRect();
        anchor = {
          x: bounds.left + bounds.width / 2,
          y: bounds.top + bounds.height / 2,
        };
        moveTo(start.x, start.y);
        markTarget(start.x, start.y);
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
      markTarget(event.clientX, event.clientY);
    };

    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;

      clearTimer();
      if (area.hasPointerCapture?.(pointerId))
        area.releasePointerCapture(pointerId);

      const from = slotOf(source);
      // Wherever the effect is showing, that is where it goes.
      const to = landing;
      const dropped =
        lifted && from >= 0 && to >= 0 && to !== from;

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
