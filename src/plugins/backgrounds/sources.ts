/**
 * Helpers shared by the background plugins that can point at a plain image
 * address, rather than a specific service.
 */

/**
 * Add a changing query parameter to an address.
 *
 * A "random image" endpoint returns a different picture for every request, so
 * asking for it repeatedly is how a rotating cache gets several images out of
 * one address. Without a changing parameter the browser would serve the first
 * response from cache instead.
 */
export const withNonce = (url: string, nonce: number): string => {
  try {
    const target = new URL(url);
    target.searchParams.set("_", String(nonce));
    return target.toString();
  } catch (e) {
    // Not a parsable address: hand it back untouched rather than throwing.
    return url;
  }
};

/**
 * A set of entries for a directly served image address, so it can take part in
 * a rotating cache like any other source.
 */
export const directSources = (url: string, count = 8): string[] =>
  Array.from({ length: count }, (_, index) =>
    index === 0 ? url : withNonce(url, index),
  );
