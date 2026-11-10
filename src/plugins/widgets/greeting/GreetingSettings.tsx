import React, { FC } from "react";

import { Props, defaultData } from "./types";

const GreetingSettings: FC<Props> = ({ data = defaultData, setData }) => (
  <div className="GreetingSettings">
    <label>
      名称
      <input
        type="text"
        value={data.name}
        onChange={(event) => setData({ name: event.target.value })}
      />
    </label>
  </div>
);

export default GreetingSettings;
