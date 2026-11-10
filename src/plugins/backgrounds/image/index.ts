import { Config } from "../../types";
import Image from "./Image";
import ImageSettings from "./ImageSettings";

const config: Config = {
  key: "background/image",
  name: "上传图片",
  description: "查看您自己的图片。",
  dashboardComponent: Image,
  settingsComponent: ImageSettings,
  supportsBackdrop: true,
};

export default config;
