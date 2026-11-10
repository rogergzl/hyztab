import { Config } from "../../types";
import Links from "./Links";
import LinksSettings from "./LinksSettings";

const config: Config = {
  key: "widget/links",
  name: "快速链接",
  // Speaks to how links are actually added, so the widget dropdown in the
  // sidebar is not mistaken for the way to add a link.
  description: "在主页右键即可新增链接。",
  dashboardComponent: Links,
  settingsComponent: LinksSettings,
  // A full page of the grid is a page wide band, so leaving it in the middle
  // would press it up against the greeting above it.
  defaultPosition: "bottomCentre",
};

export default config;
