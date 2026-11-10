import { RefObject, useEffect, useRef } from "react";

/** Wheel distance that counts as a deliberate page turn. */
const THRESHOLD = 24;
/** Quiet period after a turn, so one gesture cannot skip several pages. */
const COOLDOWN = 320;

/**
 * Turn pages with the mouse wheel or a trackpad.
 *
 * Pages move sideways, so the dominant axis of the gesture decides the
 * direction: a mouse wheel reports vertical deltas while a trackpad swipe
 * reports horizontal ones, and both should page.
 *
 * Trackpads emit a long tail of small wheel events for a single gesture, so
 * the delta is accumulated until it crosses a threshold and the handler then
 * stays locked for a short cooldown.
 */
export const useWheelPaging = (
  target: RefObject<HTMLElement | null>,
  enabled: boolean,
  onTurn: (direction: 1 | -1) => void,
): void => {
  // Kept in a ref so the listener never needs re-binding as props change.
  const turn = useRef(onTurn);
  turn.current = onTurn;

  useEffect(() => {
    const element = target.current;
    if (!element || !enabled) return;

    let accumulated = 0;
    let lockedUntil = 0;

    const onWheel = (event: WheelEvent) => {
      // The widget owns the gesture while it has more than one page.
      event.preventDefault();

      const now = Date.now();
      if (now < lockedUntil) return;

      accumulated +=
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;

      if (Math.abs(accumulated) < THRESHOLD) return;

      const direction = accumulated > 0 ? 1 : -1;
      accumulated = 0;
      lockedUntil = now + COOLDOWN;
      turn.current(direction);
    };

    // Must be non passive: the default scroll has to be cancelled.
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [target, enabled]);
};
