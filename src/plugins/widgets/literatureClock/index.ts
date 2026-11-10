/**
 * Literature Clock Widget for 花与竹标签
 * Forked by Ngoc L.B. <contact@ngoclb.com>
 * ===
 * Clock using time quotes from the literature, based on work and idea by Jaap Meijers (E-reader clock).
 * @url http://jenevoldsen.com/literature-clock/
 * @url https://github.com/JohannesNE/literature-clock
 */
import { Config } from "../../types";
import LiteratureClock from "./LiteratureClock";
import LiteratureClockSettings from "./LiteratureClockSettings";

const config: Config = {
  key: "widget/literature-clock",
  name: "文学时钟",
  description: "优雅地查看时间。",
  dashboardComponent: LiteratureClock,
  settingsComponent: LiteratureClockSettings,
};

export default config;
