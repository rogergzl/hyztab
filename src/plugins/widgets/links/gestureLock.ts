/**
 * Which gesture owns the grid.
 *
 * Two gestures start from the same press: a sideways drag turns the page, and
 * a long press picks a tile up. Only one may act on a given press, and the
 * tile drag is the one that has to take over, because it is decided later:
 * the page drag commits on the first few pixels, the tile drag after a delay.
 */

export type GestureOwner = "none" | "paging" | "slot";

let owner: GestureOwner = "none";

/**
 * Claim the grid for a gesture.
 *
 * The tile drag may take over from a page drag that has not committed yet;
 * a page drag may only start when nothing owns the grid, so it can never
 * interrupt a tile being moved.
 */
export const claimGesture = (who: Exclude<GestureOwner, "none">): boolean => {
  if (owner === who) return true;
  if (who === "slot") {
    owner = "slot";
    return true;
  }
  if (owner !== "none") return false;

  owner = who;
  return true;
};

/** Whether a gesture still owns the grid. */
export const ownsGesture = (who: GestureOwner): boolean => owner === who;

/** Hand the grid back when a gesture ends. */
export const releaseGesture = (who?: Exclude<GestureOwner, "none">): void => {
  // Only the gesture that owns it may release it, so a stale cleanup cannot
  // free the grid while another gesture is mid-flight.
  if (who && owner !== who) return;
  owner = "none";
};
