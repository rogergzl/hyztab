import { FC, useEffect, useRef } from "react";

import { selectProxyFallback, selectProxyRules } from "../../../db/linkProxy";
import { DB } from "../../../lib";
import { db } from "../../../db/state";
import { applyRules } from "../../../lib/linkProxy";

/** Debounce writes: typing in the editor saves on every pause. */
const DELAY = 300;

/**
 * Keeps the browser's PAC in sync with the proxy switches on saved links.
 *
 * Mounted once on the dashboard, never inside a widget: the routing is global
 * to the browser and is derived from every links widget at once. Anything that
 * changes the store triggers a recompute, so edits, removals, bookmark take-on
 * and reordering all converge on the same rules without notifying each other.
 */
const LinkProxyBridge: FC = () => {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (!active) return;

        const rules = selectProxyRules();
        const fallback = selectProxyFallback();
        const signature = JSON.stringify([rules, fallback]);
        // Writing the same PAC again would briefly drop every proxied
        // connection, so only apply when the rules actually changed.
        if (signature === last.current) return;

        last.current = signature;
        applyRules(rules, fallback);
      }, DELAY);
    };

    // Apply whatever is saved once storage is ready and the dashboard mounts,
    // then follow every change to the store.
    refresh();
    const unsubscribe = DB.listen(db, refresh);

    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
      unsubscribe();
      // Deliberately leave the last PAC in place: the setting is browser-wide
      // and must survive the new tab closing. An empty rule set already cleared
      // it through `applyRules`, so nothing stale is left behind.
    };
  }, []);

  return null;
};

export default LinkProxyBridge;
