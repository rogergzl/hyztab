import { canonicalRequest, fingerprintOfPublicKey, sha256Hex } from "./crypto";

describe("lib/linkShare/crypto", () => {
  it("should build a canonical request with a hashed body", async () => {
    const message = await canonicalRequest({
      method: "post",
      path: "/shares?recipient=abc",
      timestamp: "1234",
      nonce: "nonce",
      body: "{}",
    });

    expect(message).toBe(
      [
        "POST",
        "/shares?recipient=abc",
        "1234",
        "nonce",
        await sha256Hex("{}"),
      ].join("\n"),
    );
  });

  it("should fingerprint only the identifying JWK fields", async () => {
    const base = { kty: "EC", crv: "P-256", x: "xxx", y: "yyy" };
    const withExtras = { ...base, ext: true, key_ops: ["verify"] };

    expect(await fingerprintOfPublicKey(base)).toBe(
      await fingerprintOfPublicKey(withExtras),
    );
  });

  it("should reject an incomplete public key", async () => {
    await expect(
      fingerprintOfPublicKey({ kty: "EC", crv: "P-256", x: "xxx" }),
    ).rejects.toThrow("公钥格式不正确");
  });
});
