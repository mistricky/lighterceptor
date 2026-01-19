import type { FetchOptions as JSDOMFetchOptions } from "jsdom";

export type FetchOptions = JSDOMFetchOptions;

export type RequestInterceptor = (
  url: string,
  options: FetchOptions,
) =>
  | Promise<Buffer | string | null | undefined>
  | Buffer
  | string
  | null
  | undefined;
