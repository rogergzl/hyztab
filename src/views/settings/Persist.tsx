import React from "react";
import {
  persistConfig,
  readPersistedConfig,
  restorePersistedConfig,
} from "../../db/action";

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleString("zh-CN", { hour12: false });

/**
 * The standalone web build needs the StorageManager prompt: its settings live
 * in IndexedDB and browsers may evict them. A browser extension already keeps
 * `chrome.storage.sync` durably, so there instead we offer an explicit local
 * snapshot the user can save and restore from the same place.
 */
const Persist: React.FC = () => {
  const [error, setError] = React.useState(false);
  const [persisted, setPersisted] = React.useState(true); // Hide until we know otherwise
  const [snapshot, setSnapshot] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    if (BUILD_TARGET === "web") {
      if (navigator.storage)
        navigator.storage.persisted().then(setPersisted).catch(() => {});
      return;
    }

    readPersistedConfig()
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  }, []);

  if (BUILD_TARGET === "web") {
    if (persisted) return null;

    const handleWebClick = () => {
      navigator.storage
        .persist()
        .then((result) => (result ? setPersisted(result) : setError(true)))
        .catch(() => setError(true));
    };

    return (
      <div className="Widget" style={{ textAlign: "center" }}>
        <h4>持久化设置</h4>
        <p>是否让 花与竹标签 请求浏览器永久保存您的设置？</p>
        {error ? (
          <p>暂时无法持久化设置。</p>
        ) : (
          <button className="button button--primary" onClick={handleWebClick}>
            持久化设置
          </button>
        )}
      </div>
    );
  }

  const handleSave = async () => {
    try {
      const savedAt = await persistConfig();
      if (!savedAt) throw new Error("unsupported");
      setSnapshot(savedAt);
      setMessage(`已保存到本机：${formatTime(savedAt)}`);
    } catch {
      setMessage("保存失败，请检查浏览器存储是否可用。");
    }
  };

  const handleRestore = async () => {
    if (!window.confirm("确定用本机快照覆盖当前配置吗？此操作不可撤销。"))
      return;
    try {
      const savedAt = await restorePersistedConfig();
      if (!savedAt) throw new Error("missing");
      setMessage(`已恢复：${formatTime(savedAt)}`);
    } catch {
      setMessage("恢复失败，未找到可用的本机快照。");
    }
  };

  return (
    <div className="Widget PersistCard">
      <h4>持久化配置</h4>
      <p>扩展设置由浏览器自动保存；这里可再存一份本机快照，防止误重置。</p>
      <div className="PersistCard__actions">
        <button className="button button--primary" onClick={handleSave}>
          保存到本机
        </button>
        <button
          className="button button--secondary"
          onClick={handleRestore}
          disabled={!snapshot}
        >
          恢复快照
        </button>
      </div>
      <small>
        {snapshot ? `本机快照：${formatTime(snapshot)}` : "尚无本机快照"}
        {message ? ` · ${message}` : ""}
      </small>
      <small className="PersistCard__hint">
        快照保存在本机浏览器，包含分享私钥，不会上传，也不在导出的设置文件里。
      </small>
    </div>
  );
};

export default Persist;
