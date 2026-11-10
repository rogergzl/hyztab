import React, { FC } from "react";

import { Props, defaultData } from "./types";
import TimeZoneInput from "../../../views/shared/timeZone/TimeZoneInput";

const TimeSettings: FC<Props> = ({ data = defaultData, setData }) => (
  <div className="TimeSettings">
    <label>
      名称
      <input
        type="text"
        value={data.name}
        placeholder="可选名称"
        onChange={(event) => setData({ ...data, name: event.target.value })}
      />
    </label>

    <label>
      时区
      <TimeZoneInput
        timeZone={data.timeZone}
        onChange={(timeZone) => setData({ ...data, timeZone })}
      />
    </label>

    <label>
      <input
        type="radio"
        checked={data.mode === "analogue"}
        onChange={() => setData({ ...data, mode: "analogue" })}
      />{" "}
      模拟时钟
    </label>

    <label>
      <input
        type="radio"
        checked={data.mode === "digital" && data.hour12}
        onChange={() => setData({ ...data, mode: "digital", hour12: true })}
      />{" "}
      12 小时制数字
    </label>

    <label>
      <input
        type="radio"
        checked={data.mode === "digital" && !data.hour12}
        onChange={() => setData({ ...data, mode: "digital", hour12: false })}
      />{" "}
      24 小时制数字
    </label>

    <label>
      <input
        type="checkbox"
        checked={data.showSeconds}
        onChange={() => setData({ ...data, showSeconds: !data.showSeconds })}
      />{" "}
      显示秒数
    </label>

    <label>
      <input
        type="checkbox"
        checked={data.showMinutes}
        onChange={() => setData({ ...data, showMinutes: !data.showMinutes })}
      />{" "}
      显示分钟
    </label>

    {data.mode === "digital" && data.hour12 && (
      <label>
        <input
          type="checkbox"
          checked={data.showDayPeriod}
          onChange={() =>
            setData({ ...data, showDayPeriod: !data.showDayPeriod })
          }
        />{" "}
        显示上午/下午
      </label>
    )}

    <label>
      <input
        type="checkbox"
        checked={data.showDate}
        onChange={() => setData({ ...data, showDate: !data.showDate })}
      />{" "}
      显示日期
    </label>
  </div>
);

export default TimeSettings;
