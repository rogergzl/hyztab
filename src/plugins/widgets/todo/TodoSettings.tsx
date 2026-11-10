import React, { FC } from "react";

import { Props, defaultData } from "./types";

const TodoSettings: FC<Props> = ({ data = defaultData, setData }) => (
  <div className="SearchSettings">
    <label>
      显示任务数
      <input
        type="number"
        min="0"
        onChange={(event) =>
          setData({ ...data, show: Number(event.target.value) })
        }
        placeholder="要显示的待办事项数量"
        value={data.show}
      />
    </label>

    <label>
      新建任务快捷键
      <input
        type="text"
        maxLength={1}
        onChange={(event) => setData({ ...data, keyBind: event.target.value })}
        value={data.keyBind}
      />
    </label>
  </div>
);

export default TodoSettings;
