import { Config } from "../../types";
import Gradient from "./Gradient";
import GradientSettings from "./GradientSettings";

const config: Config = {
  key: "background/gradient",
  name: "渐变",
  description: "添加更多色彩斑斓的效果。",
  dashboardComponent: Gradient,
  settingsComponent: GradientSettings,
};

export default config;
