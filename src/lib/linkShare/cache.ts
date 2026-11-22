/**
 * 同组用户列表的轻量缓存。
 *
 * 扩展的新标签页每次打开都是全新的 JS 上下文，模块级变量留不住，所以
 * 「打开侧边栏」必然重新请求一次中转服务，加载完成前分享相关控件都不可用。
 *
 * 这里把最近一次结果写进 `chrome.storage.local`：下次打开先立刻渲染旧值，
 * 再在后台刷新（stale-while-revalidate）。缓存只在短时间内有效，成员变化
 * 会在下一次刷新自动纠正，不会长期出错。
 */

import { PublicIdentity } from "./types";

const CACHE_KEY = "huayuzhu/share-peer-cache";

/** 缓存有效期（毫秒）。成员变动不频繁，3 分钟足够减少绝大多数等待。 */
const TTL = 180_000;

/** 最多保留几个 scope，避免缓存无限增长。 */
const MAX_SCOPES = 5;

type Entry = { at: number; peers: PublicIdentity[] };
type CacheShape = Record<string, Entry>;

type StorageArea = {
  get: (key: string) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
};

const storageArea = (): StorageArea | null => {
  const root = globalThis as Record<string, any>;
  const area = root.chrome?.storage?.local ?? root.browser?.storage?.local;
  return area && typeof area.get === "function" ? (area as StorageArea) : null;
};

/** 读取缓存；过期或不存在时返回 null。 */
export const readPeerCache = async (
  scope: string,
): Promise<PublicIdentity[] | null> => {
  const area = storageArea();
  if (!area) return null;

  try {
    const stored = await area.get(CACHE_KEY);
    const cache = (stored?.[CACHE_KEY] ?? {}) as CacheShape;
    const entry = cache[scope];
    if (!entry || !Array.isArray(entry.peers)) return null;
    if (Date.now() - entry.at > TTL) return null;
    return entry.peers;
  } catch {
    // 读缓存失败只影响首屏速度，不影响功能，直接当作没有缓存。
    return null;
  }
};

/** 写入缓存；失败时静默忽略（缓存是优化项，不能影响主流程）。 */
export const writePeerCache = async (
  scope: string,
  peers: PublicIdentity[],
): Promise<void> => {
  const area = storageArea();
  if (!area) return;

  try {
    const stored = await area.get(CACHE_KEY);
    const cache = { ...((stored?.[CACHE_KEY] ?? {}) as CacheShape) };

    const keys = Object.keys(cache);
    if (!(scope in cache) && keys.length >= MAX_SCOPES) {
      // 淘汰最早写入的一条
      const oldest = keys.sort((a, b) => (cache[a]?.at ?? 0) - (cache[b]?.at ?? 0))[0];
      if (oldest) delete cache[oldest];
    }

    cache[scope] = { at: Date.now(), peers };
    await area.set({ [CACHE_KEY]: cache });
  } catch {
    // 同上：写缓存失败不影响功能。
  }
};
