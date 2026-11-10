import { Config } from "../../types";
import GitHubCalendarWidget from "./GitHub";
import GitHubSettings from "./GitHubSettings";

const config: Config = {
  key: "widget/github",
  name: "GitHub 日历",
  description: "用绿色方块激励自己。",
  dashboardComponent: GitHubCalendarWidget,
  settingsComponent: GitHubSettings,
};

export default config;
