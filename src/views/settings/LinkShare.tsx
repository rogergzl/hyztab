import React from "react";

import {
  addShareIdentity,
  addSharedLink,
  hasSharedLink,
  discardPausedShare,
  isSharePaused,
  normalizeShareConfig,
  pauseSharedLink,
  removeSharedLink,
  resumeSharedLink,
  removeShareIdentity,
  setAutoAccept,
  setShareServiceUrl,
  updateIdentityMeta,
} from "../../db/linkShare";
import { db } from "../../db/state";
import { useValue } from "../../lib/db/react";
import {
  deleteIdentity,
  excludeLocalIdentities,
  readPeerCache,
  writePeerCache,
  generateIdentity,
  listIdentities,
  listIncoming,
  normalizeServiceUrl,
  PublicIdentity,
  registerIdentity,
  requestHostPermission,
  ShareIdentity,
  ShareRecord,
} from "../../lib/linkShare";

type Incoming = { share: ShareRecord; identity: ShareIdentity };

const errorText = (e: unknown): string =>
  e instanceof Error ? e.message : "操作失败";

/**
 * Account-free link sharing settings.
 *
 * 分组只用于「谁能看见谁」：同一分组（或都未分组）之间才能互相分享。
 * 分组密码只在加入时用一次，不落盘、不入同步。
 */
