import React, { FC, useMemo } from "react";
import { defineMessages, useIntl } from "react-intl";

import LinkIcon from "./LinkIcon";
import { displayNameOf, displayUrl, fullNameOf, hasUrl } from "./util";
import { Link, LinkPlacement } from "./types";

const messages = defineMessages({
  shortcutHint: {
    id: "plugins.links.shortcutHint",
    description: "Hover hint text for links with a keyboard shortcut",
    defaultMessage: "Press {number} or click to visit",
  },
  standardHint: {
    id: "plugins.links.standardHint",
    description: "Hover hint text for links without a keyboard shortcut",
    defaultMessage: "Click to visit",
  },
  configureHint: {
    id: "plugins.links.configureHint",
    description: "Hover hint text for links that have no url yet",
    defaultMessage: "Click to configure this link",
  },
});

type Props = Link & {
  number: number;
  linkOpenStyle: boolean;
  cache: Record<string, string>;
  onEdit: () => void;
  /** Position in the grid, used to keep the popup inside the frame. */
  placement?: LinkPlacement;
  /** Absolute slot this tile occupies, so a drag can tell where it started. */
  slot?: number;
};

const Display: FC<Props> = (props) => {
  const intl = useIntl();
  const { cache, linkOpenStyle, number, onEdit, placement } = props;

  // A link without a destination is text only, and completing it is exactly
  // what a click should do.
  const configured = hasUrl(props);

  const shortName = displayNameOf(props);
  const fullName = fullNameOf(props);

  const hint = useMemo(() => {
    if (!configured) return intl.formatMessage(messages.configureHint);
    return number < 10
      ? intl.formatMessage(messages.shortcutHint, { number })
      : intl.formatMessage(messages.standardHint);
  }, [configured, intl, number]);

  const openEditor = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onEdit();
  };

  // A slot with nothing in it at all shows a single centred plus where the
  // icon will go, rather than a plus below an empty icon box.
  const blank =
    !configured &&
    !(props.name ?? "").trim() &&
    !(props.shortName ?? "").trim();

  // The popup is clipped by the frame the pages slide inside, so a tile on the
  // top row shows it underneath and an edge tile lines it up with that edge.
  const popupClass = [
    "LinkPopup",
    placement?.below ? "is-below" : "",
    placement?.align === "start" ? "is-start" : "",
    placement?.align === "end" ? "is-end" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // The short name is what stays on screen; the full name lives in the popup.
  const body = (
    <>
      <span className="LinkBody">
        {blank ? (
          <span className="LinkAdd" aria-hidden="true">
            +
          </span>
        ) : (
          <>
            <span className="LinkIcon">
              <LinkIcon cache={cache} link={props} />
            </span>
            <span className="LinkName">{shortName}</span>
          </>
        )}
      </span>

      <span className={popupClass} role="tooltip">
        <span className="LinkPopupName">{fullName}</span>
        {configured && (
          <span className="LinkPopupUrl">{displayUrl(props.url)}</span>
        )}
        <span className="LinkPopupHint">{hint}</span>
      </span>
    </>
  );

  if (!configured) {
    return (
      <button
        className="Link Link--empty"
        type="button"
        draggable={false}
        data-slot={props.slot}
        onClick={openEditor}
        onContextMenu={openEditor}
      >
        {body}
      </button>
    );
  }

  return (
    <a
      className="Link"
      href={props.url}
      rel="noopener noreferrer"
      target={linkOpenStyle ? "_blank" : "_self"}
      // Set explicitly: an anchor is draggable by default, and a native drag
      // would swallow the pointer moves a tile move depends on.
      draggable={false}
      data-slot={props.slot}
      onContextMenu={openEditor}
    >
      {body}
    </a>
  );
};

export default Display;
