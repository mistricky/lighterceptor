import type { FetchOptions as JSDOMFetchOptions } from "jsdom";

export type RequestSource = "resource" | "img" | "css" | "fetch" | "xhr";

type InterceptorElement =
  | JSDOMFetchOptions["element"]
  | HTMLAudioElement
  | HTMLSourceElement
  | HTMLVideoElement;

export type FetchOptions = Omit<JSDOMFetchOptions, "element"> & {
  element?: InterceptorElement;
  source?: RequestSource;
};

export type RequestInterceptor = (
  url: string,
  options: FetchOptions,
) =>
  | Promise<Buffer | string | null | undefined>
  | Buffer
  | string
  | null
  | undefined;
