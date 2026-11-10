import { Config } from "../../types";
import Weather from "./Weather";
import WeatherSettings from "./WeatherSettings";

const config: Config = {
  key: "widget/weather",
  name: "天气",
  description: "加一扇窗看看外面。",
  dashboardComponent: Weather,
  settingsComponent: WeatherSettings,
};

export default config;
