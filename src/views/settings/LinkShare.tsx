import React from "react";

import {
  addShareIdentity,
  addSharedLink,
  hasSharedLink,
  normalizeShareConfig,
  removeShareIdentity,
  setShareServiceUrl,
} from "../../db/linkShare";
import { db } from "../../db/state";
import { useValue } from "../../lib/db/react";
import {
  generateIdentity,
  listIncoming,
  normalizeServiceUrl,
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
 * The relay address, named local key pairs and the list of shares addressed to
 * them all live here; individual links only carry the small metadata needed to
 * publish or refresh their payload.
 */
const LinkShare: React.FC = () => {
  const config = normalizeShareConfig(useValue(db, "linkShare"));
  const [service, setService] = React.useState(config.serviceUrl);
  const [name, setName] = React.useState("");
  const [incoming, setIncoming] = React.useState<Incoming[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  let serviceUrl = "";
  try {
    serviceUrl = normalizeServiceUrl(config.serviceUrl);
  } catch (e) {
    void e;
    serviceUrl = "";
  }

  const signingIdentities = config.identities.filter(
    (identity) => identity.privateKey,
  );
  const identityKey = signingIdentities
    .map((identity) => identity.fingerprint)
    .join(",");

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
      setIncoming(batches.flat());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
    // identityKey is the stable dependency for the identity array contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceUrl, identityKey]);

  React.useEffect(() => {
    loadIncoming();
  }, [loadIncoming]);

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
      await registerIdentity(serviceUrl, identity);
      if (!addShareIdentity(identity))
        throw new Error("该密钥已存在，无需重复生成");
      setName("");
      setMessage(`密钥「${identity.name}」已创建`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="Widget">
      <h4>标签分享</h4>

      <div className="settings">
        <p className="info">无需账号；密钥只保存在本机，私钥不上传。</p>

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

        <label>
          密钥名称
          <input
            type="text"
            value={name}
            placeholder="例如：我的主电脑"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="button button--secondary"
          disabled={loading || !serviceUrl}
          onClick={createIdentity}
        >
          生成密钥
        </button>

        {config.identities.map((identity) => (
          <div className="ShareIdentityRow" key={identity.id}>
            <span>
              <strong>{identity.name}</strong>
              <small>{identity.fingerprint.slice(0, 12)}</small>
            </span>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => removeShareIdentity(identity.id)}
            >
              删除
            </button>
          </div>
        ))}

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
            <div className="ShareIdentityRow" key={`${entry.identity.id}-${entry.share.id}`}>
              <span>
                <strong>
                  {entry.share.payload.shortName ||
                    entry.share.payload.name ||
                    "未命名链接"}
                </strong>
                <small>{entry.share.payload.url}</small>
              </span>
              <button
                type="button"
                className="button button--primary"
                onClick={() => add(entry)}
              >
                添加
              </button>
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
