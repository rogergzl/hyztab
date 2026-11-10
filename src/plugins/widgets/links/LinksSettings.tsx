import React, { FC, useCallback, useEffect, useState } from "react";

import { setSiteTitle } from "../../../db/action";
import { clampLinksGrid, gridCapacity } from "../../../db/linksGrid";
import {
  dropSiteTitleAccess,
  hasSiteTitleAccess,
  requestSiteTitleAccess,
} from "../../../lib/siteTitle";
import { db } from "../../../db/state";
import { useValue } from "../../../lib/db/react";
import { Props, defaultData } from "./types";

/**
 * Per widget options.
 *
 * The grid size is not here on purpose: it is a shared setting with its own
 * sidebar section, so changing it once affects every quick links widget.
 */
const LinksSettings: FC<Props> = ({ data = defaultData, setData }) => {
  const grid = clampLinksGrid(useValue(db, "linksGrid"));
  const siteTitle = useValue(db, "siteTitle");
  const [granted, setGranted] = useState(false);
  const [refused, setRefused] = useState(false);

  // Report the real state of the optional access, which may have been granted
  // or taken away from the browser's own extension settings.
  useEffect(() => {
    hasSiteTitleAccess().then(setGranted);
  }, []);

  const toggleSiteTitle = useCallback(async () => {
    if (siteTitle) {
      // Hand the access back as well, so switching the feature off leaves
      // nothing granted behind.
      setSiteTitle(false);
      await dropSiteTitleAccess();
      setGranted(false);
      setRefused(false);
      return;
    }

    // Must be the first thing the click does: a browser only honours a
    // permission request that comes straight from a user gesture.
    const allowed = await requestSiteTitleAccess();
    setGranted(allowed);
    setRefused(!allowed);
    if (allowed) setSiteTitle(true);
  }, [siteTitle]);

  return (
    <div className="LinksSettings">
      <label>
        <input
          type="checkbox"
          checked={data.visible}
          onChange={() => setData({ ...data, visible: !data.visible })}
        />
        链接始终可见
      </label>

      <label>
        <input
          type="checkbox"
          checked={data.linkOpenStyle}
          onChange={() =>
            setData({ ...data, linkOpenStyle: !data.linkOpenStyle })
          }
        />
        链接在新标签页中打开
      </label>

      <label>
        <input
          type="checkbox"
          checked={siteTitle}
          onChange={toggleSiteTitle}
        />
        读取站点名称作为完整名称
      </label>

      <p className="info">
        开启后，配置链接时会访问该网址并读取它自己的 <code>&lt;title&gt;</code>
        作为<strong>完整名称</strong>；关闭后仅按域名推导（如 <code>nas1p</code>）。
        <br />
        只在你配置链接时读取一次，<strong>浏览网页时不会读取任何内容</strong>，
        请求也不带 Cookie。此功能需要申请
        <strong>「读取和更改您在所有网站上的数据」</strong>权限（浏览器的可选权限，
        只在开启时申请、关闭时自动交还）。
        {refused && (
          <>
            <br />
            <span className="is-error">权限被拒绝，功能未开启。</span>
          </>
        )}
        {!refused && siteTitle && !granted && (
          <>
            <br />
            <span className="is-error">设置已开，但权限似乎已被撤销。</span>
          </>
        )}
      </p>

      <p className="info">
        本页最多 <strong>{gridCapacity(grid)}</strong> 个链接（{grid.rows} 行 ×{" "}
        {grid.columns} 列），在侧边栏的<strong>快速链接网格</strong>里调整。
        在快速链接区域<strong>右键</strong>新增，右键某个链接进行编辑，
        改动会<strong>自动保存</strong>。
      </p>
    </div>
  );
};

export default LinksSettings;
