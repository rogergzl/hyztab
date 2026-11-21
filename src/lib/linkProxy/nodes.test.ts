import { normalizeProxyNodes, resolveProxyAddress } from "./nodes";

describe("lib/linkProxy/nodes", () => {
  it("should keep only valid nodes and fill a missing name", () => {
    const nodes = normalizeProxyNodes([
      { id: "a", name: "家里", address: "127.0.0.1:7890" },
      { id: "b", address: "socks5://127.0.0.1:1080" },
      { id: "c", address: "ftp://proxy.local:21" },
    ]);

    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toEqual({
      id: "a",
      name: "家里",
      address: "127.0.0.1:7890",
    });
    expect(nodes[1].name).toBe("socks5://127.0.0.1:1080");
  });

  it("should prefer a named node over the legacy inline address", () => {
    const nodes = normalizeProxyNodes([
      { id: "a", name: "A", address: "10.0.0.1:8080" },
    ]);

    expect(
      resolveProxyAddress({ nodeId: "a", address: "1.2.3.4:9999" }, nodes),
    ).toBe("10.0.0.1:8080");
  });

  it("should fall back to the inline address when the node was deleted", () => {
    expect(
      resolveProxyAddress(
        { nodeId: "gone", address: " 1.2.3.4:9999 " },
        [],
      ),
    ).toBe("1.2.3.4:9999");
    expect(resolveProxyAddress(undefined, [])).toBe("");
  });
});
