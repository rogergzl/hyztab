import {
  ITEM_LIMIT,
  byteLength,
  encodeValue,
  joinParts,
  partCount,
  partIndexOf,
  partOwner,
  partsComplete,
} from "./chunks";

/** The size the platform measures an item by: key length plus encoded value. */
const itemSize = (key: string, value: unknown): number =>
  byteLength(key) + byteLength(JSON.stringify(value) ?? "null");

/** Validate the shape produced by encodeValue and rebuild the value from it. */
const roundTrip = (fullKey: string, value: unknown): unknown => {
  const { updates, count } = encodeValue(fullKey, value);

  Object.entries(updates).forEach(([key, written]) => {
    expect(itemSize(key, written)).toBeLessThanOrEqual(ITEM_LIMIT);
  });

  if (count === 0) {
    expect(updates[fullKey]).toEqual(value);
    return value;
  }

  expect(partCount(updates[fullKey])).toBe(count);
  const parts = Array.from(
    { length: count },
    (_, index) => updates[`${fullKey}#${index}`] as string,
  );
  expect(parts.every((part) => typeof part === "string")).toBe(true);
  return joinParts(parts);
};

describe("lib/db/chunks", () => {
  describe("byteLength()", () => {
    it("should count bytes rather than characters", () => {
      expect(byteLength("abc")).toBe(3);
      // Chinese characters take three bytes each in UTF-8.
      expect(byteLength("家里云")).toBe(9);
    });
  });

  describe("part key helpers", () => {
    it("should recognise part keys and their owner", () => {
      expect(partIndexOf("data/abc#3")).toBe(3);
      expect(partOwner("data/abc#3")).toBe("data/abc");

      expect(partIndexOf("data/abc")).toBeNull();
      // A hash inside a value is not a part marker.
      expect(partIndexOf("data/a#b")).toBeNull();
    });
  });

  describe("partCount()", () => {
    it("should read the declared part count", () => {
      expect(partCount({ __parts: 4 })).toBe(4);
    });

    it("should ignore anything that is not a split manifest", () => {
      expect(partCount(null)).toBe(0);
      expect(partCount("text")).toBe(0);
      expect(partCount({ url: "https://example.com" })).toBe(0);
      // A single item is never stored as a manifest.
      expect(partCount({ __parts: 1 })).toBe(0);
    });
  });

  describe("partsComplete()", () => {
    it("should require every part to be present", () => {
      expect(partsComplete(["a", "b"], 2)).toBe(true);
      expect(partsComplete(["a"], 2)).toBe(false);
      // A hole in the middle is incomplete even when the length matches.
      expect(partsComplete(["a", undefined as unknown as string], 2)).toBe(false);
    });
  });

  describe("encodeValue()", () => {
    it("should keep a small value as a single item", () => {
      const value = { rows: 3, columns: 4, links: [{ url: "https://a.com" }] };
      const { updates, count } = encodeValue("huayuzhu/config/data/a", value);

      expect(count).toBe(0);
      expect(updates).toEqual({ "huayuzhu/config/data/a": value });
    });

    it("should split a value that would exceed the item limit", () => {
      const value = {
        links: Array.from({ length: 80 }, (_, index) => ({
          url: `https://nas.example.com/service/${index}`,
          name: `家里云服务 ${index} — 一个相当长的中文网页标题`,
          shortName: `家里云${index}`,
          icon: "_favicon",
        })),
      };
      const fullKey = "huayuzhu/config/data/links";

      // The plain payload really is too big, which is why the split matters.
      expect(byteLength(JSON.stringify(value))).toBeGreaterThan(ITEM_LIMIT);

      expect(roundTrip(fullKey, value)).toEqual(value);
    });

    it("should measure a part by its stored size, not its raw size", () => {
      // Parts hold raw JSON text, which is dense with quotes that the platform
      // escapes again. Measuring the raw size understates the real item size.
      expect(byteLength('a"')).toBe(2);
      // Escaping the quote plus the two surrounding quotes makes it five.
      expect(byteLength(JSON.stringify('a"'))).toBe(5);

      const value = { blob: 'a"'.repeat(6000) };
      const fullKey = "huayuzhu/config/data/quoted";

      const { updates, count } = encodeValue(fullKey, value);
      expect(count).toBeGreaterThan(1);

      Object.entries(updates).forEach(([key, written]) => {
        expect(itemSize(key, written)).toBeLessThanOrEqual(ITEM_LIMIT);
      });
    });

    it("should round trip payloads made of multi byte text", () => {
      const value = {
        links: Array.from({ length: 60 }, (_, index) => ({
          name: `家里云 ${index} — 一个很长的中文网页标题`,
          shortName: `家里云${index}`,
          url: `https://nas.example.com/${index}`,
        })),
      };

      expect(roundTrip("huayuzhu/config/data/links", value)).toEqual(value);
    });

    it("should keep every part inside the limit for a very large value", () => {
      const value = { blob: "x".repeat(50000) };
      const { count } = encodeValue("huayuzhu/config/data/big", value);

      expect(count).toBeGreaterThan(1);
      expect(roundTrip("huayuzhu/config/data/big", value)).toEqual(value);
    });
  });
});
