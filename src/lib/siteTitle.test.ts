import { titleFromHtml } from "./siteTitle";

describe("siteTitle/titleFromHtml()", () => {
  it("should read the title of a document", () => {
    expect(titleFromHtml("<head><title>Jellyfin</title></head>")).toBe(
      "Jellyfin",
    );
  });

  it("should accept attributes on the tag and any case", () => {
    expect(titleFromHtml('<TITLE lang="zh">家里云</TITLE>')).toBe("家里云");
  });

  it("should decode the entities a title commonly carries", () => {
    expect(titleFromHtml("<title>A &amp; B</title>")).toBe("A & B");
    expect(titleFromHtml("<title>Tom&#39;s NAS</title>")).toBe("Tom's NAS");
  });

  it("should collapse the whitespace a title is often written with", () => {
    expect(titleFromHtml("<title>\n  Jellyfin\n  Media Server \n</title>")).toBe(
      "Jellyfin Media Server",
    );
  });

  it("should return nothing when there is no usable title", () => {
    expect(titleFromHtml("<html><body>hi</body></html>")).toBeNull();
    expect(titleFromHtml("<title>   </title>")).toBeNull();
    expect(titleFromHtml("")).toBeNull();
  });

  it("should not be fooled by a title in the body", () => {
    // Only the first title element counts, which is the head's in practice.
    expect(titleFromHtml("<title>First</title><title>Second</title>")).toBe(
      "First",
    );
  });
});
