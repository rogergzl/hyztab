import { directSources, withNonce } from "./sources";

describe("backgrounds/sources", () => {
  describe("withNonce()", () => {
    it("should add a changing parameter so the browser cannot reuse a reply", () => {
      // A random endpoint answers differently every time; without a changing
      // parameter the first reply would be served from cache instead.
      expect(withNonce("https://a.com/random", 3)).toBe(
        "https://a.com/random?_=3",
      );
    });

    it("should keep an existing query string", () => {
      expect(withNonce("https://a.com/random?lx=dongman", 2)).toContain(
        "lx=dongman",
      );
      expect(withNonce("https://a.com/random?lx=dongman", 2)).toContain("_=2");
    });

    it("should hand back an address it cannot parse", () => {
      // Better to try the raw string than to throw while rendering.
      expect(withNonce("not an address", 1)).toBe("not an address");
    });
  });

  describe("directSources()", () => {
    it("should leave the first entry as the plain address", () => {
      expect(directSources("https://a.com/random")[0]).toBe(
        "https://a.com/random",
      );
    });

    it("should give every later entry its own parameter", () => {
      const sources = directSources("https://a.com/random", 4);

      expect(sources).toHaveLength(4);
      expect(new Set(sources).size).toBe(4);
    });

    it("should default to a full set for the rotating cache", () => {
      expect(directSources("https://a.com/random")).toHaveLength(8);
    });
  });
});
