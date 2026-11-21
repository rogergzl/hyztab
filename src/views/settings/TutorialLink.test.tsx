import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import TutorialLink from "./TutorialLink";

describe("TutorialLink", () => {
  it("renders an offline tutorial entry in the settings sidebar", () => {
    const html = renderToStaticMarkup(<TutorialLink />);

    expect(html).toContain("使用教程");
    expect(html).toContain("打开教程");
    expect(html).toContain("class=\"button button--primary\"");
  });
});
