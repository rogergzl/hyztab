import React from "react";
import { UiContext } from "../../contexts/ui";
import { exportStore, importStore, resetStore } from "../../db/action";
import { useKeyPress } from "../../hooks";
import Logo from "../shared/Logo";
import Background from "./Background";
import LinksGrid from "./LinksGrid";
import Persist from "./Persist";
import "./Settings.sass";
import System from "./System";
import Widgets from "./Widgets";

const Settings: React.FC = () => {
  const { toggleSettings } = React.useContext(UiContext);

  const handleReset = () => {
    if (
      confirm(
        "确定要删除所有 花与竹标签 设置吗？此操作不可撤销。",
      )
    )
      resetStore();
  };

  const handleExport = () => {
    const json = exportStore();
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );

    const a = document.createElement("a");
    document.body.appendChild(a);
    a.style.display = "none";
    a.href = url;
    a.download = "花与竹标签-设置.json";
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.style.display = "none";
    input.type = "file";
    input.addEventListener("change", function () {
      if (this.files) {
        const file = this.files[0];
        const reader = new FileReader();
        reader.addEventListener("load", (event) => {
          if (event.target && event.target.result) {
            try {
              const state = JSON.parse(event.target.result as string);
              importStore(state);
            } catch (error) {
              alert(
                `无效的导入文件：${
                  error instanceof Error ? error.message : "未知错误"
                }`,
              );
            }
          }
        });
        reader.readAsText(file);
      }
      document.body.removeChild(input);
    });
    input.click();
  };

  useKeyPress(toggleSettings, ["Escape"]);

  return (
    <div className="Settings">
      <a onClick={toggleSettings} className="fullscreen" />

      <div className="plane">
        <Logo />

        <Background />

        <LinksGrid />

        <Widgets />

        <System />

        <p style={{ marginBottom: "2rem" }}>
          <a onClick={handleImport}>导入</a>、{" "}
          <a onClick={handleExport}>导出</a>或{" "}
          <a onClick={handleReset}>重置</a>您的设置
        </p>

        <Persist />
      </div>
    </div>
  );
};

export default React.memo(Settings);
