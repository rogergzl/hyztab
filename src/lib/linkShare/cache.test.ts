import { readPeerCache, writePeerCache } from "./cache";
import { PublicIdentity } from "./types";

const peer = (fingerprint: string): PublicIdentity => ({
  id: fingerprint.slice(0, 4),
  name: fingerprint,
  fingerprint,
  publicKey: { kty: "EC" },
});

const installStorage = () => {
  const store: Record<string, unknown> = {};
  (globalThis as any).chrome = {
    storage: {
      local: {
        async get(key: string) {
          return key in store ? { [key]: store[key] } : {};
        },
        async set(items: Record<string, unknown>) {
          Object.assign(store, items);
        },
      },
    },
  };
  return store;
};

afterEach(() => {
  delete (globalThis as any).chrome;
  jest.restoreAllMocks();
});

describe("peer cache", () => {
  it("写入后可以读回", async () => {
    installStorage();
    await writePeerCache("peers|http://relay|aaa", [peer("aaa")]);
    await expect(readPeerCache("peers|http://relay|aaa")).resolves.toEqual([
      peer("aaa"),
    ]);
  });

  it("超过有效期后视为未命中", async () => {
    installStorage();
    await writePeerCache("scope", [peer("aaa")]);

    const later = Date.now() + 181_000;
    jest.spyOn(Date, "now").mockReturnValue(later);
    await expect(readPeerCache("scope")).resolves.toBeNull();
  });

  it("没有扩展存储时不报错", async () => {
    await expect(writePeerCache("scope", [peer("aaa")])).resolves.toBeUndefined();
    await expect(readPeerCache("scope")).resolves.toBeNull();
  });

  it("不同 scope 互不影响", async () => {
    installStorage();
    await writePeerCache("a", [peer("aaa")]);
    await writePeerCache("b", [peer("bbb")]);
    await expect(readPeerCache("a")).resolves.toEqual([peer("aaa")]);
    await expect(readPeerCache("b")).resolves.toEqual([peer("bbb")]);
  });
});
