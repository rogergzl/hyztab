import { DB } from "../../lib";
import { selectWidgets } from "../select";
import { db } from "../state";

/** Marks the fix as applied, so it never runs a second time. */
const FIX = "links-position-bottom";

/** The plugin key whose widgets are affected. */
const LINKS = "widget/links";

/**
 * Move quick links widgets down off the middle of the page.
 *
 * The grid grew into a page wide band, and a centred one ended up pressed
 * against the greeting above it with a large gap below. Only widgets still on
 * the untouched default are moved, and the fix records itself so choosing the
 * middle again later is respected.
 */
export const relocateLinksWidget = (): void => {
  const applied = DB.get(db, "layoutFixes") ?? [];
  if (applied.includes(FIX)) return;

  for (const widget of selectWidgets()) {
    if (widget.key !== LINKS) continue;
    if (widget.display.position !== "middleCentre") continue;

    DB.put(db, `widget/${widget.id}`, {
      ...widget,
      display: { ...widget.display, position: "bottomCentre" },
    });
  }

  DB.put(db, "layoutFixes", [...applied, FIX]);
};
