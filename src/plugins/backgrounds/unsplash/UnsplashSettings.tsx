import React from "react";
import { Icon } from "../../../views/shared";
import { DebounceInput } from "../../shared";
import topics from "./topics.json";
import { defaultData, Props } from "./types";

const UnsplashSettings: React.FC<Props> = ({ data = defaultData, setData }) => (
  <div className="UnsplashSettings">
    <label>
      <span style={{ float: "right" }}>
        {data.paused ? <span className="text--grey">（已暂停） </span> : null}
        <a onClick={() => setData({ ...data, paused: !data.paused })}>
          <Icon name={data.paused ? "play" : "pause"} />
        </a>
      </span>
      显示新图片
      <select
        value={data.timeout}
        onChange={(event) =>
          setData({ ...data, timeout: Number(event.target.value) })
        }
      >
        <option value="0">每个新标签页</option>
        <option value="300">每 5 分钟</option>
        <option value="900">每 15 分钟</option>
        <option value="3600">每小时</option>
        <option value="86400">每天</option>
        <option value="604800">每周</option>
      </select>
    </label>

    <label>
      图片来源
      <select
        value={data.source}
        onChange={(event) =>
          setData({ ...data, source: event.target.value as any })
        }
      >
        <option value="bing">Bing 每日壁纸（国内直连，无需密钥）</option>
        <option value="custom">自定义图片地址</option>
        <option value="official">Unsplash 官方（需自备 API 密钥）</option>
      </select>
    </label>

    {data.source === "custom" && (
      <label>
        图片地址
        <DebounceInput
          type="text"
          value={data.customUrl}
          placeholder="https://example.com/random.jpg"
          onChange={(value) => setData({ ...data, customUrl: value })}
          wait={500}
        />
      </label>
    )}

    {data.source === "custom" && (
      <p className="info">
        填入一个直接返回图片的地址。每次刷新会请求一次，因此随机图接口即可持续换图。
      </p>
    )}

    {data.source === "official" && (
      <>
        <label>
          <input
            type="radio"
            checked={data.by === "official"}
            onChange={() => setData({ ...data, by: "official" })}
          />{" "}
          官方合集
        </label>

        <label>
          <input
            type="radio"
            checked={data.by === "topics"}
            onChange={() => setData({ ...data, by: "topics" })}
          />{" "}
          主题
        </label>

        <label>
          <input
            type="radio"
            checked={data.by === "search"}
            onChange={() => setData({ ...data, by: "search" })}
          />{" "}
          搜索
        </label>

        <label>
          <input
            type="radio"
            checked={data.by === "collections"}
            onChange={() => setData({ ...data, by: "collections" })}
          />{" "}
          合集
        </label>

        {data.by === "topics" && (
          <label>
            主题
            <select
              value={data.topics}
              onChange={(event) =>
                setData({ ...data, topics: event.target.value })
              }
            >
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title}
                </option>
              ))}
            </select>
          </label>
        )}

        {data.by === "search" && (
          <>
            <label>
              标签
              <DebounceInput
                type="text"
                value={data.search}
                placeholder="试试风景或动物..."
                onChange={(value) => setData({ ...data, search: value })}
                wait={500}
              />
            </label>

            <label>
              <input
                type="checkbox"
                checked={data.featured}
                onChange={(event) =>
                  setData({ ...data, featured: !data.featured })
                }
              />{" "}
              仅显示精选图片
            </label>
          </>
        )}

        {data.by === "collections" && (
          <label>
            合集 ID
            <DebounceInput
              type="text"
              value={data.collections}
              placeholder="合集 ID 编号"
              onChange={(value) => setData({ ...data, collections: value })}
              wait={500}
            />
          </label>
        )}

        <p className="info">
          官方接口需要在构建时提供 UNSPLASH_API_KEY，且在国内通常无法直连。
          没有密钥时请改用 Bing 每日壁纸或自定义地址。
        </p>
      </>
    )}
  </div>
);

export default UnsplashSettings;
