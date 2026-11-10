import { Config } from "../../types";
import Unsplash from "./Unsplash";
import UnsplashSettings from "./UnsplashSettings";

const config: Config = {
  // Key kept from the original plugin so stored settings still resolve.
  key: "background/unsplash",
  name: "随机美图",
  description: "Bing 每日壁纸、自定义图源或 Unsplash 官方接口。",
  dashboardComponent: Unsplash,
  settingsComponent: UnsplashSettings,
  supportsBackdrop: true,
};

export default config;
