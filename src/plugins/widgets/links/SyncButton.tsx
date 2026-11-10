import React from "react";
import { Icon } from "../../../views/shared";
import { BookmarkSyncStatus } from "./useBookmarkSync";

/**
 * The manual sync entry point, sitting with the pager controls.
 *
 * It spins slowly and stays faded so it reads as a background detail rather
 * than a primary action. Hovering tells you whether anything is waiting,
 * because the only thing it does is delete bookmarks whose links are gone.
 */
const SyncButton: React.FC<{ status: BookmarkSyncStatus }> = ({ status }) => (
  <button
    type="button"
    className={`LinkSync ${status.busy ? "is-busy" : ""} ${
      status.pending > 0 ? "is-pending" : ""
    }`}
    title={status.note}
    aria-label={status.note}
    onClick={status.syncRemovals}
    disabled={!status.supported}
  >
    <Icon name="refresh-cw" />
    {status.pending > 0 && <span className="LinkSyncCount">{status.pending}</span>}
  </button>
);

export default SyncButton;
