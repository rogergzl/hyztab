import { widgetDataKey } from "./widgets";

describe("widgetDataKey", () => {
  it("把组件元数据键换算为数据键", () => {
    expect(widgetDataKey("widget/abc123")).toBe("data/abc123");
  });

  it("保留带下划线或长 id 的键", () => {
    expect(widgetDataKey("widget/default_links-01")).toBe(
      "data/default_links-01",
    );
  });

  it("不是组件键时不重复加前缀", () => {
    expect(widgetDataKey("other/abc")).toBe("data/other/abc");
  });
});
