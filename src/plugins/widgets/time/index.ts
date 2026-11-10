import { Config } from "../../types";
import Time from "./Time";
import TimeSettings from "./TimeSettings";

const config: Config = {
  key: "widget/time",
  name: "时间",
  description: "准时。",
  dashboardComponent: Time,
  settingsComponent: TimeSettings,
};

export default config;
