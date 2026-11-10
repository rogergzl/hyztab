import React, { FC } from "react";

import { engines } from "./engines";
import { Props, defaultData } from "./types";

const SearchSettings: FC<Props> = ({ data = defaultData, setData }) => (
  <div className="SearchSettings">
    <label>
      搜索引擎
      <select
        onChange={(event) =>
          setData({ ...data, searchEngine: event.target.value })
        }
        value={data.searchEngine}
      >
        {engines.map(({ key, name }) => (
          <option key={key} value={key}>
            {name}
          </option>
        ))}
      </select>
    </label>

    {BUILD_TARGET === "web" && (
      <label>
        搜索建议
        <select
          onChange={(event) =>
            setData({ ...data, suggestionsEngine: event.target.value })
          }
          value={data.suggestionsEngine}
        >
          <option key="off" value="">
            关闭
          </option>
          {engines
            .filter(({ suggest_url }) => Boolean(suggest_url))
            .map(({ key, name }) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
        </select>
      </label>
    )}

    {data.suggestionsEngine && (
      <label>
        建议数量
        <input
          type="number"
          min="1"
          max="10"
          value={data.suggestionsQuantity}
          onChange={(event) =>
            setData({
              ...data,
              suggestionsQuantity: Number(event.target.value),
            })
          }
        />
      </label>
    )}
  </div>
);

export default SearchSettings;
