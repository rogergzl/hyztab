import { collectRules, hostOf } from "./collect";
import { buildPacScript } from "./pac";

describe("hostOf()", () => {
  it("extracts a lower-cased hostname", () => {
    expect(hostOf("https://GitHub.com/rogergzl")).toBe("github.com");
  });

  it("returns null for missing or invalid urls", () => {
    expect(hostOf()).toBeNull();
    expect(hostOf("not a url")).toBeNull();
  });
});

describe("collectRules()", () => {
  it("only includes links that have both a url and a valid proxy", () => {
    const rules = collectRules([
      { url: "https://a.com", proxy: { address: "192.168.1.1:7893" } },
      { url: "https://b.com" },
      { url: "not a url", proxy: { address: "192.168.1.1:7893" } },
      { url: "https://c.com", proxy: { address: "bad::" } },
    ]);

    expect(rules).toEqual([
      {
        host: "a.com",
        server: { kind: "PROXY", host: "192.168.1.1", port: 7893 },
      },
    ]);
  });

  it("keeps the first rule when a host is configured twice", () => {
    const rules = collectRules([
      { url: "https://a.com", proxy: { address: "1.1.1.1:80" } },
      { url: "https://a.com/other", proxy: { address: "2.2.2.2:80" } },
    ]);

    expect(rules).toHaveLength(1);
    expect(rules[0].server.host).toBe("1.1.1.1");
  });
});

describe("buildPacScript()", () => {
  it("returns DIRECT alone when there are no rules", () => {
    const script = buildPacScript([]);
    expect(script).toContain('return "DIRECT";');
    expect(script).not.toContain("PROXY");
  });

  it("routes configured hosts and leaves everything else direct", () => {
    const script = buildPacScript(
      collectRules([
        { url: "https://github.com", proxy: { address: "192.168.1.91:7893" } },
        { url: "https://nas.local", proxy: { address: "socks5://127.0.0.1:1080" } },
      ]),
    );

    expect(script).toContain('host === "github.com"');
    expect(script).toContain('return "PROXY 192.168.1.91:7893"');
    expect(script).toContain('return "SOCKS5 127.0.0.1:1080"');
    expect(script).toContain('return "DIRECT";');
  });

  it("lower-cases hosts so matching is case-insensitive", () => {
    const script = buildPacScript([
      {
        host: "GitHub.COM",
        server: { kind: "PROXY", host: "p.local", port: 80 },
      },
    ]);
    expect(script).toContain('host === "github.com"');
  });
});
