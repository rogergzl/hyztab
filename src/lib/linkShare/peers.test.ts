import { excludeLocalIdentities } from "./peers";
import { PublicIdentity } from "./types";

const peer = (fingerprint: string): PublicIdentity => ({
  id: fingerprint.slice(0, 4),
  name: fingerprint,
  fingerprint,
  publicKey: { kty: "EC" },
});

describe("excludeLocalIdentities", () => {
  it("剔除本机所有密钥，包括只有公钥的那把", () => {
    const peers = [peer("aaa"), peer("bbb"), peer("ccc")];
    const local = [{ fingerprint: "aaa" }, { fingerprint: "bbb" }];
    expect(excludeLocalIdentities(peers, local).map((p) => p.fingerprint)).toEqual([
      "ccc",
    ]);
  });

  it("本机没有密钥时原样返回", () => {
    const peers = [peer("aaa")];
    expect(excludeLocalIdentities(peers, [])).toHaveLength(1);
  });

  it("本机密钥都不在列表里时原样返回", () => {
    const peers = [peer("aaa")];
    expect(
      excludeLocalIdentities(peers, [{ fingerprint: "zzz" }]).map((p) => p.fingerprint),
    ).toEqual(["aaa"]);
  });
});
