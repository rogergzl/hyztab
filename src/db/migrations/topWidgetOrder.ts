import { DB } from "../../lib";
import { selectWidgets } from "../select";
import { db } from "../state";

/** Marks the fix as applied so a user-chosen order is never overwritten. */
const FIX = "top-widget-order-greeting-before-search";

/** Orders written by the previous default layout. */
const PREVIOUS: Record<string, number> = {
  "default-time": 0,
  "default-search": 1,
  "default-links": 2,
  "default-greeting": 3,
};

/** Desired top-to-bottom order: time, greeting, search, quick links. */
const CURRENT: Record<string, number> = {
  "default-time": 0,
  "default-greeting": 1,
  "default-search": 2,
  "default-links": 3,
};

/**
 * Swap greeting and search for profiles that still hold the untouched old
 * default. Any added, removed or reordered widget means the user has made a
 * deliberate choice, so this fix stays out of the way.
 */
export const reorderTopWidgets = (): void => {
  const applied = DB.get(db, "layoutFixes") ?? [];
  if (applied.includes(FIX)) return;

  const widgets = selectWidgets();
  const untouched =
    widgets.length === 4 &&
    widgets.every(
      (widget) =>
        Object.prototype.hasOwnProperty.call(PREVIOUS, widget.id) &&
        widget.order === PREVIOUS[widget.id],
    );

  if (untouched)
    for (const widget of widgets)
      DB.put(db, `widget/${widget.id}`, {
        ...widget,
        order: CURRENT[widget.id],
      });

  DB.put(db, "layoutFixes", [...applied, FIX]);
};
