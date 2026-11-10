import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IntlProvider } from "react-intl";

import Display from "./Display";
import { ICON_CUSTOM, ICON_FAVICON } from "./types";

const render = (element: React.ReactElement) =>
  renderToStaticMarkup(
    <IntlProvider locale="en" messages={{}}>
      {element}
    </IntlProvider>,
  );

const base = {
  number: 1,
  linkOpenStyle: false,
  cache: {},
  onEdit: () => {},
};

describe("links/Display", () => {
  // When nothing is configured there is no destination, so it must not be a
  // real link at all: clicking it opens the configuration panel instead.
  describe("initial state", () => {
    const html = render(<Display {...base} />);

    it("should render as a button, never an anchor", () => {
      expect(html).toContain("<button");
      expect(html).not.toContain("<a ");
      expect(html).not.toContain("href");
    });

    it("should show a quiet slot marker rather than a wall of labels", () => {
      // A full page of empty cells shows plus signs, not repeated placeholder
      // text, so the grid stays readable.
      expect(html).toContain('<span class="LinkAdd"');
      expect(html).not.toContain("LinkName");
    });

    it("should be marked as unconfigured", () => {
      expect(html).toContain("Link--empty");
    });
  });

  it("should label a slot once it has a name but no address yet", () => {
    const html = render(<Display {...base} name="家里云" />);

    expect(html).toContain('<span class="LinkName">家里云</span>');
    // Still not a real link, because there is no destination.
    expect(html).not.toContain("<a ");
  });

  it("should become a real anchor once a url is set", () => {
    const html = render(<Display {...base} url="https://github.com" />);

    expect(html).toContain("href=\"https://github.com\"");
    expect(html).not.toContain("<button");
  });

  it("should show the short name on the homepage, not the full name", () => {
    const html = render(
      <Display
        {...base}
        url="https://github.com"
        name="GitHub - Where the world builds software"
        shortName="GitHub"
      />,
    );

    // The short name is what the visible label shows...
    expect(html).toContain('<span class="LinkName">GitHub</span>');
    // ...and the long title is confined to the popup, never the label.
    expect(html).not.toContain(
      '<span class="LinkName">GitHub - Where the world builds software</span>',
    );
  });

  it("should put the full name inside the hover popup", () => {
    const html = render(
      <Display
        {...base}
        url="https://github.com"
        name="GitHub - Where the world builds software"
        shortName="GitHub"
      />,
    );

    expect(html).toContain("LinkPopup");
    expect(html).toContain("GitHub - Where the world builds software");
    expect(html).toContain('role="tooltip"');
  });

  it("should derive a short name when none is configured", () => {
    const html = render(
      <Display
        {...base}
        url="https://github.com"
        name="GitHub - Where the world builds software"
      />,
    );

    expect(html).toContain('<span class="LinkName">GitHub</span>');
    // Still keeps the full name available in the popup.
    expect(html).toContain("GitHub - Where the world builds software");
  });

  it("should render the site favicon when auto reading is selected", () => {
    const html = render(
      <Display {...base} url="https://github.com/x" icon={ICON_FAVICON} />,
    );

    expect(html).toContain("https://github.com/favicon.ico");
    expect(html).toContain("<img");
  });

  it("should render an uploaded icon from the cache", () => {
    const html = render(
      <Display
        {...base}
        url="https://example.com"
        icon={ICON_CUSTOM}
        customIconId="abc123"
        cache={{ abc123: "data:image/png;base64,AAA" }}
      />,
    );

    expect(html).toContain("data:image/png;base64,AAA");
  });

  it("should fall back gracefully when a custom icon is missing", () => {
    const html = render(
      <Display
        {...base}
        url="https://example.com"
        icon={ICON_CUSTOM}
        customIconId="missing"
        cache={{}}
      />,
    );

    expect(html).not.toContain("<img");
  });

  it("should turn the popup inwards for a tile on the frame edge", () => {
    // The popup is clipped by the frame, so a top row tile drops it below and
    // a side column tile lines it up with that edge.
    const html = render(
      <Display {...base} placement={{ below: true, align: "start" }} />,
    );

    expect(html).toContain('class="LinkPopup is-below is-start"');
  });

  it("should leave a middle tile's popup centred and above", () => {
    const html = render(
      <Display {...base} placement={{ below: false, align: "centre" }} />,
    );

    expect(html).toContain('class="LinkPopup"');
  });

  it("should anchor the popup to the right edge on the last column", () => {
    const html = render(
      <Display {...base} placement={{ below: false, align: "end" }} />,
    );

    expect(html).toContain('class="LinkPopup is-end"');
  });

  it("should open in a new tab when configured", () => {
    const html = render(
      <Display {...base} linkOpenStyle={true} url="https://example.com" />,
    );

    expect(html).toContain('target="_blank"');
  });
});
