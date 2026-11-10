import React from "react";
import { db } from "../../db/state";
import { useKey } from "../../lib/db/react";
import TimeZoneInput from "../shared/timeZone/TimeZoneInput";

const System: React.FC = () => {
  const [timeZone, setTimeZone] = useKey(db, "timeZone");

  return (
    <div>
      <h2>设置</h2>

      <label
        style={{
          alignItems: "center",
          display: "grid",
          gridGap: "0 0.5rem",
          gridTemplateColumns: "1fr 2fr",
          width: "100%",
          margin: 0,
        }}
      >
        时区
        <TimeZoneInput timeZone={timeZone} onChange={setTimeZone} />
      </label>
    </div>
  );
};

export default System;
