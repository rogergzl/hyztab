import { Config } from "../../types";
import Css from "./Css";
import CssSettings from "./CssSettings";

const config: Config = {
  key: "widget/css",
  name: "自定义 CSS",
  description: "让您的新标签页更有风格（高级用户）。",
  dashboardComponent: Css,
  settingsComponent: CssSettings,
};

export default config;
