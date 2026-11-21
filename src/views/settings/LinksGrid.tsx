import React from "react";
import { FormattedMessage } from "react-intl";

import {
  setBookmarkSync,
  setLinkProxyFallback,
  setLinksGrid,
} from "../../db/action";
import {
  addProxyNode,
  removeProxyNode,
} from "../../db/linkProxyNodes";
import {
  COLUMN_OPTIONS,
  LinksGrid as Grid,
  ROW_OPTIONS,
  clampLinksGrid,
  gridCapacity,
} from "../../db/linksGrid";
import {
  isValidProxyAddress,
  normalizeProxyNodes,
  proxySupported,
} from "../../lib/linkProxy";
import { db } from "../../db/state";
import { useValue } from "../../lib/db/react";
import LinkShare from "./LinkShare";

/**
 * Page level settings shared by every quick links widget.
 *
 * Kept beside the background section because routing, bookmarks and sharing
 * are browser/page concerns rather than properties of a single widget.
 */
const LinksGrid: React.FC = () => {
  const stored = useValue(db, "linksGrid");
  const grid = clampLinksGrid(stored);
  const bookmarkSync = useValue(db, "bookmarkSync");
  const fallback = useValue(db, "linkProxyFallback") ?? "";
  const nodes = normalizeProxyNodes(useValue(db, "linkProxyNodes"));
  const [nodeName, setNodeName] = React.useState("");
  const [nodeAddress, setNodeAddress] = React.useState("");

  const select = (key: keyof Grid) => (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => setLinksGrid({ [key]: Number(event.target.value) });

  const addNode = () => {
    if (!addProxyNode(nodeName, nodeAddress)) return;
    setNodeName("");
    setNodeAddress("");
  };

  return (
    <div>
      <h2>
        <FormattedMessage
          id="linksGrid"
          defaultMessage="快速链接网格"
          description="Links grid title"
        />
      </h2>

      <div className="Widget">
        <h4>网格尺寸</h4>

        <div className="settings">
          <label>
            横向每排个数
            <select value={grid.columns} onChange={select("columns")}>
              {COLUMN_OPTIONS.map((columns) => (
                <option key={columns} value={columns}>
                  {columns}
                </option>
              ))}
            </select>
          </label>

          <label>
            纵向排数
            <select value={grid.rows} onChange={select("rows")}>
              {ROW_OPTIONS.map((rows) => (
                <option key={rows} value={rows}>
                  {rows}
                </option>
              ))}
            </select>
          </label>

          <p className="info">
            每页 {gridCapacity(grid)} 个槽位，排满自动分页，所有组件共用。
          </p>
        </div>
      </div>

      <div className="Widget">
        <h4>书签同步</h4>

        <div className="settings">
          <label>
            <input
              type="checkbox"
              checked={bookmarkSync}
              onChange={() => setBookmarkSync(!bookmarkSync)}
            />
            在书签栏镜像快速链接
          </label>

          <p className="info">删除链接后，点网格右下角图标同步书签。</p>
        </div>
      </div>

      <div className="Widget">
        <h4>默认代理节点</h4>

        <div className="settings">
          <p className="info">配置常用节点后，可在单个链接中直接选择。</p>

          {nodes.map((node) => (
            <div className="ShareIdentityRow" key={node.id}>
              <span>
                <strong>{node.name}</strong>
                <small>{node.address}</small>
              </span>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => removeProxyNode(node.id)}
              >
                删除
              </button>
            </div>
          ))}

          <label>
            名称
            <input
              type="text"
              value={nodeName}
              placeholder="例如：家里"
              onChange={(event) => setNodeName(event.target.value)}
            />
          </label>

          <label>
            地址
            <input
              type="text"
              spellCheck={false}
              value={nodeAddress}
              placeholder="127.0.0.1:7890 或 socks5://127.0.0.1:1080"
              onChange={(event) => setNodeAddress(event.target.value)}
            />
          </label>

          <button
            type="button"
            className="button button--primary"
            disabled={!isValidProxyAddress(nodeAddress)}
            onClick={addNode}
          >
            添加节点
          </button>

          {nodeAddress.trim() !== "" && !isValidProxyAddress(nodeAddress) && (
            <p className="info is-error">需形如 主机:端口，支持 http / socks5 / socks4。</p>
          )}
        </div>
      </div>

      <div className="Widget">
        <h4>代理兜底</h4>

        <div className="settings">
          <label>
            其余网站走
            <input
              type="text"
              spellCheck={false}
              value={fallback}
              placeholder="留空则直连，如 127.0.0.1:7890"
              onChange={(event) => setLinkProxyFallback(event.target.value)}
            />
          </label>

          <p className="info">未指定域名的网站先走这里，连不上再直连。</p>
          {fallback.trim() !== "" && !isValidProxyAddress(fallback) && (
            <p className="info is-error">地址格式不正确，需形如 主机:端口。</p>
          )}
          {!proxySupported() && (
            <p className="info is-error">当前浏览器不支持扩展设置代理（需 Chrome 或 Edge）。</p>
          )}
        </div>
      </div>

      <LinkShare />
    </div>
  );
};

export default LinksGrid;
