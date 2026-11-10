import React from "react";
import { FormattedMessage } from "react-intl";
import { addWidget, removeWidget, reorderWidget } from "../../db/action";
import { selectWidgets } from "../../db/select";
import { db } from "../../db/state";
import { useSelector } from "../../lib/db/react";
import { findConfig, widgetConfigs } from "../../plugins";
import Widget from "./Widget";

const Widgets: React.FC = () => {
  const widgets = useSelector(db, selectWidgets);

  return (
    <div>
      <h2>
        <FormattedMessage
          id="widgets"
          defaultMessage="Widgets"
          description="Widgets title"
        />
      </h2>

      <label>
        <select
          value=""
          onChange={(event) => {
            const key = event.target.value;
            // A plugin can ask for a better home than the middle of the page.
            addWidget(key, widgetConfigs.find((c) => c.key === key)?.defaultPosition);
          }}
          className="primary"
        >
          <option disabled value="">
            添加新组件
          </option>
          {widgetConfigs.map((plugin) => (
            <option key={plugin.key} value={plugin.key}>
              {plugin.name}
            </option>
          ))}
        </select>
      </label>

      {/* A widget whose plugin no longer ships is left out, not crashed on.
          The original index is kept so reordering still matches the store. */}
      {widgets.map((widget, index) =>
        findConfig(widget.key) ? (
          <Widget
            key={widget.id}
            plugin={widget}
            onMoveUp={
              index > 0 ? () => reorderWidget(index, index - 1) : undefined
            }
            onMoveDown={
              index < widgets.length - 1
                ? () => reorderWidget(index, index + 1)
                : undefined
            }
            onRemove={() => removeWidget(widget.id)}
          />
        ) : null,
      )}
    </div>
  );
};

export default Widgets;
