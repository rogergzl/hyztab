import { Config } from "../../types";
import Search from "./Search";
import SearchSettings from "./SearchSettings";

const config: Config = {
  key: "widget/search",
  name: "搜索框",
  description: "把地址栏搬过来。",
  dashboardComponent: Search,
  settingsComponent: SearchSettings,
};

export default config;
