import { Link } from "./types";

/** Add a new link. */
export function addLink(link?: Link) {
  return {
    type: "ADD_LINK",
    data: { link },
  } as const;
}

/**
 * Replace the whole list.
 *
 * Used when the folder is taken on as the source: the links become whatever
 * the folder already holds, in its order.
 */
export function setLinks(links: Link[]) {
  return {
    type: "SET_LINKS",
    data: { links },
  } as const;
}

/**
 * Append several empty slots at once.
 *
 * Paging only exists once there is more than one page, so growing the widget
 * a whole page at a time is what makes it reachable from a full first page.
 */
export function addLinks(count: number) {
  return {
    type: "ADD_LINKS",
    data: { count },
  } as const;
}

/**
 * Put a link into a specific slot, padding with empty links when the slot sits
 * past the end of the list. Used when an empty grid cell is filled in place.
 */
export function insertLink(index: number, link?: Link) {
  return {
    type: "INSERT_LINK",
    data: { index, link },
  } as const;
}

/** Replace the link at the given index. */
export function updateLink(index: number, link: Link) {
  return {
    type: "UPDATE_LINK",
    data: { index, link },
  } as const;
}

/** Remove the link at the given index. */
export function removeLink(index: number) {
  return {
    type: "REMOVE_LINK",
    data: { index },
  } as const;
}

/** Move a link from one index to another. */
export function reorderLink(index: number, to: number) {
  return {
    type: "REORDER_LINK",
    data: { index, to },
  } as const;
}

export type Action =
  | ReturnType<typeof addLink>
  | ReturnType<typeof addLinks>
  | ReturnType<typeof setLinks>
  | ReturnType<typeof insertLink>
  | ReturnType<typeof updateLink>
  | ReturnType<typeof removeLink>
  | ReturnType<typeof reorderLink>;
