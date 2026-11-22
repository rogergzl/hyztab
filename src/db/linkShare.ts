import { nanoid } from "nanoid";

import { DB } from "../lib";
import {
  LinkShare,
  LinkShareConfig,
  ShareIdentity,
  SharePayload,
  widgetDataKey,
} from "../lib/linkShare";
import { db, WidgetState } from "./state";

/**
 * Authoritative access to link sharing state.
 *
 * The links themselves live in widget data, so this module is the only place
 * that knows how to locate a links widget and write a received link into it.
 */

const LINKS_KEY = "widget/links";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

type StoredLink = Record<string, unknown> & { share?: LinkShare };
type StoredLinks = {
  links?: StoredLink[];
  visible?: boolean;
  linkOpenStyle?: boolean;
};

const isJwk = (value: unknown): value is JsonWebKey =>
  isRecord(value) && typeof value.kty === "string";

const normalizeIdentity = (value: unknown): ShareIdentity | null => {
  if (!isRecord(value)) return null;
  const { id, name, fingerprint, publicKey, privateKey, groupId, groupName } = value;
  if (
    typeof id !== "string" ||
    typeof fingerprint !== "string" ||
    !isJwk(publicKey)
  )
    return null;

  return {
    id,
    name: typeof name === "string" && name.trim() ? name.trim() : "未命名密钥",
    fingerprint,
    publicKey,
    ...(typeof groupId === "string" && groupId ? { groupId } : {}),
    ...(typeof groupName === "string" && groupName ? { groupName } : {}),
    ...(isJwk(privateKey) ? { privateKey } : {}),
  };
};

/** Normalize stored/imported configuration at the middle-layer boundary. */
export const normalizeShareConfig = (value: unknown): LinkShareConfig => {
  const raw = isRecord(value) ? value : {};
  const identities: ShareIdentity[] = [];
  const seen = new Set<string>();

  if (Array.isArray(raw.identities)) {
    for (const item of raw.identities) {
      const identity = normalizeIdentity(item);
      if (!identity || seen.has(identity.fingerprint)) continue;
      seen.add(identity.fingerprint);
      identities.push(identity);
    }
  }

  const rawAuto = isRecord(raw.autoAccept) ? raw.autoAccept : {};
  const strings = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

  return {
    serviceUrl:
      typeof raw.serviceUrl === "string" ? raw.serviceUrl.trim() : "",
    identities,
    autoAccept: {
      users: strings(rawAuto.users),
      groups: strings(rawAuto.groups),
    },
  };
};

/** Read the sharing configuration through the database middle layer. */
export const selectShareConfig = (): LinkShareConfig =>
  normalizeShareConfig(DB.get(db, "linkShare"));

/** Change the relay address. Host permission is requested by the settings UI. */
export const setShareServiceUrl = (url: string): void => {
  const config = selectShareConfig();
  DB.put(db, "linkShare", { ...config, serviceUrl: url.trim() });
};

/** Add a local identity, ignoring a key that is already configured. */
export const addShareIdentity = (identity: ShareIdentity): boolean => {
  const config = selectShareConfig();
  if (config.identities.some((item) => item.fingerprint === identity.fingerprint))
    return false;

  DB.put(db, "linkShare", {
    ...config,
    identities: [...config.identities, identity],
  });
  return true;
};

/** 更新自动接受规则。 */
export const setAutoAccept = (next: { users?: string[]; groups?: string[] }): void => {
  const config = selectShareConfig();
  DB.put(db, "linkShare", {
    ...config,
    autoAccept: {
      users: next.users ?? config.autoAccept.users,
      groups: next.groups ?? config.autoAccept.groups,
    },
  });
};

/** 注册/改分组后，把服务端返回的分组信息写回本地身份。 */
export const updateIdentityMeta = (
  id: string,
  meta: { name?: string; groupId?: string | null; groupName?: string },
): void => {
  const config = selectShareConfig();
  DB.put(db, "linkShare", {
    ...config,
    identities: config.identities.map((identity) =>
      identity.id === id ? { ...identity, ...meta } : identity,
    ),
  });
};

