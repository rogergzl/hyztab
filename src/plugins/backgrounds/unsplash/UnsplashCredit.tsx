import React from "react";
import { Icon } from "../../../views/shared";
import { Image } from "./types";

interface Props {
  credit: Image["credit"];
  paused: boolean;
  onPause: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
}

/**
 * Credit and controls for the current picture.
 *
 * The credit is whatever the source provided: a photographer on Unsplash, or
 * just the copyright line from a wallpaper feed. Nothing is attributed to a
 * service this picture did not come from.
 */
const UnsplashCredit: React.FC<Props> = ({
  credit,
  paused,
  onPause,
  onPrev,
  onNext,
}) => (
  <div className="credit">
    <div className="photo">
      {credit.userName ? (
        <a
          href={credit.imageLink}
          rel="noopener noreferrer"
          target="_blank"
          title={credit.userName}
        >
          {credit.userName}
        </a>
      ) : null}
    </div>

    <div className="controls">
      <a className={onPrev ? "" : "hidden"} onClick={onPrev ?? undefined}>
        <Icon name="arrow-left" />
      </a>{" "}
      <a onClick={onPause}>
        <Icon name={paused ? "play" : "pause"} />
      </a>{" "}
      <a className={onNext ? "" : "hidden"} onClick={onNext ?? undefined}>
        <Icon name="arrow-right" />
      </a>
    </div>

    <div className="location">{credit.location}</div>
  </div>
);

export default React.memo(UnsplashCredit);
