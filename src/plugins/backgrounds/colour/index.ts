import { Config } from "../../types";
import Colour from "./Colour";
import ColourSettings from "./ColourSettings";

const config: Config = {
  key: "background/colour",
  name: "纯色",
  description: "添加一抹色彩。",
  dashboardComponent: Colour,
  settingsComponent: ColourSettings,
};

export default config;
