import { JSDOM, type DOMWindow } from "jsdom";

import { InterceptingResourceLoader } from "./resource-loader.js";
import type { RequestInterceptor } from "./types.js";

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
    },
  });
}
