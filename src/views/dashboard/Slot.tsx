import React from "react";
import { WidgetPosition, WidgetState } from "../../db/state";
import { findConfig } from "../../plugins";
import Plugin from "../shared/Plugin";
import "./Slot.sass";
import Widget from "./Widget";

type Props = {
  position: WidgetPosition;
  widgets: WidgetState[];
};

const Slot: React.FC<Props> = ({ position, widgets }) => (
  <div className={`Slot ${position}`}>
    {widgets.map(({ display, id, key }) => {
      // A widget naming a plugin that no longer ships is skipped, so removing
      // a plugin never breaks a profile that still refers to it.
      const config = findConfig(key);
      if (!config) return null;

      return (
        <Widget key={id} {...display}>
          <Plugin id={id} component={config.dashboardComponent} />
        </Widget>
      );
    })}
  </div>
);

export default Slot;
