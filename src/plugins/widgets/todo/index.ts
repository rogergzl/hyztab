import { Config } from "../../types";
import Todo from "./Todo";
import TodoSettings from "./TodoSettings";

const config: Config = {
  key: "widget/todo",
  name: "待办事项",
  description: "添加提醒来拖延一下。",
  dashboardComponent: Todo,
  settingsComponent: TodoSettings,
};

export default config;
