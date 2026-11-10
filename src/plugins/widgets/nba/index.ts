import { Config } from "../../types";
import Nba from "./Nba";
import NbaSettings from "./NbaSettings";

const config: Config = {
  key: "widget/nba",
  name: "NBA 比分",
  description: "追踪今日 NBA 赛况。",
  dashboardComponent: Nba,
  settingsComponent: NbaSettings,
};

export default config;
