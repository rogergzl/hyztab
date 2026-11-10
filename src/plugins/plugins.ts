import { backgroundConfigs } from "./backgrounds";
import { widgetConfigs } from "./widgets";

export { backgroundConfigs } from "./backgrounds";
export { widgetConfigs } from "./widgets";

const configs = [...backgroundConfigs, ...widgetConfigs];

/**
 * Find a plugin config, or undefined when there is none.
 *
 * Used where a stored widget may name a plugin that no longer ships, such as
 * one that has been removed between versions: the widget is then skipped
 * rather than taking the page down with it.
 */
export function findConfig(key: string) {
  return configs.find((config) => config.key === key);
}

export function getConfig(key: string) {
  const config = findConfig(key);

  if (!config) throw new Error(`Unable to find config for plugin: ${key}`);

  return config;
}
