import { API } from "../../types";

export type Gif = {
  data: Blob;
  link: string;
};

/** Where the animation comes from. */
export type Source = "official" | "custom";

export type Data = {
  source: Source;
  /** Address used when `source` is "custom". */
  customUrl: string;
  expand: boolean;
  nsfw: boolean;
  tag: string;
};

export type Cache = Gif;

export type Props = API<Data, Cache>;

export const defaultData: Data = {
  // GIPHY's own API needs a key supplied at build time and is often
  // unreachable from mainland China, so a keyless address is the default and
  // the field is there to be replaced.
  source: "custom",
  customUrl: "https://img-api.ymz.icu/api/muse-dash-gif/",
  expand: false,
  nsfw: false,
  tag: "pattern",
};
