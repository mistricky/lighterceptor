import { ResourceLoader, type AbortablePromise } from "jsdom";

import type { FetchOptions, RequestInterceptor } from "./types";

export class InterceptingResourceLoader extends ResourceLoader {
  private interceptor: RequestInterceptor;

  constructor(interceptor: RequestInterceptor) {
    super();
    this.interceptor = interceptor;
  }

  fetch(url: string, options: FetchOptions): AbortablePromise<Buffer> | null {
    let fallback: AbortablePromise<Buffer> | null = null;

    const promise = Promise.resolve(
      this.interceptor(url, { ...options, source: "resource" }),
    ).then((result) => {
      if (result === null || result === undefined) {
        fallback = super.fetch(url, options);
        return fallback ?? Buffer.from("");
      }

      if (typeof result === "string") {
        return Buffer.from(result);
      }

      if (Buffer.isBuffer(result)) {
        return result;
      }

      return Buffer.from("");
    });

    const abortable = promise as AbortablePromise<Buffer>;
    abortable.abort = () => {
      if (fallback) {
        fallback.abort();
      }
    };

    return abortable;
  }
}
