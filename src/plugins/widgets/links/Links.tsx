import React, { FC, useCallback, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";

import { useKeyPress, useSavedReducer, useToggle } from "../../../hooks";
import { clampLinksGrid } from "../../../db/linksGrid";
import { db } from "../../../db/state";
import { useValue } from "../../../lib/db/react";
import { Icon } from "../../../views/shared";
import Display from "./Display";
import LinkEditor from "./LinkEditor";
import Pagination from "./Pagination";
import SyncButton from "./SyncButton";
import { useLinkDrag } from "./useLinkDrag";
import { SyncLinkInput, useBookmarkSync } from "./useBookmarkSync";
import {
  addLink,
  addLinks,
  insertLink,
  removeLink,
  reorderLink,
  setLinks,
  updateLink,
} from "./actions";
import {
  clampPage,
  gridMetrics,
  pageCount,
  pageIndices,
  pageOfIndex,
  perPage,
  slotPlacement,
} from "./layout";
import { reducer } from "./reducer";
import { Link, LinkPlacement, Props, defaultCache, defaultData } from "./types";
import { useDragPaging } from "./useDragPaging";
import { useWheelPaging } from "./useWheelPaging";
import { displayNameOf, hasUrl } from "./util";
import "./Links.sass";

const Links: FC<Props> = ({
  data = defaultData,
  cache = defaultCache,
  setCache,
  setData,
}) => {
  const root = useRef<HTMLDivElement | null>(null);
  const viewport = useRef<HTMLDivElement | null>(null);
  const track = useRef<HTMLDivElement | null>(null);
  const [visible, toggleVisible] = useToggle();

  // Index of the link being configured, or null when the panel is shut.
  const [editing, setEditing] = useState<number | null>(null);

  // The grid is a page level setting read from the store, so every links
  // widget on the new tab page shares one size.
  const grid = clampLinksGrid(useValue(db, "linksGrid"));
  const bookmarkSync = useValue(db, "bookmarkSync");
  const size = perPage(grid);
  const pages = pageCount(data.links.length, size);

  // The page is stored, but always read back through a clamp, so shrinking
  // the grid or deleting links can never strand the view on a gone page.
  const [storedPage, setPage] = useState(0);
  const page = clampPage(storedPage, pages);

  const saveLinks = useCallback(
    (links: Link[]) => setData({ ...data, links }),
    [data, setData],
  );
  const dispatch = useSavedReducer(reducer, data.links, saveLinks);

  const shown = data.visible || visible;
  const paging = shown && pages > 1;

  useWheelPaging(root, paging, (direction) =>
    setPage(clampPage(page + direction, pages)),
  );

  useDragPaging({
    viewport,
    track,
    enabled: paging,
    page,
    pages,
    onPage: (next) => setPage(clampPage(next, pages)),
  });

  useKeyPress(
    ({ key }) => {
      const link = data.links[Number(key) - 1];
      if (link && hasUrl(link)) {
        data.linkOpenStyle
          ? window.open(link.url, "_blank")
          : window.location.assign(link.url!);
      }
    },
    ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
  );

  // Custom icons live in the IndexedDB backed cache so they do not count
  // against the synced storage quota.
  const saveIcon = useCallback(
    (dataUrl: string) => {
      const id = nanoid(12);
      setCache({ ...cache, [id]: dataUrl });
      return id;
    },
    [cache, setCache],
  );

  // A new link is stored straight away so that everything typed into the
  // panel is saved as it happens. The view follows it to its page.
  const addNew = () => {
    const index = data.links.length;
    dispatch(addLink({}));
    setPage(pageOfIndex(index, size));
    setEditing(index);
  };

  // Filling a cell that holds no link yet puts one in that exact slot, so a
  // gap in the grid can be filled in place instead of only appending.
  const fillSlot = (index: number) => {
    dispatch(insertLink(index, {}));
    setEditing(index);
  };

  // Grow by a whole page and follow the view there. One extra slot would not
  // be enough: a second page only exists once the first one is full.
  const extend = () => {
    const total = data.links.length + size;
    dispatch(addLinks(size));
    setPage(pageCount(total, size) - 1);
  };

  const editingLink: Link | undefined =
    editing === null ? undefined : data.links[editing] ?? {};

  // Square cells sized so the grid fits the frame on both axes, with the
  // contents scaled to match.
  const metrics = useMemo(
    () => gridMetrics(grid.rows, grid.columns),
    [grid.rows, grid.columns],
  );

  /**
   * Where a slot sits on its page. The popup is drawn inside the frame, so a
   * tile on the top row turns it downwards and one against a side edge lines
   * it up with that edge rather than centring and overflowing.
   */
  const placementOf = (index: number) => slotPlacement(index, grid);

  // Adopt the folder's bookmarks as links, filling free slots in order.
  const takeOn = useCallback(
    (entries: SyncLinkInput[]) => {
      const next = [...data.links];
      let cursor = 0;

      for (const entry of entries) {
        while (cursor < next.length && hasUrl(next[cursor])) cursor += 1;
        if (cursor >= next.length) break;

        next[cursor] = {
          name: entry.title,
          shortName: entry.title,
          url: entry.url,
        };
        cursor += 1;
      }

      dispatch(setLinks(next));
    },
    [data.links, dispatch],
  );

  const shortNameOf = (link: Link) => displayNameOf(link);

  const sync = useBookmarkSync({
    enabled: bookmarkSync,
    capacity: size,
    // Held back while a link is being configured, so the first bookmark is
    // written once the edit is finished rather than on every keystroke.
    suspended: editing !== null,
    links: useMemo(
      () =>
        data.links
          .filter(hasUrl)
          .map((link) => ({ title: shortNameOf(link), url: link.url! })),
      [data.links],
    ),
    onTakeOn: takeOn,
  });

  // Long press a tile to pick it up, release to drop it on the nearest cell.
  useLinkDrag({
    viewport,
    enabled: shown,
    columns: grid.columns,
    rows: grid.rows,
    onMove: (from, to) => dispatch(reorderLink(from, to)),
  });

  // Every page is laid out side by side; the rail slides to the current one.
  // Cells divide the fixed frame, so the overall size never changes.
  const sheets = useMemo(
    () => Array.from({ length: pages }, (_, index) => pageIndices(index, size)),
    [pages, size],
  );

  const renderSlot = (index: number) => (
    <Display
      key={index}
      number={index + 1}
      linkOpenStyle={data.linkOpenStyle}
      cache={cache}
      onEdit={() => (data.links[index] ? setEditing(index) : fillSlot(index))}
      placement={placementOf(index)}
      slot={index}
      {...(data.links[index] ?? {})}
    />
  );

  return (
    <div
      ref={root}
      className="Links"
      onContextMenu={(event) => {
        // Right click the widget to add a link.
        event.preventDefault();
        if (shown) addNew();
      }}
    >
      {shown ? (
        <>
          <div
            className="LinksViewport"
            ref={viewport}
            style={
              {
                "--link-frame-width": metrics.frameWidth,
                "--link-frame-height": metrics.frameHeight,
              } as React.CSSProperties
            }
          >
            <div
              className="LinkTrack"
              ref={track}
              style={{ "--link-page": page } as React.CSSProperties}
            >
              {sheets.map((indices, index) => (
                <div
                  key={index}
                  className="LinkPage"
                  style={
                    {
                      "--link-columns": grid.columns,
                      "--link-rows": grid.rows,
                      "--link-cell": metrics.cell,
                      "--link-content": metrics.content,
                    } as React.CSSProperties
                  }
                >
                  {indices.map(renderSlot)}
                </div>
              ))}
            </div>
          </div>

          {/* Always shown: the add button is how a second page comes to exist. */}
          <Pagination
            page={page}
            count={pages}
            onChange={setPage}
            onExtend={extend}
            extra={<SyncButton status={sync} />}
          />
        </>
      ) : (
        <a onClick={toggleVisible} title="显示快速链接">
          <Icon name="link-2" />
        </a>
      )}

      {editing !== null && editingLink && (
        <LinkEditor
          link={editingLink}
          cache={cache}
          onSaveIcon={saveIcon}
          onChange={(link) => dispatch(updateLink(editing, link))}
          onRemove={() => {
            dispatch(removeLink(editing));
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};

export default Links;
