import { buildPacScript } from "./pac";
import { ProxyRule } from "./types";

/**
 * Wrapper around Chrome/Edge's global proxy setting.
 *
 * Chrome has no per-tab, per-link or per-request proxy API: `proxy.settings`
 * is a single browser-wide configuration. The only way to route selectively
 * is a PAC script whose `FindProxyForURL` decides by hostname. Firefox's
 * `browser.proxy` is a completely different API and is not handled here.
 */

type ProxySettings = {
  set: (details: object) => Promise<void>;
  clear: (details: object) => Promise<void>;
};

const settings = (): ProxySettings | null => {
  // `browser` is the polyfill in this project; on Chromium the proxy namespace
  // comes from `chrome`, which the polyfill does not mirror for this API. Both
  // are reached through globalThis so the module stays testable in Node.
  const root = globalThis as Record<string, any>;
  const scope =
    (root.chrome?.proxy
      ? root.chrome.proxy
      : root.browser?.proxy
        ? root.browser.proxy
        : null) ?? null;

  return scope?.settings?.set && scope?.settings?.clear ? scope.settings : null;
};

/** Whether this browser exposes the proxy settings API. */
export const proxySupported = (): boolean => settings() !== null;

/**
 * Install a PAC whose only rules are the given hosts. Passing an empty list
 * clears our setting entirely, handing proxy control back to the system or to
 * whatever other extension owns it — the feature is inert by default.
 */
export const applyRules = async (rules: ProxyRule[]): Promise<boolean> => {
  const api = settings();
  if (!api) return false;

  try {
    if (rules.length === 0) {
      await api.clear({ scope: "regular" });
      return true;
    }

    await api.set({
      value: {
        mode: "pac_script",
        pacScript: { data: buildPacScript(rules), mandatory: false },
      },
      scope: "regular",
    });
    return true;
  } catch (e) {
    // A policy or another proxy extension may own the setting; the dashboard
    // keeps working either way, so this is reported but never thrown.
    return false;
  }
};
