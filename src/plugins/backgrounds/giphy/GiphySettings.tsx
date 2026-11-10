import React, { FC } from "react";

import { Props, defaultData } from "./types";
import { DebounceInput } from "../../shared";

const GiphySettings: FC<Props> = ({ data = defaultData, setData }) => (
  <div className="GiphySettings">
    <label>
      动图来源
      <select
        value={data.source}
        onChange={(event) =>
          setData({ ...data, source: event.target.value as any })
        }
      >
        <option value="custom">自定义动图地址</option>
        <option value="official">GIPHY 官方（需自备 API 密钥）</option>
      </select>
    </label>

    {data.source === "custom" ? (
      <>
        <label>
          动图地址
          <DebounceInput
            type="text"
            value={data.customUrl}
            placeholder="https://example.com/random.gif"
            onChange={(value) => setData({ ...data, customUrl: value })}
            wait={500}
          />
        </label>
        <p className="info">
          填入一个直接返回图片的地址（GIF 即为动图）。每次刷新会请求一次，
          因此随机图接口即可持续换图。默认地址是国内可直连的社区动图接口，
          若失效请替换为任意可用地址。
        </p>
      </>
    ) : (
      <>
        <label>
          标签
          <DebounceInput
            type="text"
            value={data.tag}
            onChange={(value) => setData({ ...data, tag: value })}
            wait={500}
          />
        </label>
        <p className="info">多个标签用逗号分隔</p>

        <label>
          <input
            type="checkbox"
            checked={!data.nsfw}
            onChange={(event) => setData({ ...data, nsfw: !data.nsfw })}
          />{" "}
          安全搜索
        </label>

        <p className="info">
          官方接口需要在构建时提供 GIPHY_API_KEY，且在国内通常无法直连。
          没有密钥时请改用自定义动图地址。
        </p>
      </>
    )}

    <label>
      <input
        type="checkbox"
        checked={data.expand}
        onChange={(event) => setData({ ...data, expand: !data.expand })}
      />{" "}
      拉伸填满屏幕
    </label>
  </div>
);

export default GiphySettings;
