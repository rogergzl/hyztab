import React, { FC, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { nanoid } from "nanoid";

import { normalizeShareConfig } from "../../../db/linkShare";
import { db } from "../../../db/state";
import { useValue } from "../../../lib/db/react";
import { fetchSiteTitle } from "../../../lib/siteTitle";
import {
  isValidProxyAddress,
  normalizeProxyNodes,
  proxySupported,
} from "../../../lib/linkProxy";
import {
  deleteShare,
  listIdentities,
  normalizeServiceUrl,
  publishShare,
  PublicIdentity,
  SharePayload,
} from "../../../lib/linkShare";
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
  const [shareEnabled, setShareEnabled] = useState(Boolean(link.share));
  const [shareOwner, setShareOwner] = useState(link.share?.ownerId ?? "");
  const [shareRecipients, setShareRecipients] = useState<string[]>(
    link.share?.recipients ?? [],
  );
  const [shareUsers, setShareUsers] = useState<PublicIdentity[]>([]);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const siteTitle = useValue(db, "siteTitle");
  const nodes = normalizeProxyNodes(useValue(db, "linkProxyNodes"));
  const shareConfig = normalizeShareConfig(useValue(db, "linkShare"));
  const signingIdentities = shareConfig.identities.filter(
    (identity) => identity.privateKey,
  );
  const ownerId = shareOwner || signingIdentities[0]?.id || "";
  const owner = signingIdentities.find((identity) => identity.id === ownerId);
  const proxy = draft.proxy;
  const selectedNode =
    proxy?.nodeId && nodes.find((node) => node.id === proxy.nodeId);
  const proxyAddress = proxy
    ? selectedNode
      ? selectedNode.address
      : proxy.address ?? ""
    : "";

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

  let shareServiceUrl = "";
  try {
    shareServiceUrl = normalizeServiceUrl(shareConfig.serviceUrl);
  } catch (e) {
    // An empty or malformed value simply disables sharing UI actions; the
    // settings panel owns the user-facing validation message.
    void e;
    shareServiceUrl = "";
  }

  const errorText = (e: unknown): string =>
    e instanceof Error ? e.message : "操作失败";

  /** 本地密钥集合的稳定指纹，用于让接收者列表在密钥变化时刷新。 */
  const localKey = shareConfig.identities
    .map((identity) => identity.fingerprint)
    .sort()
    .join(",");

  // 按分组归拢，界面上同组排在一起，避免一长条看不出归属。
  const shareGroups = Array.from(
    shareUsers.reduce((acc, user) => {
      const key = user.groupName || "未分组";
      const list = acc.get(key) ?? [];
      list.push(user);
      acc.set(key, list);
      return acc;
    }, new Map<string, PublicIdentity[]>()),
  );

  useEffect(() => {
    if (!shareEnabled || !shareServiceUrl || !owner) return;

    let active = true;
    // 接收者列表要排除本机所有密钥，否则多密钥用户会看到「自己」。
    const local = new Set(
      shareConfig.identities.map((identity) => identity.fingerprint),
    );
    listIdentities(shareServiceUrl, owner)
      .then((users) => {
        if (active) setShareUsers(users.filter((user) => !local.has(user.fingerprint)));
      })
      .catch((e) => {
        if (active) setShareError(errorText(e));
      });
    return () => {
      active = false;
    };
    // owner 或本地密钥集合变化时都要重新拉取列表。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareEnabled, shareServiceUrl, owner?.fingerprint, localKey]);

  const publish = async () => {
    setShareError(null);
    setShareMessage(null);

    if (!canReach) return setShareError("请先填写网址");
    if (!shareServiceUrl) return setShareError("请先在侧边栏配置中转服务地址");
    if (!owner) return setShareError("请选择一个有私钥的本地密钥");
    if (shareRecipients.length === 0)
      return setShareError("请至少选择一个接收用户");

    setShareBusy(true);
    try {
      const address = proxy
        ? selectedNode
          ? selectedNode.address
          : proxy.address
        : undefined;
      // 总是把显示配置一起发出去；是否采纳由接收方在侧边栏决定。
      const payload: SharePayload = {
        url: draft.url!,
        name: draft.name,
        shortName: draft.shortName,
        // Uploaded icons are local IndexedDB data and cannot be shared.
        icon: draft.icon === ICON_CUSTOM ? ICON_FAVICON : draft.icon,
        proxy: address ? { address } : undefined,
        withConfig: true,
        updatedAt: Date.now(),
      };
      const id = draft.share?.shareId ?? nanoid(12);
      const record = await publishShare(shareServiceUrl, owner, {
        id,
        recipients: shareRecipients,
        payload,
      });

      change({
        share: {
          shareId: record.id,
          serviceUrl: shareServiceUrl,
          owner: owner.fingerprint,
          ownerId: owner.id,
          recipients: record.recipients,
          recipient: draft.share?.recipient ?? owner.fingerprint,
          updatedAt: record.updatedAt,
        },
      });
      setShareMessage("已发布；对方添加后可在网格下方手动刷新");
    } catch (e) {
      setShareError(errorText(e));
    } finally {
      setShareBusy(false);
    }
  };

  const unpublish = async () => {
    if (!draft.share) return;
    setShareError(null);
    setShareMessage(null);

    // 没有私钥（如导入的备份）或未配置服务时无法签名，但本地状态必须能解除，
    // 否则这条链接会永远卡在「已分享」，连取消都点不动。
    if (!shareServiceUrl || !owner) {
      change({ share: undefined });
      setShareEnabled(false);
      setShareMessage(
        "已在本地取消分享。当前密钥无法连接中转服务（缺少私钥或未连接），服务端记录可能仍在，可在管理面板撤销。",
      );
      return;
    }

    setShareBusy(true);
    try {
      await deleteShare(shareServiceUrl, owner, draft.share.shareId);
      change({ share: undefined });
      setShareEnabled(false);
      setShareMessage("已取消分享");
    } catch (e) {
      // 服务端失败也解除本地关联，并说明残留在哪里清理。
      change({ share: undefined });
      setShareEnabled(false);
      setShareMessage(
        `已在本地取消分享；服务端删除失败：${errorText(e)}。可在管理面板撤销该记录。`,
      );
    } finally {
      setShareBusy(false);
    }
  };

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

            <div className="Field Field--stacked">
              <label className="ProxyToggle">
                <input
                  type="checkbox"
                  checked={Boolean(draft.proxy)}
                  onChange={(event) =>
                    change({
                      proxy: event.target.checked
                        ? draft.proxy ?? {
                            nodeId: nodes[0]?.id,
                            address: nodes.length > 0 ? undefined : "",
                          }
                        : undefined,
                    })
                  }
                />
                <span className="FieldLabel">代理访问</span>
              </label>

              {proxy && (
                <>
                  <select
                    value={selectedNode ? selectedNode.id : "__custom"}
                    onChange={(event) =>
                      change({
                        proxy: {
                          ...proxy,
                          nodeId:
                            event.target.value === "__custom"
                              ? undefined
                              : event.target.value,
                        },
                      })
                    }
                  >
                    {nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.name} — {node.address}
                      </option>
                    ))}
                    <option value="__custom">自定义地址</option>
                  </select>

                  {!selectedNode && (
                    <input
                      type="text"
                      spellCheck={false}
                      value={proxy.address ?? ""}
                      placeholder="192.168.1.91:7893 或 socks5://127.0.0.1:1080"
                      onChange={(event) =>
                        change({
                          proxy: { ...proxy, address: event.target.value },
                        })
                      }
                    />
                  )}

                  <small className="FieldHint">
                    {proxyAddress && !isValidProxyAddress(proxyAddress)
                      ? "地址格式不正确，需形如 主机:端口，支持 http / socks5 / socks4。"
                      : !proxySupported()
                        ? "当前浏览器不支持扩展设置代理（需 Chrome 或 Edge）。"
                        : selectedNode
                          ? "使用侧边栏配置的节点；修改节点地址后所有选用它的链接同步生效。"
                          : "按域名生效。其余网站由侧边栏「代理兜底」决定，留空则直连。"}
                  </small>
                </>
              )}
            </div>

            <div className="Field Field--stacked">
              <label className="ProxyToggle">
                <input
                  type="checkbox"
                  checked={shareEnabled}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    setShareEnabled(enabled);
                    if (!enabled) change({ share: undefined });
                  }}
                />
                <span className="FieldLabel">标签分享</span>
              </label>

              {shareEnabled && (
                <div className="SharePanel">
                  {!shareConfig.serviceUrl ? (
                    <small className="FieldHint">
                      请先在侧边栏配置中转服务地址与密钥。
                    </small>
                  ) : signingIdentities.length === 0 ? (
                    <small className="FieldHint">
                      侧边栏的密钥缺少私钥（导入的备份不含私钥），无法发布；请重新生成一个密钥。
                    </small>
                  ) : (
                    <>
                      <label className="ShareField">
                        <span className="FieldLabel">使用身份</span>
                        <select
                          value={ownerId}
                          onChange={(event) => setShareOwner(event.target.value)}
                        >
                          {signingIdentities.map((identity) => (
                            <option key={identity.id} value={identity.id}>
                              {identity.name} · {identity.groupName || "未分组"}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="ShareRecipients">
                        <div className="ShareRecipientsHead">
                          <span className="FieldLabel">接收用户</span>
                          <small>
                            已选{" "}
                            {
                              shareRecipients.filter((fp) =>
                                shareUsers.some((user) => user.fingerprint === fp),
                              ).length
                            }{" "}
                            / {shareUsers.length}
                          </small>
                        </div>

                        {shareUsers.length === 0 ? (
                          <small className="FieldHint">
                            读取不到同组用户：可能需要私钥签名、未授予站点权限，或同组暂无他人。
                          </small>
                        ) : (
                          shareGroups.map(([group, users]) => {
                            const allSelected = users.every((user) =>
                              shareRecipients.includes(user.fingerprint),
                            );
                            return (
                              <div className="ShareGroup" key={group}>
                                <div className="ShareGroupHead">
                                  <strong>{group}</strong>
                                  <button
                                    type="button"
                                    className="ShareGroupAll"
                                    onClick={() =>
                                      setShareRecipients((current) => {
                                        const others = current.filter(
                                          (item) =>
                                            !users.some((u) => u.fingerprint === item),
                                        );
                                        return allSelected
                                          ? others
                                          : [
                                              ...others,
                                              ...users.map((u) => u.fingerprint),
                                            ];
                                      })
                                    }
                                  >
                                    {allSelected ? "取消全选" : "全选"}
                                  </button>
                                </div>
                                {users.map((user) => (
                                  <label key={user.fingerprint} className="ShareUser">
                                    <input
                                      type="checkbox"
                                      checked={shareRecipients.includes(user.fingerprint)}
                                      onChange={(event) =>
                                        setShareRecipients((current) =>
                                          event.target.checked
                                            ? [...current, user.fingerprint]
                                            : current.filter(
                                                (item) => item !== user.fingerprint,
                                              ),
                                        )
                                      }
                                    />
                                    <span>{user.name}</span>
                                    <small>{user.fingerprint.slice(0, 8)}</small>
                                  </label>
                                ))}
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="ShareActions">
                        <button
                          type="button"
                          className="button button--primary"
                          disabled={shareBusy}
                          onClick={publish}
                        >
                          {draft.share ? "更新分享" : "发布分享"}
                        </button>
                        {draft.share && (
                          <button
                            type="button"
                            className="button button--secondary"
                            disabled={shareBusy}
                            onClick={unpublish}
                          >
                            取消分享
                          </button>
                        )}
                      </div>

                      <small className="FieldHint">
                        链接更新后需重新发布；对方在其网格下方点「刷新分享」获取新内容。
                      </small>
                    </>
                  )}

                  {shareError && <small className="is-error">{shareError}</small>}
                  {shareMessage && <small className="FieldHint">{shareMessage}</small>}
                </div>
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
