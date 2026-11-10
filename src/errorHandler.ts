/**
 * Stack trace normalisation.
 *
 * Errors are no longer sent to a remote service. The upstream project reported
 * to its own third party account, which does not belong to this build, so that
 * endpoint is gone. What remains is local and passive: making extension frame
 * URLs readable and comparable when an error reaches the console.
 */

/** Written in place of the browser's own extension origin. */
const SCHEME = "resource://huayuzhu-extension";

/**
 * Rewrite the browser's extension origin in a stack trace.
 *
 * Matches any extension id rather than one hard coded value, so a frame is
 * normalised both for the installed build and for a development build.
 */
export function capture(error: Error): void {
  if (!error.stack) return;

  error.stack = error.stack
    // Firefox
    .replace(
      /moz-extension:\/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
      SCHEME,
    )
    // Chromium, where an id is 32 characters in the range a-p
    .replace(/chrome-extension:\/\/[a-p]{32}/g, SCHEME);
}
