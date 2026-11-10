import { Config } from "../../types";
import WorkHours from "./WorkHours";
import WorkHoursSettings from "./WorkHoursSettings";

const config: Config = {
  key: "widget/workHours",
  name: "工作时间",
  description: "倒计时下班时间。",
  dashboardComponent: WorkHours,
  settingsComponent: WorkHoursSettings,
};

export default config;
