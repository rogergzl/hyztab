import { Config } from "../../types";
import Greeting from "./Greeting";
import GreetingSettings from "./GreetingSettings";

const config: Config = {
  key: "widget/greeting",
  name: "问候语",
  description: "全天享受个性化的问候。",
  dashboardComponent: Greeting,
  settingsComponent: GreetingSettings,
};

export default config;
