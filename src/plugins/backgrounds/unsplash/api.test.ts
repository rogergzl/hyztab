import { buildLink, calculateWidth } from "./api";

describe("unsplash/api", () => {
  it("should calculate width for screen", () => {
    expect(calculateWidth()).toBe(1920);
    expect(calculateWidth(1920)).toBe(1920);
    expect(calculateWidth(2000)).toBe(2160);
    expect(calculateWidth(5000)).toBe(3840);
  });

  it("should consider pixel ratio", () => {
    expect(calculateWidth(1000, 2)).toBe(2160);
  });

  it("should leave a ready to use address alone", () => {
    // Only Unsplash resizes through parameters; rewriting a wallpaper or a
    // custom address would break it.
    const bing = "https://cn.bing.com/th?id=OHR.X_1920x1080.jpg";
    expect(buildLink(bing, "bing")).toBe(bing);
    expect(buildLink("https://a.com/random", "custom")).toBe(
      "https://a.com/random",
    );
  });
});
