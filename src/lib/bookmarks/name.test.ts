import { fingerprint, nameKey } from "./name";

describe("bookmarks/name", () => {
  describe("nameKey()", () => {
    it("should fold case and surrounding space", () => {
      expect(nameKey("Steam 余额 ")).toBe("steam 余额");
      expect(nameKey("  GitHub  ")).toBe("github");
    });

    it("should collapse runs of whitespace", () => {
      // Runs collapse to a single space, which is kept: dropping it entirely
      // would merge genuinely different names.
      expect(nameKey("Steam   余额")).toBe(nameKey("Steam 余额"));
      expect(nameKey("Steam   余额")).toBe("steam 余额");
    });

    it("should fold full width characters", () => {
      // NFKC turns full width latin into ascii, so both spellings agree.
      expect(nameKey("Ｓｔｅａｍ")).toBe(nameKey("Steam"));
    });

    it("should treat a missing name as empty", () => {
      expect(nameKey(undefined)).toBe("");
      expect(nameKey("")).toBe("");
      expect(nameKey("   ")).toBe("");
    });
  });

  describe("fingerprint()", () => {
    const entries = (): Array<[string, string]> => [
      ["a", "https://a.com"],
      ["b", "https://b.com"],
    ];

    it("should be stable for the same input", () => {
      expect(fingerprint(entries())).toBe(fingerprint(entries()));
    });

    it("should notice a changed address", () => {
      const changed = entries();
      changed[1][1] = "https://c.com";
      expect(fingerprint(changed)).not.toBe(fingerprint(entries()));
    });

    it("should notice a changed name", () => {
      const changed = entries();
      changed[0][0] = "z";
      expect(fingerprint(changed)).not.toBe(fingerprint(entries()));
    });

    it("should notice a changed order", () => {
      // Order decides which slot a link lands in, so it has to show up.
      expect(fingerprint(entries().reverse())).not.toBe(fingerprint(entries()));
    });

    it("should notice a different number of links", () => {
      expect(fingerprint([])).not.toBe(fingerprint(entries()));
    });
  });
});
