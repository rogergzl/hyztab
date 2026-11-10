import { ICON_CUSTOM, ICON_FAVICON, Link } from "./types";

/** Shown for links that the user has not configured yet. */
export const UNCONFIGURED_NAME = "新链接";

/** Get the hostname of a url, or null when absent or unparsable. */
export const getDomain = (url?: string): string | null => {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch (e) {
    return null;
  }
};

/** True when the link has a usable destination to navigate to. */
export const hasUrl = (link: Link): boolean => Boolean(getDomain(link.url));

/** Get a compact, human readable version of a url for display. */
export const displayUrl = (url?: string): string => {
  const domain = getDomain(url);
  if (!domain) return "";

  try {
    const parsed = new URL(url!);
    return domain + (parsed.pathname !== "/" ? parsed.pathname : "");
  } catch (e) {
    return domain;
  }
};

/** Turn a hostname into something that reads like a name. */
export const prettifyHost = (url?: string): string => {
  const domain = getDomain(url);
  if (!domain) return "";
  const label = domain.replace(/^www\./, "").split(".")[0];
  return label.charAt(0).toUpperCase() + label.slice(1);
};

/**
 * Separators that reliably precede the subtitle of a page title.
 * A bare hyphen is excluded because it appears inside words and emoticons
 * such as "(゜-゜)", so it only counts when surrounded by spaces.
 */
const SEPARATORS = /\s*(?:\||｜|—|–|−|·|：|:|\s-\s)\s*/;

const MAX_LENGTH = 12;

/**
 * Guess a short display name from the full name, falling back to the host.
 * Prefers the leading segment of titles such as "GitHub - Where the world
 * builds software", because that segment is usually the product name.
 */
export const shortNameFrom = (name?: string, url?: string): string => {
  const source = (name ?? "").trim();

  if (source) {
    const first = source.split(SEPARATORS).filter(Boolean)[0];
    if (first && first.length <= MAX_LENGTH) return first;

    // No separator, so fall back to the first word, which is usually the
    // product name in titles such as "Bilibili (゜-゜) ...".
    const word = source.split(/\s+/)[0];
    if (word && word.length <= MAX_LENGTH) return word;

    return source.length <= MAX_LENGTH
      ? source
      : `${source.slice(0, MAX_LENGTH)}…`;
  }

  return url ? prettifyHost(url) : "";
};

/**
 * The browser's own favicon service.
 *
 * Chrome resolves the icon a site actually declares, including ones served
 * from a hashed path rather than /favicon.ico, which guessing a url cannot do.
 * Only the extension builds have a runtime to ask; the web build falls through
 * to the other sources.
 */
const extensionFavicon = (url: string): string | null => {
  if (typeof browser === "undefined" || !browser.runtime?.getURL) return null;

  try {
    const endpoint = new URL(browser.runtime.getURL("/_favicon/"));
    endpoint.searchParams.set("pageUrl", url);
    endpoint.searchParams.set("size", "64");
    return endpoint.toString();
  } catch (e) {
    return null;
  }
};

/**
 * Candidate favicon urls, best first.
 *
 * The browser's favicon service is preferred because it knows the real icon.
 * After that the site's own /favicon.ico, which is where most sites put one and
 * is the only guess that works for a host no public service can reach. Two
 * public services cover the rest.
 */
export const faviconUrls = (url?: string): string[] => {
  const domain = getDomain(url);
  if (!domain) return [];

  const sources: string[] = [];
  const managed = extensionFavicon(url!);
  if (managed) sources.push(managed);

  return sources.concat([
    `https://${domain}/favicon.ico`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  ]);
};

/** True when the link should render the automatically read site icon. */
export const usesFavicon = (link: Link): boolean =>
  link.icon === ICON_FAVICON || (!link.icon && hasUrl(link));

/**
 * Keep the icon setting consistent with the two choices the panel offers:
 * an uploaded icon when one is chosen, otherwise the site favicon as soon as
 * there is a url to read it from. Nothing is fetched before that point.
 */
export const normalizeIcon = (link: Link): Link => {
  if (link.icon === ICON_CUSTOM) return link;
  if (getDomain(link.url)) return { ...link, icon: ICON_FAVICON };
  return { ...link, icon: undefined };
};

/** True when the link should render an uploaded icon. */
export const usesCustomIcon = (link: Link): boolean =>
  link.icon === ICON_CUSTOM && Boolean(link.customIconId);

/**
 * The name shown underneath the icon. Never the full length name: falls back
 * to a shortened form so the homepage stays compact.
 */
export const displayNameOf = (link: Link): string => {
  const short = (link.shortName ?? "").trim();
  if (short) return short;

  const derived = shortNameFrom(link.name, link.url);
  if (derived) return derived;

  return displayUrl(link.url) || UNCONFIGURED_NAME;
};

/** The full length name, used in the hover popup. */
export const fullNameOf = (link: Link): string =>
  (link.name ?? "").trim() || displayUrl(link.url) || UNCONFIGURED_NAME;

/**
 * Read an uploaded image and shrink it to a square data url.
 * Icons are rendered at roughly one em, so there is no need to keep them large.
 */
export const readIconFile = (file: File, size = 64): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/"))
      return reject(new TypeError("Not an image"));

    const reader = new FileReader();

    reader.onerror = () => reject(reader.error ?? new Error("Cannot read file"));
    reader.onload = () => {
      const image = new Image();

      image.onerror = () => reject(new Error("Cannot decode image"));
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;

        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("Cannot create canvas"));

        // Fit inside the square without distorting, keeping it centred.
        const scale = Math.min(size / image.width, size / image.height);
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));

        context.drawImage(
          image,
          (size - width) / 2,
          (size - height) / 2,
          width,
          height,
        );
        resolve(canvas.toDataURL("image/png"));
      };

      image.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
