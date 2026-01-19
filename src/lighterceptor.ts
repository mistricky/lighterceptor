import { createJSDOMWithInterceptor } from "./dom";
import type { RequestSource } from "./types";

export type LighterceptorOptions = {
  settleTimeMs?: number;
};

export type RequestRecord = {
  url: string;
  source: RequestSource | "unknown";
  timestamp: number;
};

export type LighterceptorResult = {
  title?: string;
  capturedAt: string;
  requests: RequestRecord[];
};

const DEFAULT_SETTLE_MS = 50;

export class Lighterceptor {
  private input: string;
  private options: LighterceptorOptions;

  constructor(input: string, options: LighterceptorOptions = {}) {
    this.input = input;
    this.options = options;
  }

  async run(): Promise<LighterceptorResult> {
    const requests: RequestRecord[] = [];
    const capturedAt = new Date().toISOString();
    const settleTimeMs = this.options.settleTimeMs ?? DEFAULT_SETTLE_MS;

    const html = this.input;
    const recordUrl = (url: string, source: RequestSource | "unknown") => {
      requests.push({
        url,
        source,
        timestamp: Date.now(),
      });
    };

    const recordCssUrls = (cssText: string) => {
      for (const url of extractCssUrls(cssText)) {
        recordUrl(url, "css");
      }
    };

    const dom = createJSDOMWithInterceptor({
      html,
      domOptions: {
        pretendToBeVisual: true,
        runScripts: "dangerously",
        beforeParse(window) {
          window.fetch = () =>
            Promise.resolve({ ok: true }) as unknown as Promise<Response>;
          window.XMLHttpRequest.prototype.send = function send() {};
        },
      },
      interceptor: (url, options) => {
        recordUrl(url, options.source ?? "unknown");
        return Buffer.from("");
      },
    });

    const { document } = dom.window;

    document.querySelectorAll("img").forEach((img) => {
      if (img instanceof dom.window.HTMLImageElement && img.src) {
        recordUrl(img.src, "img");
      }
    });

    document.querySelectorAll("[style]").forEach((element) => {
      const cssText = element.getAttribute("style");
      if (cssText) {
        recordCssUrls(cssText);
      }
    });

    document.querySelectorAll("style").forEach((style) => {
      if (style.textContent) {
        recordCssUrls(style.textContent);
      }
    });

    document
      .querySelectorAll('link[rel~="stylesheet"][href]')
      .forEach((link) => {
        if (link instanceof dom.window.HTMLLinkElement) {
          recordUrl(link.href, "resource");
        }
      });

    await new Promise((resolve) => setTimeout(resolve, settleTimeMs));

    const title = dom.window.document.title || undefined;
    return {
      title,
      capturedAt,
      requests,
    };
  }
}

function extractCssUrls(cssText: string) {
  const urls: string[] = [];
  const urlPattern = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
  const importPattern = /@import\s+(?:url\(\s*)?(['"]?)([^'")\s]+)\1\s*\)?/gi;
  let match: RegExpExecArray | null;

  while ((match = urlPattern.exec(cssText)) !== null) {
    const url = match[2].trim();
    if (url.length > 0) {
      urls.push(url);
    }
  }

  while ((match = importPattern.exec(cssText)) !== null) {
    const url = match[2].trim();
    if (url.length > 0) {
      urls.push(url);
    }
  }

  return urls;
}
