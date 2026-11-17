import { isValidProxyAddress, parseProxyAddress, proxyToken } from "./parse";

describe("parseProxyAddress()", () => {
  it("reads a bare host:port as an HTTP proxy", () => {
    expect(parseProxyAddress("192.168.1.91:7893")).toEqual({
      kind: "PROXY",
      host: "192.168.1.91",
      port: 7893,
    });
  });

  it("reads explicit http and https schemes as a PAC HTTP proxy", () => {
    expect(parseProxyAddress("http://proxy.local:8080")).toEqual({
      kind: "PROXY",
      host: "proxy.local",
      port: 8080,
    });
    expect(parseProxyAddress("https://proxy.local:8443")?.kind).toBe("PROXY");
  });

  it("reads socks4 and socks5 schemes", () => {
    expect(parseProxyAddress("socks5://127.0.0.1:1080")).toEqual({
      kind: "SOCKS5",
      host: "127.0.0.1",
      port: 1080,
    });
    expect(parseProxyAddress("socks4://10.0.0.1:1080")?.kind).toBe("SOCKS4");
  });

  it("defaults to port 80 when none is given", () => {
    expect(parseProxyAddress("proxy.local")?.port).toBe(80);
  });

  it("accepts IPv6 in brackets, keeping them for the PAC token", () => {
    expect(parseProxyAddress("[::1]:1080")).toEqual({
      kind: "PROXY",
      host: "[::1]",
      port: 1080,
    });
  });

  it("normalises case and surrounding whitespace", () => {
    expect(parseProxyAddress("  HTTP://Proxy.LOCAL:8080  ")).toEqual({
      kind: "PROXY",
      host: "proxy.local",
      port: 8080,
    });
  });

  it("rejects empty, malformed, or out-of-range input", () => {
    expect(parseProxyAddress()).toBeNull();
    expect(parseProxyAddress("   ")).toBeNull();
    expect(parseProxyAddress("host:0")).toBeNull();
    expect(parseProxyAddress("host:70000")).toBeNull();
    expect(parseProxyAddress("host:abc")).toBeNull();
    expect(parseProxyAddress("ftp://host:21")).toBeNull();
    expect(parseProxyAddress("user@host:80")).toBeNull();
    expect(parseProxyAddress("host:80/path")).toEqual({
      kind: "PROXY",
      host: "host",
      port: 80,
    });
  });

  it("exposes validity for the editor", () => {
    expect(isValidProxyAddress("192.168.1.91:7893")).toBe(true);
    expect(isValidProxyAddress("nonsense::")).toBe(false);
  });
});

describe("proxyToken()", () => {
  it("formats the PAC return value", () => {
    expect(proxyToken({ kind: "PROXY", host: "p.local", port: 8080 })).toBe(
      "PROXY p.local:8080",
    );
    expect(proxyToken({ kind: "SOCKS5", host: "[::1]", port: 1080 })).toBe(
      "SOCKS5 [::1]:1080",
    );
  });
});
