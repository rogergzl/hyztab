import { RotatingCache } from "../../../hooks";
import { API } from "../../types";

type By = "official" | "collections" | "search" | "topics";

/** Where the pictures come from. */
export type Source = "bing" | "official" | "custom";

export interface Data {
  /** Which provider to read from. */
  source: Source;
  /** Address used when `source` is "custom". */
  customUrl: string;
  by: By;
  collections: string;
  featured: boolean;
  paused?: boolean;
  search: string;
  topics: string;
  timeout: number;
}

export interface Image {
  src: string;
  credit: {
    imageLink: string;
    location?: string;
    userName: string;
    userLink: string;
  };
}

type Cache = RotatingCache<Image>;

export type Props = API<Data, Cache>;

export const defaultData: Data = {
  // Bing's own wallpaper feed needs no key and is reachable from mainland
  // China, which the Unsplash API is not.
  source: "bing",
  customUrl: "",
  by: "official",
  collections: "",
  featured: false,
  paused: false,
  search: "",
  topics: "bo8jQKTaE0Y",
  timeout: 900,
};
