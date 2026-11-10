import { Config } from "../../types";
import Giphy from "./Giphy";
import GiphySettings from "./GiphySettings";

const config: Config = {
  // Key kept from the original plugin so stored settings still resolve.
  key: "background/giphy",
  name: "随机动图",
  description: "自定义动图地址，或 GIPHY 官方接口。",
  dashboardComponent: Giphy,
  settingsComponent: GiphySettings,
  supportsBackdrop: true,
};

export default config;
