import { JSDOM, type DOMWindow } from "jsdom";

import { InterceptingResourceLoader } from "./resource-loader";
import type { RequestInterceptor } from "./types";

export type InterceptorOptions = {
  html: string;
  domOptions?: ConstructorParameters<typeof JSDOM>[1];
  interceptor: RequestInterceptor;
};

export function createJSDOMWithInterceptor(options: InterceptorOptions) {
  const resources = new InterceptingResourceLoader(options.interceptor);
  const domOptions = options.domOptions ?? {};
  const userBeforeParse = domOptions.beforeParse;

  return new JSDOM(options.html, {
    ...domOptions,
    resources,
    beforeParse(window: DOMWindow) {
      if (userBeforeParse) {
        userBeforeParse(window);
      }

      const extractCssUrls = (cssText: string) => {
        const urls: string[] = [];
        const pattern = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(cssText)) !== null) {
          const url = match[2].trim();
          if (url.length > 0) {
            urls.push(url);
          }
        }

        const importPattern =
          /@import\s+(?:url\(\s*)?(['"]?)([^'")\s]+)\1\s*\)?/gi;
        while ((match = importPattern.exec(cssText)) !== null) {
          const url = match[2].trim();
          if (url.length > 0) {
            urls.push(url);
          }
        }

        return urls;
      };

      const interceptCssText = (cssText: string) => {
        for (const url of extractCssUrls(cssText)) {
          void Promise.resolve(
            options.interceptor(url, {
              element: undefined,
              referrer: window.document.URL,
              source: "css",
            }),
          );
        }
      };

      const interceptImgSrc = (url: string, element: Element | null) => {
        const imageElement =
          element instanceof window.HTMLImageElement ? element : undefined;

        void Promise.resolve(
          options.interceptor(url, {
            element: imageElement,
            referrer: window.document.URL,
            source: "img",
          }),
        );
      };

      const imgProto = window.HTMLImageElement?.prototype;
      const srcDescriptor = imgProto
        ? Object.getOwnPropertyDescriptor(imgProto, "src")
        : undefined;

      if (imgProto && srcDescriptor?.set) {
        Object.defineProperty(imgProto, "src", {
          ...srcDescriptor,
          set(value: string) {
            interceptImgSrc(String(value), this as Element);
            srcDescriptor.set?.call(this, value);
          },
        });
      }

      const originalSetAttribute = window.Element.prototype.setAttribute;
      window.Element.prototype.setAttribute = function setAttribute(
        name: string,
        value: string,
      ) {
        if (
          this instanceof window.HTMLImageElement &&
          name.toLowerCase() === "src"
        ) {
          interceptImgSrc(String(value), this);
        }
        if (name.toLowerCase() === "style") {
          interceptCssText(String(value));
        }
        return originalSetAttribute.call(this, name, value);
      };

      const styleProto = window.CSSStyleDeclaration?.prototype;
      const originalSetProperty = styleProto?.setProperty;
      if (styleProto && originalSetProperty) {
        styleProto.setProperty = function setProperty(
          propertyName: string,
          value: string | null,
          priority?: string,
        ) {
          if (typeof value === "string") {
            interceptCssText(value);
          }
          return originalSetProperty.call(this, propertyName, value, priority);
        };

        const cssTextDescriptor = Object.getOwnPropertyDescriptor(
          styleProto,
          "cssText",
        );
        if (cssTextDescriptor?.set) {
          Object.defineProperty(styleProto, "cssText", {
            ...cssTextDescriptor,
            set(value: string) {
              interceptCssText(String(value));
              cssTextDescriptor.set?.call(this, value);
            },
          });
        }
      }

      const nodeProto = window.Node?.prototype;
      const textContentDescriptor = nodeProto
        ? Object.getOwnPropertyDescriptor(nodeProto, "textContent")
        : undefined;
      if (nodeProto && textContentDescriptor?.set) {
        Object.defineProperty(nodeProto, "textContent", {
          ...textContentDescriptor,
          set(value: string) {
            if (this instanceof window.HTMLStyleElement) {
              interceptCssText(String(value));
            }
            textContentDescriptor.set?.call(this, value);
          },
        });
      }

      const interceptRequest = (url: string, source: "fetch" | "xhr") => {
        void Promise.resolve(
          options.interceptor(url, {
            element: undefined,
            referrer: window.document.URL,
            source,
          }),
        );
      };

      if (typeof window.fetch === "function") {
        const originalFetch = window.fetch.bind(window);
        window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
          let url = "";

          if (typeof input === "string") {
            url = input;
          } else if (input instanceof URL) {
            url = input.toString();
          } else if ("url" in input) {
            url = String(input.url);
          }

          if (url) {
            interceptRequest(url, "fetch");
          }

          return originalFetch(input, init);
        }) as typeof window.fetch;
      }

      const xhrProto = window.XMLHttpRequest?.prototype;
      if (xhrProto) {
        const originalOpen = xhrProto.open;
        const originalSend = xhrProto.send;

        xhrProto.open = function open(
          this: XMLHttpRequest,
          method: string,
          url: string,
          async?: boolean,
          username?: string | null,
          password?: string | null,
        ) {
          (
            this as XMLHttpRequest & { _interceptorUrl?: string }
          )._interceptorUrl = String(url);
          return originalOpen.call(
            this,
            method,
            url,
            async ?? true,
            username ?? null,
            password ?? null,
          );
        };

        xhrProto.send = function send(
          this: XMLHttpRequest,
          body?: Document | XMLHttpRequestBodyInit | null,
        ) {
          const { _interceptorUrl } = this as XMLHttpRequest & {
            _interceptorUrl?: string;
          };
          if (_interceptorUrl) {
            interceptRequest(_interceptorUrl, "xhr");
          }
          return originalSend.call(this, body ?? null);
        };
      }
    },
  });
}
