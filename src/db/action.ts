import { nanoid } from "nanoid";
import { DB } from "../lib";
import { LinksGrid, clampLinksGrid } from "./linksGrid";
import {
  normalizeShareConfig,
  sanitizeShareConfig,
  selectShareConfig,
} from "./linkShare";
import migrateFrom2 from "./migrations/migrate2";
import { selectWidgets } from "./select";
import { cache, db, WidgetDisplay, WidgetPosition } from "./state";

export const createId = (): string => nanoid(12);

// Background actions

/** Change the background */
export const setBackground = (key: string): void => {
  const current = DB.get(db, "background");
  const id = createId();
  DB.put(db, "background", {
    id,
    key,
    display: { blur: 0, luminosity: -0.2 },
  });
  DB.del(db, `data/${current.id}`);
  DB.del(cache, current.id);
};

// Links widget actions

/** Change the grid size shared by every quick links widget. */
export const setLinksGrid = (grid: Partial<LinksGrid>): void => {
  const current = DB.get(db, "linksGrid");
  DB.put(db, "linksGrid", clampLinksGrid({ ...current, ...grid }));
};

/** Turn the bookmark mirror on or off. */
export const setBookmarkSync = (enabled: boolean): void => {
  DB.put(db, "bookmarkSync", enabled);
};

/** Allow or forbid reading a site's own name when naming a link. */
export const setSiteTitle = (enabled: boolean): void => {
  DB.put(db, "siteTitle", enabled);
};

/** The proxy unnamed hosts are tried through first. Empty means direct. */
export const setLinkProxyFallback = (address: string): void => {
  DB.put(db, "linkProxyFallback", address.trim());
};

// Widget actions

/** Add a new widget, optionally where the plugin asks for it to go. */
export const addWidget = (key: string, position?: WidgetPosition): void => {
  const id = createId();
  const widgets = selectWidgets();
  const order = widgets.length > 0 ? widgets[widgets.length - 1].order + 1 : 0;
  DB.put(db, `widget/${id}`, {
    id,
    key,
    order,
    display: { position: position ?? "middleCentre" },
  });
};

/** Remove a widget */
export const removeWidget = (id: string): void => {
  DB.put(db, `widget/${id}`, null);
  DB.del(db, `data/${id}`);
  DB.del(cache, id);
};

/** Reorder a widget */
export const reorderWidget = (from: number, to: number): void => {
  const widgets = selectWidgets();
  widgets.splice(to, 0, widgets.splice(from, 1)[0]);
  widgets.forEach((widget, order) =>
    DB.put(db, `widget/${widget.id}`, { ...widget, order }),
  );
};

/** Set display properties of a widget */
export const setWidgetDisplay = (
  id: string,
  display: Partial<WidgetDisplay>,
) => {
  const widget = DB.get(db, `widget/${id}`);
  if (!widget) throw new Error("Widget not found while");
  DB.put(db, `widget/${id}`, {
    ...widget,
    display: { ...widget.display, ...display },
  });
};

// UI actions

/** Toggle dashboard focus mode */
export const toggleFocus = () => {
  DB.put(db, "focus", !DB.get(db, "focus"));
};

// Store actions

/**
 * 清空扩展存储里本应用的所有键（含 `key#N` 分片）。
 *
 * 只清内存数据库不够：分片键不在逻辑键列表里，导入后旧分片可能还留在
 * chrome.storage 上，下次启动拼回「新主键 + 旧分片」就会解析失败，
 * 表现为配置被叠加、界面崩掉。
 */
const clearStoredItems = async (): Promise<void> => {
  const area = (globalThis as Record<string, any>).browser?.storage?.sync;
  if (!area?.get || !area?.remove) return;
  const all: Record<string, unknown> = await area.get();
  const keys = Object.keys(all).filter((key) =>
    key.startsWith("huayuzhu/config/"),
  );
  if (keys.length > 0) await area.remove(keys);
};

/**
 * Import database from a dump.
 *
 * 语义是**整体覆盖**：先清空存储与内存，再写入导入值；同时把本机原有的
 * 分享私钥按指纹补回——导出文件按设计不含私钥，否则导入自己的备份会把
 * 分享密钥变成「只有公钥」的废状态。
 */
