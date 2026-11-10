import { Config } from "../../types";
import { Notes } from "./Notes";

const config: Config = {
  key: "widget/notes",
  name: "笔记",
  description: "随手记点什么。",
  dashboardComponent: Notes,
};

export default config;
