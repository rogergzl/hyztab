import { API } from "../../types";
import { directSources } from "../sources";
import { Data, Gif } from "./types";

type Config = Pick<Data, "source" | "customUrl" | "nsfw" | "tag">;

/** Read an address that serves the animation itself. */
const getDirectGif = async (url: string): Promise<Gif> => {
  const address = url.trim();
  if (!address) throw new Error("请先填写自定义动图地址");

  // A changing parameter keeps a random endpoint from being served from cache.
  const res = await fetch(directSources(address, 1)[0]);
  if (!res.ok) throw new Error(`动图地址返回 ${res.status}`);

  return { data: await res.blob(), link: address };
};

/** Read the GIPHY API, which needs a key supplied at build time. */
const getGiphyGif = async ({ tag, nsfw }: Config): Promise<Gif> => {
  const tags = tag.split(",").map((t) => t.trim());
  const randomTag = tags[Math.floor(Math.random() * tags.length)];

  const request = new Request(
    "https://api.giphy.com/v1/gifs/random" +
      `?api_key=${GIPHY_API_KEY}` +
      "&rating=" +
      (nsfw ? "r" : "g") +
      (randomTag ? `&tag=${encodeURIComponent(randomTag)}` : ""),
  );

  const res = await (await fetch(request)).json();
  const original = res?.data?.images?.original?.webp;

  if (!original) throw new Error("GIPHY 接口返回异常（可能缺少 API Key）");

  return {
    data: await (await fetch(original)).blob(),
    link: res.data.url,
  };
};

export async function getGif(
  config: Config,
  loader: API["loader"],
): Promise<Gif> {
  loader.push();

  try {
    return config.source === "custom"
      ? await getDirectGif(config.customUrl)
      : await getGiphyGif(config);
  } finally {
    loader.pop();
  }
}