export const importStore = async (dump: any): Promise<void> => {
  if (typeof dump !== "object" || dump === null)
    throw new TypeError("Unexpected format");

  const localPrivate = selectShareConfig()
    .identities.filter((identity) => identity.privateKey)
    .map((identity) => ({
      fingerprint: identity.fingerprint,
      privateKey: identity.privateKey!,
    }));

  await clearStoredItems();
  resetStore();
  if ("backgrounds" in dump) {
    // Version 2 config
    DB.put(db, `widget/default-time`, null);
    DB.put(db, `widget/default-greeting`, null);
    dump = migrateFrom2(dump);
  } else if (dump.version === 3) {
    // Version 3 config
    delete dump.version;
  } else if (dump.version > 3) {
    // Future version
    throw new TypeError("设置文件来自更新版本的 花与竹标签");
  } else {
    // Unknown version
    throw new TypeError("Unknown settings version");
  }
  // @ts-ignore
  Object.entries(dump).forEach(([key, val]) => DB.put(db, key, val));

  // 把本机私钥补回同指纹的身份
  if (localPrivate.length > 0) {
    const imported = normalizeShareConfig(DB.get(db, "linkShare"));
    if (imported.identities.length > 0) {
      DB.put(db, "linkShare", {
        ...imported,
        identities: imported.identities.map((identity) => {
          const found = localPrivate.find(
            (item) => item.fingerprint === identity.fingerprint,
          );
          return found ? { ...identity, privateKey: found.privateKey } : identity;
        }),
      });
    }
  }
};

/** Export a database dump */
export const exportStore = (): string => {
  const values: Record<string, unknown> = Object.fromEntries(
    DB.prefix(db, ""),
  );
  // A settings file may be handed to someone else. Keep public identity data
  // for reference, but never include the private keys used for signing.
  if ("linkShare" in values)
    values.linkShare = sanitizeShareConfig(values.linkShare);
  return JSON.stringify({ ...values, version: 3 });
};

/**
 * Local persistence snapshot.
 *
 * `chrome.storage.sync` is already durable in a browser extension, but users
 * reasonably expect an explicit "persist" action. This keeps a full, raw copy
 * in `chrome.storage.local` — including share private keys that the exported
 * settings file deliberately omits — so an accidental reset can be undone.
 */
const PERSIST_KEY = "huayuzhu/persisted-config";

type PersistedSnapshot = {
  savedAt: string;
  values: Record<string, unknown>;
};

type LocalArea = {
  get: (key: string) => Promise<Record<string, PersistedSnapshot>>;
  set: (items: Record<string, PersistedSnapshot>) => Promise<void>;
};

const localArea = (): LocalArea | null => {
  const root = globalThis as Record<string, any>;
  const area = root.chrome?.storage?.local;
  return area?.get && area?.set ? area : null;
};

/** Save a local snapshot and return its timestamp. */
export const persistConfig = async (): Promise<string | null> => {
  const area = localArea();
  if (!area) return null;

  const savedAt = new Date().toISOString();
  const values = Object.fromEntries(DB.prefix(db, ""));
  await area.set({ [PERSIST_KEY]: { savedAt, values } });
  return savedAt;
};

/** Timestamp of the local snapshot, if one has been saved. */
export const readPersistedConfig = async (): Promise<string | null> => {
  const area = localArea();
  if (!area) return null;

  const result = await area.get(PERSIST_KEY);
  return result[PERSIST_KEY]?.savedAt ?? null;
};

/** Restore the local snapshot, including data stripped from file exports. */
export const restorePersistedConfig = async (): Promise<string | null> => {
  const area = localArea();
  if (!area) return null;

  const result = await area.get(PERSIST_KEY);
  const snapshot = result[PERSIST_KEY];
  if (!snapshot?.values) return null;

  clear(db);
  for (const [key, value] of Object.entries(snapshot.values))
    DB.put(db, key as any, value as any);
  return snapshot.savedAt;
};

/** Reset the database */
export const resetStore = (): void => {
  clear(db);
  clear(cache);
};

const clear = (db: DB.Database): void => {
  // @ts-ignore
  for (const [key] of DB.prefix(db, "")) DB.del(db, key);
};
