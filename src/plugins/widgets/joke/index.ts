import { Config } from "../../types";
import Joke from "./Joke";
import JokeSettings from "./JokeSettings";

const config: Config = {
  key: "widget/joke",
  name: "笑话",
  description: "来点乐子和欢笑。",
  dashboardComponent: Joke,
  settingsComponent: JokeSettings,
};

export default config;
