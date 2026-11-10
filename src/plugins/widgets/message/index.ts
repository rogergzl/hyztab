import { Config } from "../../types";
import Message from "./Message";
import MessageSettings from "./MessageSettings";

const config: Config = {
  key: "widget/message",
  name: "消息",
  description: "添加您自己的文本。",
  dashboardComponent: Message,
  settingsComponent: MessageSettings,
};

export default config;
