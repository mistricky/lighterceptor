import type { FetchOptions as JSDOMFetchOptions } from "jsdom";

export type RequestSource = "resource" | "img" | "css" | "fetch" | "xhr";

export type FetchOptions = JSDOMFetchOptions & {
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
