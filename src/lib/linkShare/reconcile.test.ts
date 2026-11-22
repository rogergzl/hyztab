import { formatReconcileReport, reconcileIdentities } from "./reconcile";
import { PublicIdentity, ShareIdentity } from "./types";

const identity = (
  fingerprint: string,
  withKey = true,
): ShareIdentity => ({
  id: fingerprint.slice(0, 4),
  name: fingerprint,
  fingerprint,
  publicKey: { kty: "EC" },
  ...(withKey ? { privateKey: { kty: "EC" } } : {}),
});

const peer = (fingerprint: string): PublicIdentity => ({
  id: fingerprint.slice(0, 4),
  name: fingerprint,
  fingerprint,
  publicKey: { kty: "EC" },
});

describe("reconcileIdentities", () => {
  it("把本地有私钥的密钥补注册到云端", async () => {
    const registered: string[] = [];
    const report = await reconcileIdentities({
      local: [identity("aaa")],
      listPeers: async () => [peer("aaa")],
      register: async (item) => {
        registered.push(item.fingerprint);
        return peer(item.fingerprint);
      },
    });

    expect(report.registered).toBe(1);
    expect(registered).toEqual(["aaa"]);
    expect(report.onlyLocal).toEqual([]);
  });

  it("列出仅云端存在的身份（导入前就有、文件里没有）", async () => {
    const report = await reconcileIdentities({
      local: [identity("aaa")],
      listPeers: async () => [peer("aaa"), peer("bbb")],
      register: async (item) => peer(item.fingerprint),
    });

    expect(report.onlyRemote).toEqual(["bbb bbb"]);
  });

  it("注册失败时记录密钥名，不中断其它密钥", async () => {
    const report = await reconcileIdentities({
      local: [identity("aaa"), identity("bbb")],
      listPeers: async () => [],
      register: async (item) => {
        if (item.fingerprint === "aaa") throw new Error("403");
        return peer(item.fingerprint);
      },
    });

    expect(report.failed).toEqual(["aaa aaa"]);
    expect(report.registered).toBe(1);
  });

  it("没有带私钥的密钥时跳过", async () => {
    const report = await reconcileIdentities({
      local: [identity("aaa", false)],
      listPeers: async () => [],
      register: async () => peer("x"),
    });

    expect(report.skipped).toBeTruthy();
    expect(report.registered).toBe(0);
  });

  it("先补注册再拉列表：云端正缺这个密钥时仍能补回", async () => {
    const registered: string[] = [];
    let listed = false;
    const report = await reconcileIdentities({
      local: [identity("aaa")],
      // 模拟：只有注册过才允许拉取（未注册返回 403）
      listPeers: async () => {
        if (!listed) throw new Error("403 密钥尚未注册");
        return [peer("aaa")];
      },
      register: async (item) => {
        registered.push(item.fingerprint);
        listed = true;
        return peer(item.fingerprint);
      },
    });

    expect(registered).toEqual(["aaa"]);
    expect(report.registered).toBe(1);
    expect(report.skipped).toBeUndefined();
  });

  it("拉列表始终失败时仍报告补注册结果", async () => {
    const report = await reconcileIdentities({
      local: [identity("aaa")],
      listPeers: async () => {
        throw new Error("network");
      },
      register: async (item) => peer(item.fingerprint),
    });

    expect(report.registered).toBe(1);
    expect(report.skipped).toContain("无法读取云端身份");
  });
});

describe("formatReconcileReport", () => {
  it("没有差异也没有补注册时不打扰用户", () => {
    expect(
      formatReconcileReport({
        registered: 0,
        failed: [],
        onlyLocal: [],
        onlyRemote: [],
      }),
    ).toBeNull();
  });

  it("有差异时给出可读摘要", () => {
    const text = formatReconcileReport({
      registered: 2,
      failed: [],
      onlyLocal: ["甲 aaaa"],
      onlyRemote: ["乙 bbbb"],
    });
    expect(text).toContain("已补注册 2 个密钥");
    expect(text).toContain("仅本地");
    expect(text).toContain("仅云端");
  });
});
