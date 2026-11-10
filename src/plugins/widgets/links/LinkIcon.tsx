import React, { FC, useEffect, useState } from "react";

import { faviconUrls, usesCustomIcon, usesFavicon } from "./util";
import { Link } from "./types";

type Props = {
  cache: Record<string, string>;
  link: Link;
};

/**
 * Try each candidate favicon url in turn, falling back on load errors so a
 * site without a /favicon.ico still gets an icon from another source.
 */
const Favicon: FC<{ url?: string; sources: string[] }> = ({ url, sources }) => {
  const [index, setIndex] = useState(0);

  // Reset whenever the link changes so a new url starts from the first source.
  useEffect(() => setIndex(0), [url]);

  const source = sources[index];
  if (!source) return null;

  return (
    <i>
      <img
        alt=""
        draggable={false}
        src={source}
        onError={() => setIndex(index + 1)}
        referrerPolicy="no-referrer"
      />
    </i>
  );
};

/**
 * Renders the icon for a link.
 *
 * Only two kinds exist now: an uploaded image, or the icon read from the site.
 * A link with an address but no explicit choice falls back to the site icon.
 */
const LinkIcon: FC<Props> = ({ cache, link }) => {
  if (usesCustomIcon(link)) {
    const source = cache[link.customIconId!];
    return source ? (
      <i>
        <img alt="" draggable={false} src={source} />
      </i>
    ) : null;
  }

  if (usesFavicon(link)) {
    return <Favicon url={link.url} sources={faviconUrls(link.url)} />;
  }

  return null;
};

export default LinkIcon;
