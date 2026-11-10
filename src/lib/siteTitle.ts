/**
 * Reading the name a site gives itself.
 *
 * The only way to know what a site calls itself is to read its own document,
 * which needs access to that site. The access is requested on demand rather
 * than at install time, and only ever used while a link is being configured:
 * nothing is read while browsing.
 */

/** The host access reading a page needs. */
export const SITE_TITLE_ORIGINS = ["<all_urls>"];

const permissionsApi = () => {
  if (typeof browser === "undefined") return null;
  return browser.permissions ?? null;
};

/** Whether the optional host access has been granted. */
export const hasSiteTitleAccess = async (): Promise<boolean> => {
  const api = permissionsApi();
  if (!api) return false;

  try {
    return await api.contains({ origins: SITE_TITLE_ORIGINS });
  } catch (e) {
    return false;
  }
};

/**
 * Ask for the host access.
 *
 * Browsers only honour this from a user gesture, so it has to be called
 * straight from a click on the setting.
 */
export const requestSiteTitleAccess = async (): Promise<boolean> => {
  const api = permissionsApi();
  if (!api) return false;

  try {
    return await api.request({ origins: SITE_TITLE_ORIGINS });
  } catch (e) {
    return false;
  }
};

/** Give the access back. */
export const dropSiteTitleAccess = async (): Promise<void> => {
  const api = permissionsApi();
  if (!api) return;

  try {
    await api.remove({ origins: SITE_TITLE_ORIGINS });
  } catch (e) {
    // Already gone, or the browser refuses: the setting is off either way.
  }
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
};

/**
 * Pull the title out of a document.
 *
 * A regex rather than a parser so the behaviour is identical everywhere and
 * can be tested without a DOM. Only the head matters, so the caller trims the
 * document before handing it over.
 */
export const titleFromHtml = (html: string): string | null => {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;

  const decoded = match[1].replace(
    /&([a-z#0-9]+);/gi,
    (whole, name: string) => ENTITIES[name.toLowerCase()] ?? whole,
  );

  const title = decoded.replace(/\s+/g, " ").trim();
  return title || null;
};

/** How much of a document is read: titles live in the head. */
const READ_LIMIT = 200000;

/**
 * Ask a URL what it calls itself.
 *
 * Credentials are left out, so the request carries no cookies and the answer
 * cannot depend on who is signed in. Every failure is reported as "no name",
 * which leaves the caller with the name it derived from the domain.
 */
export const fetchSiteTitle = async (url: string): Promise<string | null> => {
  if (typeof fetch !== "function") return null;

  try {
    const res = await fetch(url, {
      credentials: "omit",
      redirect: "follow",
      cache: "force-cache",
    });

    if (!res.ok) return null;

    const type = res.headers.get("content-type") ?? "";
    if (type && !/html|text/i.test(type)) return null;

    const body = await res.text();
    return titleFromHtml(body.slice(0, READ_LIMIT));
  } catch (e) {
    // No access, offline, blocked, or not a document: all the same to us.
    return null;
  }
};
