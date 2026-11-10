import { Config } from "../../types";
import IpInfo from "./IpInfo";
import IpInfoSettings from "./IpInfoSettings";

const config: Config = {
  key: "widget/ipInfo",
  name: "IP 信息",
  description: "显示您的 IP 和位置信息",
  dashboardComponent: IpInfo,
  settingsComponent: IpInfoSettings,
};

export default config;
