import { byteLength } from "./chunks";
import * as DB from "./db";
import { extension } from "./storage";

type Store = Record<string, unknown>;

/** The platform's own per item ceiling, which the budget must stay under. */
const PLATFORM_LIMIT = 8192;

/**
 * Stand in for chrome.storage.sync, enforcing the same per item quota that
 * makes an oversized value lose the whole `set()` call.
 */
const createArea = (initial: Store = {}) => {
  const data: Store = { ...initial };
  const failures: string[] = [];

  return {
    data,
    failures,
    async get() {
      return { ...data };
    },
    async set(items: Store) {
      for (const [key, value] of Object.entries(items)) {
        const size =
          byteLength(key) + byteLength(JSON.stringify(value) ?? "null");
        if (size > PLATFORM_LIMIT) {
          failures.push(key);
          throw new Error("QUOTA_BYTES_PER_ITEM quota exceeded");
        }
      }
      Object.assign(data, items);
    },
    async remove(keys: string[]) {
      keys.forEach((key) => {
        delete data[key];
      });
    },
  };
};

/** The write path batches changes onto a zero delay timer. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 5));

const bigLinks = (count: number) => ({
  rows: 3,
  columns: 4,
  visible: true,
  linkOpenStyle: false,
  links: Array.from({ length: count }, (_, index) => ({
    url: `https://nas.example.com/service/${index}`,
    name: `家里云服务 ${index} — 一个相当长的中文网页标题`,
    shortName: `家里云${index}`,
    icon: "_favicon",
  })),
});

beforeEach(() => {
  (globalThis as unknown as { DEV: boolean }).DEV = false;
  (globalThis as unknown as { window: unknown }).window = {
    addEventListener: () => undefined,
  };
});

/** Boot a database against the given area, as the app does at start up. */
const open = async (area: unknown) => {
  (globalThis as unknown as { browser: unknown }).browser = {
    storage: { sync: area },
  };
  const db = DB.init<Record<string, unknown | undefined>>();
  await extension(db, "huayuzhu/config", "sync");
  return db;
};

describe("lib/db/storage extension provider", () => {
  it("should reject an oversized single item, proving the risk is real", async () => {
    const area = createArea();
    await open(area);

    const value = bigLinks(80);
    expect(byteLength(JSON.stringify(value))).toBeGreaterThan(PLATFORM_LIMIT);

    // Written directly, the platform refuses it.
    await expect(
      area.set({ "huayuzhu/config/data/links": value }),
    ).rejects.toThrow();
  });

  it("should save and reload a payload too large for one item", async () => {
    const area = createArea();
    const first = await open(area);
    const value = bigLinks(80);

    DB.put(first, "data/links", value);
    await flush();

    expect(area.failures).toEqual([]);

    // The value no longer fits in a single item, so it was split.
    const stored = area.data["huayuzhu/config/data/links"] as {
      __parts?: number;
    };
    expect(stored.__parts).toBeGreaterThan(1);
    expect(area.data["huayuzhu/config/data/links#0"]).toEqual(expect.any(String));

    // A fresh session reads it back whole.
    const second = await open(area);
    expect(DB.get(second, "data/links")).toEqual(value);
  });

  it("should keep a small value as a single item", async () => {
    const area = createArea();
    const db = await open(area);
    const value = { rows: 3, columns: 4, links: [{ url: "https://a.com" }] };

    DB.put(db, "widget/abc", value);
    await flush();

    expect(area.data["huayuzhu/config/widget/abc"]).toEqual(value);
    expect(area.data["huayuzhu/config/widget/abc#0"]).toBeUndefined();
  });

  it("should clear leftover parts when a value shrinks", async () => {
    const area = createArea();
    const db = await open(area);

    DB.put(db, "data/links", bigLinks(120));
    await flush();
    const grown = (
      area.data["huayuzhu/config/data/links"] as { __parts: number }
    ).__parts;
    expect(grown).toBeGreaterThan(1);

    DB.put(db, "data/links", { links: [{ url: "https://a.com" }] });
    await flush();

    expect(area.data["huayuzhu/config/data/links"]).toEqual({
      links: [{ url: "https://a.com" }],
    });
    for (let index = 0; index < grown; index += 1)
      expect(area.data[`huayuzhu/config/data/links#${index}`]).toBeUndefined();
  });

  it("should remove a split value and all of its parts", async () => {
    const area = createArea();
    const db = await open(area);

    DB.put(db, "data/links", bigLinks(120));
    await flush();

    DB.del(db, "data/links");
    await flush();

    const leftovers = Object.keys(area.data).filter((key) =>
      key.startsWith("huayuzhu/config/data/links"),
    );
    expect(leftovers).toEqual([]);

    const second = await open(area);
    expect(DB.get(second, "data/links")).toBeUndefined();
  });

  it("should ignore a value whose parts did not all arrive", async () => {
    // Simulates a sync that was interrupted half way through.
    const area = createArea({
      "huayuzhu/config/data/links": { __parts: 3 },
      "huayuzhu/config/data/links#0": '[{"url":"https://a.com"',
      "huayuzhu/config/data/links#1": "}]",
    });

    const db = await open(area);
    expect(DB.get(db, "data/links")).toBeUndefined();
  });

  it("should not touch keys belonging to another prefix", async () => {
    const area = createArea({
      "huayuzhu/cache/other": { keep: true },
      "huayuzhu/config/settings": { keep: true },
    });

    const db = await open(area);
    expect(DB.get(db, "settings")).toEqual({ keep: true });
    expect(DB.get(db, "other")).toBeUndefined();
  });
});
