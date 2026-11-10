import { directSources } from "../sources";
import { Data, Image, Source } from "./types";

export const officialCollection = 1053828;

type Config = Pick<
  Data,
  "by" | "collections" | "customUrl" | "featured" | "search" | "source" | "topics"
>;

/** Bing's wallpaper feed: official, keyless, and reachable from China. */
const BING_ORIGIN = "https://cn.bing.com";
const BING_ENDPOINT = `${BING_ORIGIN}/HPImageArchive.aspx?format=js&idx=0&n=8&mkt=zh-CN`;

/**
 * Read Bing's daily wallpapers.
 *
 * Each entry carries a `urlbase` that a size suffix can be appended to, and a
 * `copyright` string which is the only credit the feed provides.
 */
const fetchBingImages = async (): Promise<Image[]> => {
  const res = await fetch(BING_ENDPOINT, { cache: "no-cache" });
  const body = await res.json();
  const images: any[] = body?.images ?? [];

  return images.map((item) => ({
    src: `${BING_ORIGIN}${item.urlbase}_1920x1080.jpg`,
    credit: {
      imageLink: item.copyrightlink || BING_ORIGIN,
      location: undefined,
      userName: item.copyright ?? "Bing",
      userLink: BING_ORIGIN,
    },
  }));
};

/** Read the Unsplash API, which needs a key supplied at build time. */
const fetchUnsplashImages = async ({
  by,
  collections,
  topics,
  featured,
  search,
}: Config): Promise<Image[]> => {
  const url = "https://api.unsplash.com/photos/random";
  const params = new URLSearchParams();
  const headers = new Headers({
    Authorization: `Client-ID ${UNSPLASH_API_KEY}`,
  });

  params.set("count", "10");

  switch (by) {
    case "collections":
      params.set("collections", collections);
      break;

    case "topics":
      params.set("topics", topics);
      params.set("orientation", "landscape");
      break;

    case "search":
      params.set("orientation", "landscape");
      if (featured) params.set("featured", "true");
      if (search) params.set("query", search);
      break;

    default:
      params.set("collections", String(officialCollection));
  }

  const res = await fetch(`${url}?${params}`, { headers, cache: "no-cache" });
  const body = await res.json();

  if (!Array.isArray(body)) {
    // An error body (a bad or missing key) rather than a list of photos.
    throw new Error(body?.errors?.[0] ?? "Unsplash 接口返回异常");
  }

  return body.map((item: any) => ({
    src: item.urls.raw,
    credit: {
      imageLink: item.links.html,
      location: item.location ? item.location.name : null,
      userName: item.user.name,
      userLink: item.user.links.html,
    },
  }));
};

/** Use an address the user supplied, which serves the picture itself. */
const fetchCustomImages = (customUrl: string): Image[] =>
  directSources(customUrl).map((src) => ({
    src,
    credit: { imageLink: customUrl, userName: "", userLink: "" },
  }));

export const fetchImages = async (config: Config): Promise<Image[]> => {
  switch (config.source) {
    case "bing":
      return fetchBingImages();

    case "custom":
      if (!config.customUrl.trim())
        throw new Error("请先填写自定义图片地址");
      return fetchCustomImages(config.customUrl.trim());

    default:
      return fetchUnsplashImages(config);
  }
};

/**
 * Build the address actually handed to the browser.
 *
 * Only Unsplash resizes through query parameters; the other sources already
 * return a ready to use address, which must not be rewritten.
 */
export const buildLink = (src: string, source: Source): string => {
  if (source !== "official") return src;

  const url = new URL(src);
  url.searchParams.set("q", "85");
  url.searchParams.set(
    "w",
    String(calculateWidth(window.innerWidth, window.devicePixelRatio)),
  );
  return String(url);
};

/**
 * Calculate width to fetch image, tuned for Unsplash cache performance.
 */
export function calculateWidth(screenWidth = 1920, pixelRatio = 1): number {
  // Consider a minimum resolution too
  screenWidth = screenWidth * pixelRatio; // Find true resolution
  screenWidth = Math.max(screenWidth, 1920); // Lower limit at 1920
  screenWidth = Math.min(screenWidth, 3840); // Upper limit at 4K
  screenWidth = Math.ceil(screenWidth / 240) * 240; // Snap up to nearest 240px for improved caching
  return screenWidth;
}
