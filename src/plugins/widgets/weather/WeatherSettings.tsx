import React, { FC } from "react";
import LocationInput from "./LocationInput";
import { defaultData, Props } from "./types";

const WeatherSettings: FC<Props> = ({ data = defaultData, setData }) => (
  <div className="WeatherSettings">
    <LocationInput
      latitude={data.latitude}
      longitude={data.longitude}
      onChange={(location) => setData({ ...data, ...location })}
    />

    {data.latitude && data.latitude ? (
      <>
        <label>
          名称
          <input
            type="text"
            value={data.name || ""}
            placeholder="可选名称"
            onChange={(event) =>
              setData({ ...data, name: event.target.value || undefined })
            }
          />
        </label>

        <hr />

        <label>
          <input
            type="checkbox"
            checked={data.showDetails}
            onChange={() =>
              setData({ ...data, showDetails: !data.showDetails })
            }
          />{" "}
          显示详细天气信息
        </label>

        <label>
          <input
            type="radio"
            checked={data.units === "si"}
            onChange={() => setData({ ...data, units: "si" })}
          />{" "}
          公制单位
        </label>

        <label>
          <input
            type="radio"
            checked={data.units === "us"}
            onChange={() => setData({ ...data, units: "us" })}
          />{" "}
          英制单位
        </label>

        <p>
          <a
            href="https://open-meteo.com/"
            rel="noopener noreferrer"
            target="_blank"
          >
            天气数据由 Open-Meteo.com 提供
          </a>
        </p>
      </>
    ) : null}
  </div>
);

export default WeatherSettings;
