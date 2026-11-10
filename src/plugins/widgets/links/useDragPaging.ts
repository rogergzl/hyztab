import { RefObject, useEffect, useRef } from "react";

import { claimGesture, ownsGesture, releaseGesture } from "./gestureLock";

/** Movement before a press counts as a drag rather than a click. */
const SLOP = 8;
/** Fraction of the frame that must be travelled to turn a page. */
const TURN_RATIO = 0.18;
/** How far the pull gives beyond the first and last page. */
const EDGE_DAMPING = 0.3;

/**
 * Where a released drag should land, and the rail offset that holds the view.
 *
 * The returned `hold` re-expresses the drag against the page React is about to
 * move to, so `-page * width + offset` is unchanged: the rail does not jump
 * when the page index updates, and only then is the offset animated to zero.
 */
export const resolveRelease = (
  page: number,
  offset: number,
  width: number,
): { page: number; hold: number } => {
  const turned = Math.abs(offset) > width * TURN_RATIO;
  const next = turned ? page + (offset < 0 ? 1 : -1) : page;
  return { page: next, hold: offset + (next - page) * width };
};

type Options = {
  /** The clipped area the pages move inside. */
  viewport: RefObject<HTMLElement | null>;
  /** The rail holding every page. */
  track: RefObject<HTMLElement | null>;
  enabled: boolean;
  page: number;
  pages: number;
  onPage: (page: number) => void;
};

/**
 * Turn pages by dragging sideways.
 *
 * The rail is offset through a CSS variable rather than React state, so the
 * drag stays smooth while React keeps ownership of the settled page. On
 * release the offset is re-expressed against the page React is about to move
 * to, which holds the visual position steady, and only then is it animated
 * back to zero. Dragging never opens the link it ends on.
 */
export const useDragPaging = ({
  enabled,
  onPage,
  page,
  pages,
  track,
  viewport,
}: Options): void => {
  // Read through refs so the listeners survive re-renders mid gesture.
  const latest = useRef({ page, pages, onPage });
  latest.current = { page, pages, onPage };

  useEffect(() => {
    const area = viewport.current;
    const rail = track.current;
    if (!area || !rail || !enabled) return;

    let startX = 0;
    let offset = 0;
    let dragging = false;
    let moved = false;
    let gesture = 0;
    let pointerId = -1;

    const setOffset = (value: number) => {
      offset = value;
      rail.style.setProperty("--link-drag", String(value));
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      // A tile being moved owns the press; a page turn may never interrupt it.
      if (!claimGesture("paging")) return;

      gesture += 1;
      dragging = true;
      moved = false;
      pointerId = event.pointerId;
      startX = event.clientX;
      rail.classList.add("is-dragging");
      setOffset(0);
    };

    const onMove = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== pointerId) return;

      // A long press may take over mid gesture, once it has picked a tile up.
      // Everything this gesture touched is undone here, because its own
      // release handler will not run.
      if (!ownsGesture("paging")) {
        dragging = false;
        moved = false;
        rail.classList.remove("is-dragging");
        setOffset(0);
        return;
      }

      const delta = event.clientX - startX;
      if (!moved && Math.abs(delta) < SLOP) return;

      // Capture only once it is clearly a drag, so plain clicks still work.
      if (!moved && area.setPointerCapture) area.setPointerCapture(pointerId);
      moved = true;

      const { page: current, pages: total } = latest.current;
      const pullingPastStart = current <= 0 && delta > 0;
      const pullingPastEnd = current >= total - 1 && delta < 0;

      setOffset(
        pullingPastStart || pullingPastEnd ? delta * EDGE_DAMPING : delta,
      );
    };

    const onUp = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== pointerId) return;

      if (!ownsGesture("paging")) {
        dragging = false;
        return;
      }

      dragging = false;
      releaseGesture("paging");
      if (area.hasPointerCapture?.(pointerId))
        area.releasePointerCapture(pointerId);

      const width = area.clientWidth || 1;
      const { page: current } = latest.current;
      const settled = moved
        ? resolveRelease(current, offset, width)
        : { page: current, hold: 0 };

      // Hold the current visual position across the page change...
      setOffset(settled.hold);
      if (settled.page !== current) latest.current.onPage(settled.page);

      // ...then, once that has been painted, slide home.
      const token = gesture;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (gesture !== token) return;
          rail.classList.remove("is-dragging");
          setOffset(0);
        }),
      );
    };

    const onClick = (event: MouseEvent) => {
      if (!moved) return;
      moved = false;
      event.preventDefault();
      event.stopPropagation();
    };

    area.addEventListener("pointerdown", onDown);
    area.addEventListener("pointermove", onMove);
    area.addEventListener("pointerup", onUp);
    area.addEventListener("pointercancel", onUp);
    // Capture phase, so a drag never reaches the link underneath it.
    area.addEventListener("click", onClick, true);

    return () => {
      area.removeEventListener("pointerdown", onDown);
      area.removeEventListener("pointermove", onMove);
      area.removeEventListener("pointerup", onUp);
      area.removeEventListener("pointercancel", onUp);
      area.removeEventListener("click", onClick, true);
    };
  }, [enabled, track, viewport]);
};
