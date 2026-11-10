import { API } from "../../types";
import { DEFAULT_GRID } from "../../../db/linksGrid";

/** Use the favicon fetched from the website itself. */
export const ICON_FAVICON = "_favicon";
/** Use an icon uploaded by the user, stored in the cache by `customIconId`. */
export const ICON_CUSTOM = "_custom";

export type Link = {
  /** Target address. Absent until the user configures it. */
  url?: string;
  /**
   * The original, full length name of the website.
   * Kept as the underlying source of truth, shown in the hover popup.
   */
  name?: string;
  /** Short display name, shown underneath the icon. */
  shortName?: string;
  /** ICON_FAVICON, ICON_CUSTOM, or absent to show no icon. */
  icon?: string;
  /** Key of the uploaded icon inside the cache. Only used with ICON_CUSTOM. */
  customIconId?: string;
};

export type Data = {
  links: Link[];
  visible: boolean;
  linkOpenStyle: boolean;
};

/** Uploaded icons, keyed by id. Stored in IndexedDB rather than synced data. */
export type Cache = Record<string, string>;

/**
 * Where a tile sits in the grid, so its hover popup can be turned to face the
 * inside of the frame instead of being clipped by it.
 */
export type LinkPlacement = {
  /** Drop the popup under the tile rather than over it. */
  below: boolean;
  /** Which edge of the tile the popup lines up with. */
  align: "start" | "centre" | "end";
};

export type Props = API<Data, Cache>;

/** An empty slot: no address yet, rendered as a dashed "new link" cell. */
export const emptyLink = (): Link => ({});

/** How many slots a full page has, with the default grid. */
export const DEFAULT_SLOTS = DEFAULT_GRID.rows * DEFAULT_GRID.columns;

export const defaultData: Data = {
  // A brand new widget comes with a full page of empty slots already laid out,
  // so the grid is visible and every cell can be configured in place.
  links: Array.from({ length: DEFAULT_SLOTS }, emptyLink),
  visible: true,
  linkOpenStyle: false,
};

export const defaultCache: Cache = {};