/** Remove a local identity. Shares already added to links stay untouched. */
export const removeShareIdentity = (id: string): void => {
  const config = selectShareConfig();
  DB.put(db, "linkShare", {
    ...config,
    identities: config.identities.filter((identity) => identity.id !== id),
  });
};

/**
 * Exportable configuration. Private keys are deliberately removed: a settings
 * file may be sent to another person and must never carry signing material.
 */
export const sanitizeShareConfig = (value: unknown): LinkShareConfig => {
  const config = normalizeShareConfig(value);
  return {
    ...config,
    identities: config.identities.map(({ privateKey, ...publicIdentity }) => {
      void privateKey;
      return publicIdentity;
    }),
  };
};

const linksWidgets = (): Array<[`data/${string}`, StoredLinks]> => {
  const widgets = Array.from(DB.prefix(db, "widget/"))
    .map(([key, value]): [string, WidgetState | null] => [
      key,
      value as WidgetState | null,
    ])
    .filter(([, value]) => Boolean(value) && value?.key === LINKS_KEY)
    .sort(([, a], [, b]) => (a?.order ?? 0) - (b?.order ?? 0));

  const result: Array<[`data/${string}`, StoredLinks]> = [];
  for (const [key] of widgets) {
    // 组件元数据键是 `widget/<id>`，数据键是 `data/<id>`；
    // 换算错会让 DB.get 静默返回 undefined（见 widgets.ts 注释）。
    const dataKey = widgetDataKey(key);
    const stored = DB.get(db, dataKey) as StoredLinks | undefined;
    if (stored && Array.isArray(stored.links))
      result.push([dataKey, stored]);
  }
  return result;
};

const hasUrl = (link: StoredLink): boolean =>
  typeof link.url === "string" && link.url.trim().length > 0;

const payloadToLink = (
  base: StoredLink,
  payload: SharePayload,
  share: LinkShare,
): StoredLink => {
  const baseLink: StoredLink = {
    ...base,
    id: typeof base.id === "string" ? base.id : nanoid(12),
    url: payload.url,
    share,
  };

  // 接收方选择「只添加网址」时，不采纳对方的名称 / 图标 / 代理。
  if (share.applyConfig === false) {
    return {
      ...baseLink,
      name: undefined,
      shortName: undefined,
      icon: "_favicon",
      proxy: undefined,
    };
  }

  return {
    ...baseLink,
    name: payload.name,
    shortName: payload.shortName,
    icon: payload.icon ?? "_favicon",
    // A proxy node id has no meaning on the receiver's device; only the
    // resolved address is shared, and it stays an ordinary inline address.
    proxy: payload.proxy?.address ? { address: payload.proxy.address } : undefined,
  };
};

/**
 * Add a received share to the first quick links widget, filling the first free
 * slot when one exists. Returns false when no links widget is available.
 */
export const addSharedLink = (
  payload: SharePayload,
  share: LinkShare,
  applyConfig = true,
): boolean => {
  const widgets = linksWidgets();
  if (widgets.length === 0) return false;

  const [key, stored] = widgets[0];
  const links = [...stored.links!];
  const index = links.findIndex((link) => !hasUrl(link));
  const target = index < 0 ? links.length : index;
  links[target] = payloadToLink(links[target] ?? {}, payload, {
    ...share,
    applyConfig,
  });

  DB.put(db, key, { ...stored, links });
  return true;
};

/** True when a share has already been added to any links widget. */
export const hasSharedLink = (shareId: string): boolean =>
  linksWidgets().some(([, stored]) =>
    stored.links!.some((link) => link.share?.shareId === shareId),
  );

/** Apply a fetched payload to every local copy of that share. */
export const updateSharedLinks = (
  shareId: string,
  payload: SharePayload,
): number => {
  let updated = 0;

  for (const [key, stored] of linksWidgets()) {
    let changed = 0;
    const links = stored.links!.map((link) => {
      if (link.share?.shareId !== shareId) return link;
      changed += 1;
      return payloadToLink(link, payload, {
        ...link.share,
        applyConfig: link.share.applyConfig !== false,
        updatedAt: payload.updatedAt,
      });
    });
    if (changed > 0) {
      DB.put(db, key, { ...stored, links });
      updated += changed;
    }
  }

  return updated;
};
