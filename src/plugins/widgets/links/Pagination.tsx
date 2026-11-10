import React, { FC } from "react";

/** Above this many pages, dots stop being readable and a counter is used. */
const MAX_DOTS = 7;

type Props = {
  /** Zero based index of the visible page. */
  page: number;
  /** Total number of pages. */
  count: number;
  onChange: (page: number) => void;
  /** Add another page's worth of slots. */
  onExtend: () => void;
  /** Any extra control to sit beside the page controls. */
  extra?: React.ReactNode;
};

/**
 * Page switcher underneath the frame.
 *
 * The pager is always rendered, even with a single page, because the add
 * button is the only way to grow past a full first page: without it a widget
 * would need a twenty fifth link before a second page could ever appear.
 */
const Pagination: FC<Props> = ({ count, extra, onChange, onExtend, page }) => (
  <nav
    className="LinkPager"
    aria-label="快速链接分页"
    // The widget adds a link on right click; the pager itself is not a target.
    onContextMenu={(event) => event.stopPropagation()}
  >
    {count > 1 && (
      <>
        <button
          type="button"
          className="LinkPagerArrow"
          disabled={page <= 0}
          title="上一页"
          aria-label="上一页"
          onClick={() => onChange(page - 1)}
        >
          ‹
        </button>

        {count <= MAX_DOTS ? (
          <span className="LinkPagerDots">
            {Array.from({ length: count }, (_, index) => (
              <button
                key={index}
                type="button"
                className={`LinkPagerDot ${index === page ? "is-active" : ""}`}
                aria-label={`第 ${index + 1} 页`}
                aria-current={index === page}
                onClick={() => onChange(index)}
              />
            ))}
          </span>
        ) : (
          <span className="LinkPagerCount">
            {page + 1} / {count}
          </span>
        )}

        <button
          type="button"
          className="LinkPagerArrow"
          disabled={page >= count - 1}
          title="下一页"
          aria-label="下一页"
          onClick={() => onChange(page + 1)}
        >
          ›
        </button>
      </>
    )}

    <button
      type="button"
      className="LinkPagerAdd"
      title="增加一页"
      aria-label="增加一页"
      onClick={onExtend}
    >
      ＋
    </button>

    {extra}
  </nav>
);

export default Pagination;
