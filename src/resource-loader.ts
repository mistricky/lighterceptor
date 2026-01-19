import {
  ResourceLoader,
  type AbortablePromise,
  type FetchOptions as JSDOMFetchOptions,
} from "jsdom";

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
        const jsdomOptions: JSDOMFetchOptions = {
          ...options,
          element: isJSDOMFetchElement(options.element)
            ? options.element
            : undefined,
        };
        fallback = super.fetch(url, jsdomOptions);
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

function isJSDOMFetchElement(
  element: FetchOptions["element"],
): element is JSDOMFetchOptions["element"] {
  return (
    element instanceof HTMLImageElement ||
    element instanceof HTMLIFrameElement ||
    element instanceof HTMLLinkElement ||
    element instanceof HTMLScriptElement ||
    element === undefined
  );
}
