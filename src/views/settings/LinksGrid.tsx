import React from "react";
import { FormattedMessage } from "react-intl";

import { setBookmarkSync, setLinksGrid } from "../../db/action";
import {
  COLUMN_OPTIONS,
  LinksGrid as Grid,
  ROW_OPTIONS,
  clampLinksGrid,
  gridCapacity,
} from "../../db/linksGrid";
import { db } from "../../db/state";
import { useValue } from "../../lib/db/react";

/**
 * The shared grid size for quick links.
 *
 * Sits beside the background section because it is a page level setting, not
 * a property of one widget: every quick links widget reads the same grid.
 */
const LinksGrid: React.FC = () => {
  const stored = useValue(db, "linksGrid");
  const grid = clampLinksGrid(stored);
  const bookmarkSync = useValue(db, "bookmarkSync");

  const select = (key: keyof Grid) => (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => setLinksGrid({ [key]: Number(event.target.value) });

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
            每页 <strong>{grid.columns}</strong> 个横排 ×{" "}
            <strong>{grid.rows}</strong> 排 ={" "}
            <strong>{gridCapacity(grid)}</strong> 个槽位，从第一排左起依次填充，
            排满后自动分页（页码或鼠标滚轮翻页）。所有快速链接组件共用这一份设置。
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

          <p className="info">
            开启后会在书签栏创建文件夹<strong>「标签页备份书签，请勿删除」</strong>，
            新增快速链接时自动写入对应书签（链接的短名称存为书签名称，网址存为书签网址），
            顺序与网格一致，从第一排左起。
            <br />
            删除链接时<strong>不会</strong>自动删除书签：网格右下角的
            <strong>转动图标</strong>是手动同步入口，悬浮可看待同步数量，
            点击后才会删掉已移除链接对应的书签。
            <br />
            需要<strong>「书签」权限</strong>。浏览器不支持书签接口时该功能自动隐藏。
          </p>
        </div>
      </div>
    </div>
  );
};

export default LinksGrid;
