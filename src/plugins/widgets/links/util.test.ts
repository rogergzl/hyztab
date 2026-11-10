import {
  displayNameOf,
  faviconUrls,
  getDomain,
  hasUrl,
  normalizeIcon,
  prettifyHost,
  shortNameFrom,
  usesCustomIcon,
  usesFavicon,
} from "./util";
import { ICON_CUSTOM, ICON_FAVICON, Link } from "./types";

describe("links/util", () => {
  describe("getDomain()", () => {
    it("should extract the hostname", () => {
      expect(getDomain("https://github.com/aphqsia")).toBe("github.com");
      expect(getDomain("https://www.google.com")).toBe("www.google.com");
    });

    it("should return null for unparsable urls", () => {
      expect(getDomain("https://")).toBeNull();
      expect(getDomain("")).toBeNull();
    });
  });

  describe("prettifyHost()", () => {
    it("should drop the www prefix and capitalise", () => {
      expect(prettifyHost("https://www.github.com/x")).toBe("Github");
      expect(prettifyHost("https://news.163.com")).toBe("News");
    });
  });

  describe("shortNameFrom()", () => {
    it("should prefer the leading segment of a long title", () => {
      expect(
        shortNameFrom("GitHub - Where the world builds software", "https://github.com"),
      ).toBe("GitHub");
      expect(
        shortNameFrom("哔哩哔哩 (゜-゜)つロ 干杯~", "https://www.bilibili.com"),
      ).toBe("哔哩哔哩");
    });

    it("should keep short names intact", () => {
      expect(shortNameFrom("Notion", "https://notion.so")).toBe("Notion");
    });

    it("should keep a short title whole rather than splitting it", () => {
      expect(shortNameFrom("哔哩哔哩 干杯~", "https://www.bilibili.com")).toBe(
        "哔哩哔哩 干杯~",
      );
    });

    it("should use the first word of a long title with no separator", () => {
      expect(
        shortNameFrom("哔哩哔哩 干杯~ bilibili 干杯", "https://www.bilibili.com"),
      ).toBe("哔哩哔哩");
    });

    it("should not split on a hyphen inside an emoticon", () => {
      // The hyphen in "(゜-゜)" is not a title separator.
      expect(shortNameFrom("A-(゜-゜)つ", "https://a.com")).toBe("A-(゜-゜)つ");
    });

    it("should truncate long single segment names", () => {
      const result = shortNameFrom(
        "AVeryLongSingleSegmentProductNameIndeed",
        "https://example.com",
      );
      expect(result).toHaveLength(13);
      expect(result.endsWith("…")).toBe(true);
    });

    it("should fall back to the host when no name is given", () => {
      expect(shortNameFrom(undefined, "https://www.bilibili.com")).toBe(
        "Bilibili",
      );
      expect(shortNameFrom("", "https://news.163.com")).toBe("News");
    });

    it("should return an empty string with nothing to work from", () => {
      expect(shortNameFrom()).toBe("");
    });
  });

  describe("faviconUrls()", () => {
    it("should try the site favicon first, then public services", () => {
      // No extension runtime in this environment, so the browser's own
      // favicon service is absent and the chain starts with the site.
      const sources = faviconUrls("https://github.com/aphqsia");
      expect(sources[0]).toBe("https://github.com/favicon.ico");
      expect(sources).toHaveLength(3);
    });

    it("should ask the browser's favicon service when one is available", () => {
      // The service knows the icon a site actually declares, which guessing
      // /favicon.ico cannot do.
      (globalThis as unknown as { browser: unknown }).browser = {
        runtime: {
          getURL: (path: string) => `chrome-extension://abc${path}`,
        },
      };

      try {
        const sources = faviconUrls("https://nas.example.com/app");

        expect(sources[0]).toContain("chrome-extension://abc/_favicon/");
        expect(sources[0]).toContain(
          encodeURIComponent("https://nas.example.com/app"),
        );
        expect(sources[0]).toContain("size=64");
        // The other sources stay as fallbacks behind it.
        expect(sources).toHaveLength(4);
      } finally {
        delete (globalThis as unknown as { browser?: unknown }).browser;
      }
    });

    it("should return nothing for invalid urls", () => {
      expect(faviconUrls("nonsense")).toEqual([]);
    });
  });

  describe("icon predicates", () => {
    it("should classify each icon kind", () => {
      const link = (icon: string, customIconId?: string): Link => ({
        url: "https://a.com",
        icon,
        customIconId,
      });

      expect(usesFavicon(link(ICON_FAVICON))).toBe(true);
      expect(usesCustomIcon(link(ICON_CUSTOM, "abc"))).toBe(true);

      // A custom icon without a stored image cannot be rendered.
      expect(usesCustomIcon(link(ICON_CUSTOM))).toBe(false);
    });

    it("should read the site icon when nothing was chosen", () => {
      // Links written before the icon setting existed have no icon field at
      // all; showing the site icon beats showing a blank cell.
      expect(usesFavicon({ url: "https://a.com" })).toBe(true);
      expect(usesFavicon({ url: "https://a.com", icon: "" })).toBe(true);
    });

    it("should not read a site icon without an address", () => {
      expect(usesFavicon({})).toBe(false);
      expect(usesFavicon({ url: "nonsense" })).toBe(false);
    });
  });

  describe("normalizeIcon()", () => {
    it("should adopt the favicon automatically once a url exists", () => {
      expect(normalizeIcon({ url: "https://github.com" })).toEqual({
        url: "https://github.com",
        icon: ICON_FAVICON,
      });
    });

    it("should show no icon while there is no url", () => {
      expect(normalizeIcon({})).toEqual({ icon: undefined });
    });

    it("should keep an uploaded icon even without a url", () => {
      expect(
        normalizeIcon({ icon: ICON_CUSTOM, customIconId: "abc" }),
      ).toEqual({ icon: ICON_CUSTOM, customIconId: "abc" });
    });

    it("should let the user choose the uploaded icon over the favicon", () => {
      expect(
        normalizeIcon({ url: "https://a.com", icon: ICON_CUSTOM, customIconId: "abc" }).icon,
      ).toBe(ICON_CUSTOM);
    });
  });

  describe("hasUrl()", () => {
    it("should only accept parsable destinations", () => {
      expect(hasUrl({ url: "https://github.com" })).toBe(true);
      expect(hasUrl({})).toBe(false);
      expect(hasUrl({ url: "nonsense" })).toBe(false);
    });
  });

  describe("displayNameOf()", () => {
    it("should use the short name when set", () => {
      expect(
        displayNameOf({
          url: "https://github.com",
          name: "GitHub - Where the world builds software",
          shortName: "GitHub",
        }),
      ).toBe("GitHub");
    });

    it("should derive a short name from the full name when unset", () => {
      expect(
        displayNameOf({
          url: "https://github.com",
          name: "GitHub - Where the world builds software",
        }),
      ).toBe("GitHub");
    });

    it("should never return the entire long title", () => {
      const name = "GitHub - Where the world builds software";
      expect(displayNameOf({ url: "https://github.com", name })).not.toBe(name);
    });

    it("should show a placeholder for a link with nothing configured", () => {
      expect(displayNameOf({})).toBe("新链接");
    });
  });
});