const LinkShare: React.FC = () => {
  const config = normalizeShareConfig(useValue(db, "linkShare"));
  const [service, setService] = React.useState(config.serviceUrl);
  const [name, setName] = React.useState("");
  const [newGroupName, setNewGroupName] = React.useState("");
  const [newGroupPassword, setNewGroupPassword] = React.useState("");

  // 每个身份单独设置分组
  const [editingGroupOf, setEditingGroupOf] = React.useState<string | null>(null);
  const [groupDraft, setGroupDraft] = React.useState({ name: "", password: "" });

  const [peers, setPeers] = React.useState<PublicIdentity[]>([]);

  const [incoming, setIncoming] = React.useState<Incoming[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  let serviceUrl = "";
  try {
    serviceUrl = normalizeServiceUrl(config.serviceUrl);
  } catch {
    serviceUrl = "";
  }

  const signingIdentities = config.identities.filter(
    (identity) => identity.privateKey,
  );
  const identityKey = signingIdentities
    .map((identity) => identity.fingerprint)
    .join(",");
  /** 与链接编辑器共用的缓存 scope，需按本地全部密钥计算。 */
  const localKey = config.identities
    .map((identity) => identity.fingerprint)
    .sort()
    .join(",");

  const [autoUsers, setAutoUsers] = React.useState<string[]>(
    config.autoAccept.users,
  );
  const [autoGroups, setAutoGroups] = React.useState<string[]>(
    config.autoAccept.groups,
  );

  const loadPeers = React.useCallback(async () => {
    if (!serviceUrl || signingIdentities.length === 0) {
      setPeers([]);
      return;
    }

    // 先显示上次结果，避免「等加载完才能操作」。
    const scope = `peers|${serviceUrl}|${localKey}`;
    const cached = await readPeerCache(scope);
    if (cached) setPeers(cached);

    try {
      // 同一分组只需查一次：服务端返回的是整组，按身份逐次查是重复请求。
      const byGroup = new Map<string, ShareIdentity>();
      for (const identity of signingIdentities) {
        const key = identity.groupId ?? identity.groupName ?? "未分组";
        if (!byGroup.has(key)) byGroup.set(key, identity);
      }

      const lists = await Promise.all(
        Array.from(byGroup.values()).map((identity) =>
          listIdentities(serviceUrl, identity).catch(() => [] as PublicIdentity[]),
        ),
      );
      const merged = new Map<string, PublicIdentity>();
      for (const list of lists)
        for (const item of list) merged.set(item.fingerprint, item);
      const next = Array.from(merged.values());
      setPeers(next);
      void writePeerCache(scope, next);
    } catch (e) {
      setError(errorText(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceUrl, identityKey, localKey]);

  const loadIncoming = React.useCallback(async () => {
    if (!serviceUrl || signingIdentities.length === 0) {
      setIncoming([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const batches = await Promise.all(
        signingIdentities.map(async (identity) => {
          const shares = await listIncoming(serviceUrl, identity);
          return shares.map((share): Incoming => ({ share, identity }));
        }),
      );
      const all = batches.flat();
      setIncoming(all);

      // 自动接受：发布者在白名单，或发布者所在分组在白名单。
      let autoAdded = 0;
      for (const entry of all) {
        const { share, identity } = entry;
        const accepted =
          autoUsers.includes(share.owner) ||
          (share.ownerGroup ? autoGroups.includes(share.ownerGroup) : false);
        if (!accepted || hasSharedLink(share.id)) continue;
        const ok = addSharedLink(
          share.payload,
          {
            shareId: share.id,
            serviceUrl,
            owner: share.owner,
            recipients: share.recipients,
            recipient: identity.fingerprint,
            applyConfig: true,
            updatedAt: share.updatedAt,
          },
          true,
        );
        if (ok) autoAdded += 1;
      }
      if (autoAdded > 0) setMessage(`已自动接受 ${autoAdded} 条分享`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceUrl, identityKey, autoUsers.join(","), autoGroups.join(",")]);

  React.useEffect(() => {
    void loadPeers();
    void loadIncoming();
  }, [loadPeers, loadIncoming]);

  const connect = async () => {
    setError(null);
    setMessage(null);
    try {
      const normalized = normalizeServiceUrl(service);
      await requestHostPermission(normalized);
      setShareServiceUrl(normalized);
      setService(normalized);
      setMessage("已连接中转服务");
    } catch (e) {
      setError(errorText(e));
    }
  };

  const createIdentity = async () => {
    setError(null);
    setMessage(null);
    if (!serviceUrl) {
      setError("请先连接中转服务");
      return;
    }

    setLoading(true);
    try {
      const identity = await generateIdentity(name);
      const group = newGroupName.trim()
        ? { name: newGroupName.trim(), password: newGroupPassword }
        : undefined;
      const registered = await registerIdentity(serviceUrl, identity, group);
      const stored: ShareIdentity = {
        ...identity,
        groupId: registered.groupId ?? undefined,
        groupName: registered.groupName,
      };
      if (!addShareIdentity(stored))
        throw new Error("该密钥已存在，无需重复生成");
      setName("");
      setNewGroupName("");
      setNewGroupPassword("");
      setMessage(
        `密钥「${identity.name}」已创建，分组：${registered.groupName ?? "未分组"}`,
      );
      void loadPeers();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  };

  const saveGroup = async (identity: ShareIdentity) => {
    setError(null);
    setMessage(null);
    if (!serviceUrl) return setError("请先连接中转服务");
    if (!groupDraft.name.trim()) return setError("请填写分组名");
    if (groupDraft.password.length < 4) return setError("分组密码至少 4 位");

    setLoading(true);
    try {
      const registered = await registerIdentity(serviceUrl, identity, {
        name: groupDraft.name.trim(),
        password: groupDraft.password,
      });
      updateIdentityMeta(identity.id, {
        groupId: registered.groupId ?? null,
        groupName: registered.groupName,
      });
      setEditingGroupOf(null);
      setGroupDraft({ name: "", password: "" });
      setMessage(`已加入分组「${registered.groupName ?? "未分组"}」`);
      void loadPeers();
      void loadIncoming();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  };

  const removeIdentity = async (identity: ShareIdentity) => {
    if (
      !confirm(
        `删除密钥「${identity.name}」？会同时从服务端注销并撤销它发布的分享。`,
      )
    )
      return;
    // 先注销服务端，失败也继续删本地，避免残留造成「同一用户出现多个」。
    if (serviceUrl && identity.privateKey) {
      try {
        await deleteIdentity(serviceUrl, identity);
      } catch (e) {
        setError(`服务端注销失败：${errorText(e)}`);
      }
    }
    removeShareIdentity(identity.id);
    void loadPeers();
  };

  const add = (entry: Incoming) => {
    setError(null);
    const { share, identity } = entry;
    if (hasSharedLink(share.id)) {
      setMessage("该分享已在快速链接中");
      return;
    }

    const ok = addSharedLink(share.payload, {
      shareId: share.id,
      serviceUrl,
      owner: share.owner,
      recipients: share.recipients,
      recipient: identity.fingerprint,
      updatedAt: share.updatedAt,
    });
    setMessage(ok ? "已添加到快速链接" : "未找到可写入的快速链接组件");
  };

  const remove = (entry: Incoming) => {
    setError(null);
    const discarded = discardPausedShare(entry.share.id);
    const count = removeSharedLink(entry.share.id);
    setMessage(
      discarded || count > 0
        ? "已彻底移除（内容不再保留）"
        : "快速链接中未找到该分享",
    );
  };

  const togglePause = (entry: Incoming, paused: boolean) => {
    setError(null);
    const ok = paused
      ? pauseSharedLink(entry.share.id)
      : resumeSharedLink(entry.share.id);
    setMessage(
      ok
        ? paused
          ? "已暂停：从网格移出，内容已保留，可随时恢复"
          : "已恢复到快速链接"
        : "操作失败：未找到该分享",
    );
  };

  const toggleAutoUser = (fingerprint: string, on: boolean) => {
    const next = on
      ? [...autoUsers, fingerprint]
      : autoUsers.filter((item) => item !== fingerprint);
    setAutoUsers(next);
    setAutoAccept({ users: next });
  };

  const toggleAutoGroup = (group: string, on: boolean) => {
    const next = on
      ? [...autoGroups, group]
      : autoGroups.filter((item) => item !== group);
    setAutoGroups(next);
    setAutoAccept({ groups: next });
  };

  // 排除本机所有已知密钥（可能有多把，含只有公钥的），规则见 lib/linkShare/peers。
  const otherPeers = excludeLocalIdentities(peers, config.identities);

  const peerGroups = Array.from(
    new Set(
      otherPeers
        .map((peer) => peer.groupName)
        .filter((group): group is string => Boolean(group)),
    ),
  );

  return (
    <div className="Widget">
      <h4>标签分享</h4>

      <div className="settings">
        <p className="info">
          无需账号，私钥只存本机。同一分组内才能互传；不填分组则与其它未分组用户互通。
        </p>

        <label>
          中转服务地址
          <input
            type="url"
            spellCheck={false}
            value={service}
            placeholder="https://share.example.com"
            onChange={(event) => setService(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="button button--primary"
          disabled={loading}
          onClick={connect}
        >
          连接
        </button>

        <h4>新建密钥</h4>
        <label>
          密钥名称
          <input
            type="text"
            value={name}
            placeholder="例如：我的主电脑"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          分组名（可留空）
          <input
            type="text"
            value={newGroupName}
            placeholder="例如：家里；同名 + 同密码即同组"
            onChange={(event) => setNewGroupName(event.target.value)}
          />
        </label>
        {newGroupName.trim() && (
          <label>
            分组密码
            <input
              type="password"
              value={newGroupPassword}
              placeholder="至少 4 位，不保存"
              onChange={(event) => setNewGroupPassword(event.target.value)}
            />
          </label>
        )}
        <button
          type="button"
          className="button button--secondary"
          disabled={loading || !serviceUrl}
          onClick={createIdentity}
        >
          生成密钥
        </button>

        <h4>本机密钥</h4>
        {config.identities.length === 0 && <p className="info">还没有密钥。</p>}
        {config.identities.map((identity) => (
          <div key={identity.id}>
            <div className="ShareIdentityRow">
              <span>
                <strong>{identity.name}</strong>
                <small>
                  {identity.fingerprint.slice(0, 12)} ·{" "}
                  {identity.groupName || "未分组"}
                  {identity.privateKey ? "" : " · 无私钥，无法用于分享"}
                </small>
              </span>
              <span className="ShareIdentityActions">
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={!identity.privateKey}
                  title={
                    identity.privateKey
                      ? undefined
                      : "该密钥没有私钥，无法向服务端声明分组"
                  }
                  onClick={() => {
                    const opening = editingGroupOf !== identity.id;
                    setEditingGroupOf(opening ? identity.id : null);
                    // 回填当前分组名，方便改名；密码出于安全从不回填。
                    setGroupDraft({
                      name: opening ? identity.groupName ?? "" : "",
                      password: "",
                    });
                  }}
                >
                  分组
                </button>
                <button
                  type="button"
                  className="button button--danger"
                  onClick={() => removeIdentity(identity)}
                >
                  删除
                </button>
              </span>
            </div>
            {editingGroupOf === identity.id && (
              <div className="ShareGroupEditor">
                <small className="ShareGroupHint">
                  仅用于新建分组或切换分组；已加入过就不必再填。
                </small>
                <input
                  type="text"
                  value={groupDraft.name}
                  placeholder="分组名"
                  onChange={(event) =>
                    setGroupDraft((d) => ({ ...d, name: event.target.value }))
                  }
                />
                <input
                  type="password"
                  value={groupDraft.password}
                  placeholder="分组密码"
                  onChange={(event) =>
                    setGroupDraft((d) => ({ ...d, password: event.target.value }))
                  }
                />
                <button
                  type="button"
                  className="button button--primary"
                  disabled={loading}
                  onClick={() => saveGroup(identity)}
                >
                  加入
                </button>
              </div>
            )}
          </div>
        ))}

        <h4>自动接受</h4>
        <p className="info">勾选后自动收下，未勾选的在下方手动添加。</p>
        <p className="info">
          当前分组「{config.identities[0]?.groupName || "未分组"}」· 同组成员{" "}
          {otherPeers.length} 人（不含自己）
        </p>

        {otherPeers.length === 0 ? (
          <p className="info">
            还没有同组其他人。把「分组名 + 密码」告诉对方，Ta 加入后这里就会出现。
          </p>
        ) : (
          otherPeers.map((peer) => (
            <label key={peer.fingerprint} className="ShareAutoRow">
              <input
                type="checkbox"
                checked={autoUsers.includes(peer.fingerprint)}
                onChange={(event) =>
                  toggleAutoUser(peer.fingerprint, event.target.checked)
                }
              />
              <span>
                {peer.name}
                <small>
                  {peer.groupName || "未分组"} · {peer.fingerprint.slice(0, 8)}
                </small>
              </span>
            </label>
          ))
        )}
        {peerGroups.length > 0 && (
          <>
            <small className="info">按分组自动接受：</small>
            {peerGroups.map((group) => (
              <label key={group} className="ShareAutoRow">
                <input
                  type="checkbox"
                  checked={autoGroups.includes(group)}
                  onChange={(event) =>
                    toggleAutoGroup(group, event.target.checked)
                  }
                />
                <span>{group}</span>
              </label>
            ))}
          </>
        )}

        <h4>收到的分享</h4>
        <button
          type="button"
          className="button button--secondary"
          disabled={loading || !serviceUrl}
          onClick={loadIncoming}
        >
          刷新列表
        </button>

        {incoming.length === 0 ? (
          <p className="info">暂无分享。</p>
        ) : (
          incoming.map((entry) => (
            <div
              className="ShareIdentityRow"
              key={`${entry.identity.id}-${entry.share.id}`}
            >
              <span>
                <strong>
                  {entry.share.payload.shortName ||
                    entry.share.payload.name ||
                    "未命名链接"}
                </strong>
                <small>
                  {entry.share.ownerName || entry.share.owner.slice(0, 8)}
                  {entry.share.ownerGroup ? ` · ${entry.share.ownerGroup}` : ""}
                  {" · "}
                  {entry.share.payload.url}
                </small>
              </span>
              <span className="ShareAcceptActions">
                {isSharePaused(entry.share.id) ? (
                  <>
                    <small className="ShareAdded">已暂停</small>
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() => togglePause(entry, false)}
                    >
                      恢复
                    </button>
                    <button
                      type="button"
                      className="button button--danger"
                      onClick={() => remove(entry)}
                    >
                      移除
                    </button>
                  </>
                ) : hasSharedLink(entry.share.id) ? (
                  <>
                    <small className="ShareAdded">已添加</small>
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() => togglePause(entry, true)}
                    >
                      暂停
                    </button>
                    <button
                      type="button"
                      className="button button--danger"
                      onClick={() => remove(entry)}
                    >
                      移除
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={() => add(entry)}
                  >
                    添加
                  </button>
                )}
              </span>
            </div>
          ))
        )}

        {message && <p className="info">{message}</p>}
        {error && <p className="info is-error">{error}</p>}
      </div>
    </div>
  );
};

export default LinkShare;
