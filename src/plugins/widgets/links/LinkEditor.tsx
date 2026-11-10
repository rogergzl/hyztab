import React, { FC, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { db } from "../../../db/state";
import { useValue } from "../../../lib/db/react";
import { fetchSiteTitle } from "../../../lib/siteTitle";
import LinkIcon from "./LinkIcon";
import { ICON_CUSTOM, ICON_FAVICON, Link } from "./types";
import {
  faviconUrls,
  getDomain,
  hasUrl,
  normalizeIcon,
  prettifyHost,
  readIconFile,
  shortNameFrom,
} from "./util";

/** Either use the favicon pulled from the site, or upload one by hand. */
type IconMode = "favicon" | "custom";

const AUTOSAVE_DELAY = 400;
/** How long to wait for the address to settle before reading its name. */
const TITLE_READ_DELAY = 700;

type Props = {
  /** The link being edited. */
  link: Link;
  cache: Record<string, string>;
  /** Persist an uploaded icon and return the id to reference it. */
  onSaveIcon: (dataUrl: string) => string;
  /** Commit changes to storage. Called automatically as the user types. */
  onChange: (link: Link) => void;
  onRemove: () => void;
  onClose: () => void;
};

const LinkEditor: FC<Props> = ({
  cache,
  link,
  onClose,
  onChange,
  onRemove,
  onSaveIcon,
}) => {
  const [draft, setDraft] = useState<Link>(link);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [reading, setReading] = useState(false);

  const siteTitle = useValue(db, "siteTitle");

  // Latest values, so timers always read current state.
  const latest = useRef<Link>(link);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  // Whether the full name is still ours to fill in. It follows the address as
  // long as the user has not typed a name of their own, so a partially typed
  // host ("j") does not become the name that sticks.
  const nameIsOurs = useRef(!((link.name ?? "").trim().length > 0));

  const commit = useCallback(
    (next: Link) => {
      onChange(next);
      dirty.current = false;
      setSaved(true);
    },
    [onChange],
  );

  /** Write any pending edit immediately. */
  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (dirty.current) commit(latest.current);
  }, [commit]);

  // Persist the favicon choice automatically once a url is available.
  const change = (values: Partial<Link>) => {
    const next = normalizeIcon({ ...latest.current, ...values });

    // Take the full name from the address, and keep taking it while the user
    // has not named the link themselves. Without this, typing a host one
    // character at a time would lock the name to the first fragment that
    // happened to parse as a domain.
    if ("name" in values) nameIsOurs.current = false;

    if (nameIsOurs.current) {
      const derived = getDomain(next.url) ? prettifyHost(next.url) : "";
      next.name = derived || undefined;
    } else if ("url" in values && !((next.name ?? "").trim().length > 0)) {
      // The user cleared the name, so hand it back to the address.
      nameIsOurs.current = true;
      const derived = getDomain(next.url) ? prettifyHost(next.url) : "";
      next.name = derived || undefined;
    }

    latest.current = next;
    dirty.current = true;
    setDraft(next);
    setSaved(false);

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(next), AUTOSAVE_DELAY);
  };

  // Never lose edits if the panel closes unexpectedly. Bound through a ref on
  // purpose: `flush` changes identity every render, and subscribing to it would
  // flush on every keystroke, defeating the delay above.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);

  // Ask the address what the site calls itself, once the setting allows it and
  // the address has settled. The answer replaces the name derived from the
  // domain, but only while the name is still ours to fill in.
  const commitRef = useRef(commit);
  commitRef.current = commit;

  useEffect(() => {
    if (!siteTitle || !hasUrl(draft) || !nameIsOurs.current) return;

    let cancelled = false;
    setReading(true);

    const handle = setTimeout(() => {
      fetchSiteTitle(draft.url!)
        .then((title) => {
          if (cancelled || !title || !nameIsOurs.current) return;

          const next = { ...latest.current, name: title };
          latest.current = next;
          dirty.current = true;
          setDraft(next);
          setSaved(false);

          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(
            () => commitRef.current(next),
            AUTOSAVE_DELAY,
          );
        })
        .finally(() => {
          if (!cancelled) setReading(false);
        });
    }, TITLE_READ_DELAY);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.url, siteTitle]);

  const uploadIcon = async (file: File | undefined) => {
    if (!file) return;
    try {
      const id = onSaveIcon(await readIconFile(file));
      change({ icon: ICON_CUSTOM, customIconId: id });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法读取该图片");
    }
  };

  const close = () => {
    flush();
    onClose();
  };

  const remove = () => {
    if (timer.current) clearTimeout(timer.current);
    dirty.current = false;
    onRemove();
  };

  const mode: IconMode = draft.icon === ICON_CUSTOM ? "custom" : "favicon";
  const domain = getDomain(draft.url);
  const canReach = hasUrl(draft);

  // Portalled to <body>: the widget sits inside a transformed .Slot, and a
  // transformed ancestor becomes the containing block for fixed elements,
  // which would crush the overlay into the widget's own box.
  return createPortal(
    <div
      className="LinkEditorOverlay"
      onMouseDown={close}
      // The overlay owns the whole screen, so it also swallows right clicks
      // instead of letting the native menu appear behind the panel.
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        className="LinkEditor"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
      >
        <header className="LinkEditorHeader">
          <h3>配置快速链接</h3>
          <button className="LinkEditorClose" onClick={close} title="关闭">
            ×
          </button>
        </header>

        <div className="LinkEditorBody">
          <aside className="LinkEditorPreview">
            <span className="LinkEditorPreviewIcon">
              <LinkIcon cache={cache} link={draft} />
            </span>
            <span className="LinkEditorPreviewName">
              {draft.shortName ||
                shortNameFrom(draft.name, draft.url) ||
                "未命名"}
            </span>
            <span className="LinkEditorPreviewHint">
              {canReach ? "主页显示效果" : "尚未配置网址"}
            </span>
          </aside>

          <div className="LinkEditorFields">
            <label className="Field">
              <span className="FieldLabel">网址</span>
              <input
                type="text"
                autoFocus
                spellCheck={false}
                value={draft.url ?? ""}
                placeholder="https://example.com"
                onChange={(event) => change({ url: event.target.value })}
              />
            </label>

            <label className="Field">
              <span className="FieldLabel">短名称</span>
              <input
                type="text"
                value={draft.shortName ?? ""}
                placeholder={shortNameFrom(draft.name, draft.url) || "留空则用完整名称"}
                onChange={(event) => change({ shortName: event.target.value })}
              />
              <small className="FieldHint">
                留空即按完整名称自动缩短，网格上显示的就是它
              </small>
            </label>

            <label className="Field">
              <span className="FieldLabel">完整名称</span>
              <input
                type="text"
                value={draft.name ?? ""}
                placeholder={
                  domain ? prettifyHost(draft.url) : "输入网址后自动识别"
                }
                onChange={(event) => change({ name: event.target.value })}
              />
              <small className="FieldHint">
                {reading
                  ? "正在读取站点名称…"
                  : siteTitle
                    ? "默认读取站点名称，失败则按域名推导；可自行改写"
                    : "默认按域名推导；可在侧边栏开启「读取站点名称」"}
              </small>
            </label>

            <div className="Field Field--stacked">
              <span className="FieldLabel">图标</span>

              <div className="IconChoice">
                <button
                  type="button"
                  className={`IconChoiceItem ${
                    mode === "favicon" ? "is-active" : ""
                  }`}
                  onClick={() =>
                    change({ icon: ICON_FAVICON, customIconId: undefined })
                  }
                >
                  <span className="IconChoiceIcon">
                    {mode === "favicon" && canReach ? (
                      <img
                        alt=""
                        src={faviconUrls(draft.url)[0]}
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                  </span>
                  <span className="IconChoiceText">
                    <strong>自动获取</strong>
                    <small>
                      {domain ? `读取 ${domain} 的图标` : "输入网址后自动读取"}
                    </small>
                  </span>
                </button>

                <button
                  type="button"
                  className={`IconChoiceItem ${
                    mode === "custom" ? "is-active" : ""
                  }`}
                  onClick={() => change({ icon: ICON_CUSTOM })}
                >
                  <span className="IconChoiceIcon">
                    {mode === "custom" && draft.customIconId ? (
                      <img alt="" src={cache[draft.customIconId]} />
                    ) : null}
                  </span>
                  <span className="IconChoiceText">
                    <strong>自定义上传</strong>
                    <small>
                      {mode === "custom" && draft.customIconId
                        ? "已选择图片"
                        : "上传本地图片"}
                    </small>
                  </span>
                </button>
              </div>

              {mode === "custom" && (
                <label className="IconUpload">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => uploadIcon(event.target.files?.[0])}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        <footer className="LinkEditorFooter">
          <span className="LinkEditorStatus">
            {error ? (
              <span className="is-error">{error}</span>
            ) : saved ? (
              "已自动保存"
            ) : (
              "编辑后自动保存"
            )}
          </span>

          <div className="LinkEditorActions">
            <button className="button button--danger" onClick={remove}>
              删除
            </button>
            <button className="button button--primary" onClick={close}>
              完成
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
};

export default LinkEditor;
