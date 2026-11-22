import { nanoid } from "nanoid";

import { DB } from "../lib";
import {
  LinkShare,
  LinkShareConfig,
  PausedShare,
  ReconcileReport,
  ShareIdentity,
  SharePayload,
  listIdentities,
  normalizeServiceUrl,
  reconcileIdentities,
  registerIdentity,
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

  const pausedShares: Record<string, PausedShare> = {};
  if (isRecord(raw.pausedShares)) {
    for (const [shareId, value] of Object.entries(raw.pausedShares)) {
      if (!isRecord(value) || typeof value.url !== "string") continue;
      if (typeof value.owner !== "string") continue;
      pausedShares[shareId] = value as unknown as PausedShare;
    }
  }

  return {
    serviceUrl:
      typeof raw.serviceUrl === "string" ? raw.serviceUrl.trim() : "",
    identities,
    autoAccept: {
      users: strings(rawAuto.users),
      groups: strings(rawAuto.groups),
    },
    pausedShares,
  };
};

/**
 * 导入备份后与云端校对：把本地带私钥的密钥补注册，并列出差异。
 *
 * 只补注册、不删除——删除是破坏性操作，留给用户手动确认。
 * 未配置服务或没有密钥时返回 null，调用方无需提示。
 */
export const reconcileShareIdentities = async (): Promise<ReconcileReport | null> => {
  const config = selectShareConfig();
  if (!config.serviceUrl || config.identities.length === 0) return null;

  let serviceUrl: string;
  try {
    serviceUrl = normalizeServiceUrl(config.serviceUrl);
  } catch {
    return null;
  }

  return reconcileIdentities({
    local: config.identities,
    listPeers: (viewer) => listIdentities(serviceUrl, viewer),
    // 不传分组：服务端会保留原有归属，只确保身份存在。
    register: (identity) => registerIdentity(serviceUrl, identity),
  });
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

/**
 * 暂停某个分享：把链接从网格里**整条移出**（不留空槽），内容暂存到配置。
 *
 * 与「移除」的区别：暂停保留内容，可随时恢复；移除是丢弃。
 */
export const pauseSharedLink = (shareId: string): boolean => {
  for (const [key, stored] of linksWidgets()) {
    const index = stored.links!.findIndex(
      (link) => link.share?.shareId === shareId,
    );
    if (index < 0) continue;

    const link = stored.links![index];
    const share = link.share!;
    const snapshot: PausedShare = {
      url: String(link.url ?? ""),
      ...(typeof link.name === "string" ? { name: link.name } : {}),
      ...(typeof link.shortName === "string" ? { shortName: link.shortName } : {}),
      ...(typeof link.icon === "string" ? { icon: link.icon } : {}),
      ...(link.proxy && typeof link.proxy === "object"
        ? { proxy: link.proxy as { address?: string } }
        : {}),
      owner: share.owner,
      serviceUrl: share.serviceUrl,
      recipient: share.recipient,
      index,
      pausedAt: Date.now(),
    };

    // 只清空这一格，不移除数组元素：后面的链接保持原位，布局不受影响。
    const links = stored.links!.map((item, i) =>
      i === index ? (typeof item.id === "string" ? { id: item.id } : {}) : item,
    );
    DB.put(db, key, { ...stored, links });

    const config = selectShareConfig();
    DB.put(db, "linkShare", {
      ...config,
      pausedShares: { ...config.pausedShares, [shareId]: snapshot },
    });
    return true;
  }

  return false;
};

/** 恢复暂停的分享：重新写回第一个空槽（没有空槽就追加）。 */
export const resumeSharedLink = (shareId: string): boolean => {
  const config = selectShareConfig();
  const snapshot = config.pausedShares[shareId];
  if (!snapshot) return false;

  // 原槽位还空着就写回原位，保持布局；否则由 addSharedLink 找空槽。
  const widgets = linksWidgets();
  const preferred = widgets[0];
  const keepIndex =
    typeof snapshot.index === "number" &&
    preferred &&
    snapshot.index < preferred[1].links!.length &&
    !hasUrl(preferred[1].links![snapshot.index]);

  if (keepIndex && preferred) {
    const [key, stored] = preferred;
    const links = [...stored.links!];
    links[snapshot.index!] = payloadToLink(links[snapshot.index!] ?? {}, {
      url: snapshot.url,
      name: snapshot.name,
      shortName: snapshot.shortName,
      icon: snapshot.icon,
      proxy: snapshot.proxy,
      updatedAt: snapshot.pausedAt,
    }, {
      shareId,
      serviceUrl: snapshot.serviceUrl,
      owner: snapshot.owner,
      recipients: [],
      recipient: snapshot.recipient,
      applyConfig: true,
      updatedAt: snapshot.pausedAt,
    });
    DB.put(db, key, { ...stored, links });

    const { [shareId]: _done, ...rest } = config.pausedShares;
    void _done;
    DB.put(db, "linkShare", { ...config, pausedShares: rest });
    return true;
  }

  const restored = addSharedLink(
    {
      url: snapshot.url,
      name: snapshot.name,
      shortName: snapshot.shortName,
      icon: snapshot.icon,
      proxy: snapshot.proxy,
      updatedAt: snapshot.pausedAt,
    },
    {
      shareId,
      serviceUrl: snapshot.serviceUrl,
      owner: snapshot.owner,
      recipients: [],
      recipient: snapshot.recipient,
      applyConfig: true,
      updatedAt: snapshot.pausedAt,
    },
    true,
  );
  if (!restored) return false;

  const { [shareId]: _removed, ...rest } = config.pausedShares;
  void _removed;
  DB.put(db, "linkShare", { ...config, pausedShares: rest });
  return true;
};

/** 彻底丢弃暂停中的记录（不可恢复）。 */
export const discardPausedShare = (shareId: string): boolean => {
  const config = selectShareConfig();
  if (!config.pausedShares[shareId]) return false;
  const { [shareId]: _removed, ...rest } = config.pausedShares;
  void _removed;
  DB.put(db, "linkShare", { ...config, pausedShares: rest });
  return true;
};

/** 该分享是否处于暂停状态。 */
export const isSharePaused = (shareId: string): boolean =>
  Boolean(selectShareConfig().pausedShares[shareId]);

/** 把某个分享对应的链接从网格中移除（槽位保留为空格）。返回移除数量。 */
export const removeSharedLink = (shareId: string): number => {
  let removed = 0;

  for (const [key, stored] of linksWidgets()) {
    const links = stored.links!;
    let changed = 0;
    const next = links.map((link) => {
      if (link.share?.shareId !== shareId) return link;
      changed += 1;
      // 保留槽位与内部 id，只清空内容，避免后面的格子整体前移。
      return typeof link.id === "string" ? { id: link.id } : {};
    });
    if (changed > 0) {
      DB.put(db, key, { ...stored, links: next });
      removed += changed;
    }
  }

  return removed;
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
