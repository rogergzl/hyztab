import { DB, Storage } from "../lib";
import { defaultLocale } from "../locales";
import { DEFAULT_GRID, LinksGrid } from "./linksGrid";

/**
 * Database state
 */
export interface State {
  /** Background state */
  background: BackgroundState;
  /** Shared grid size used by every quick links widget */
  linksGrid: LinksGrid;
  /** Whether quick links are mirrored into a bookmarks folder */
  bookmarkSync: boolean;
  /** Whether a new link may read the site's own name for its full name */
  siteTitle: boolean;
  /** Widget state */
  [key: `widget/${string}`]: WidgetState | null;
  /** Plugin data */
  [key: `data/${string}`]: unknown;
  /** Whether focus has been activated */
  focus: boolean;
  /**
   * One off layout fixes already applied, so each runs once and a position the
   * user picks afterwards is never overridden again.
   */
  layoutFixes?: string[];
  /** Locale selected */
  locale: string;
  /** Time zone selected, if any */
  timeZone: string | null;
}

export interface BackgroundState {
  id: string;
  key: string;
  display: BackgroundDisplay;
}

export interface BackgroundDisplay {
  blur?: number;
  luminosity?: number;
}

export interface WidgetState {
  id: string;
  key: string;
  order: number;
  display: WidgetDisplay;
}

export interface WidgetDisplay {
  colour?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  position: WidgetPosition;
}

export type WidgetPosition =
  | "topLeft"
  | "topCentre"
  | "topRight"
  | "middleLeft"
  | "middleCentre"
  | "middleRight"
  | "bottomLeft"
  | "bottomCentre"
  | "bottomRight";

// Init data for the store
const initData: State = {
  background: {
    // Starts on the upload screen: a new tab with no picture set yet shows a
    // plain dark backdrop until the user picks one.
    id: "default-image",
    key: "background/image",
    display: {
      luminosity: -0.2,
      blur: 0,
    },
  },
  linksGrid: { ...DEFAULT_GRID },
  /** Whether quick links are mirrored into a bookmarks folder. */
  bookmarkSync: true,
  /** Whether a new link may read the site's own name for its full name. */
  siteTitle: false,
  // Clock and greeting sit at the top of the page, leaving the lower half to
  // the quick links grid.
  "widget/default-time": {
    id: "default-time",
    key: "widget/time",
    order: 0,
    display: {
      position: "topCentre",
    },
  },
  "widget/default-greeting": {
    id: "default-greeting",
    key: "widget/greeting",
    order: 1,
    display: {
      position: "topCentre",
    },
  },
  focus: false,
  locale: defaultLocale,
  timeZone: null,
};

// Database storage
export const db = DB.init<State>(initData);

// Cache storage
export const cache = DB.init<Record<string, unknown | undefined>>();

// Persist data
export const dbStorage =
  BUILD_TARGET === "web"
    ? Storage.indexeddb(db, "huayuzhu/config")
    : Storage.extension(db, "huayuzhu/config", "sync");

export const cacheStorage =
  BUILD_TARGET === "firefox"
    ? Storage.extension(cache, "huayuzhu/cache", "local")
    : Storage.indexeddb(cache, "huayuzhu/cache");
