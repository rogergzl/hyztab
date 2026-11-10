import { Config } from "../../types";
import Js from "./Js";
import JsSettings from "./JsSettings";

const config: Config = {
  key: "widget/js",
  name: "自定义 JS",
  description: "在您的程序中编程。",
  dashboardComponent: Js,
  settingsComponent: JsSettings,
};

export default config;
