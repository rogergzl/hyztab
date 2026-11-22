/**
 * 组件键换算。
 *
 * 组件的元数据存于 `widget/<id>`（key / order 等），真正的内容存于
 * `data/<id>`。两者只差前缀，但一旦换算错，`DB.get` 会静默返回
 * undefined——表现为「未找到可写入的快速链接组件」，且不会报错。
 */

const WIDGET_PREFIX = "widget/";
const DATA_PREFIX = "data/";

/** `widget/<id>` → `data/<id>`。非组件键原样返回，交给调用方判空。 */
export const widgetDataKey = (widgetKey: string): `data/${string}` =>
  `${DATA_PREFIX}${widgetKey.startsWith(WIDGET_PREFIX) ? widgetKey.slice(WIDGET_PREFIX.length) : widgetKey}` as `data/${string}`;
