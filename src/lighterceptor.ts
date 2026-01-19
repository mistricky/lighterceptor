import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createJSDOMWithInterceptor } from "./dom";
import type { RequestSource } from "./types";

export type InputType = "html" | "js" | "css";

export type LighterceptorOptions = {
  inputType?: InputType;
  outputPath?: string;
  settleTimeMs?: number;
};

export type RequestRecord = {
  url: string;
  source: RequestSource | "unknown";
  timestamp: number;
};

export type LighterceptorResult = {
  inputType: InputType;
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

  async run(): Promise<{ filePath: string; data: LighterceptorResult }> {
    const inputType = this.options.inputType ?? detectInputType(this.input);
    const requests: RequestRecord[] = [];
    const capturedAt = new Date().toISOString();
    const settleTimeMs = this.options.settleTimeMs ?? DEFAULT_SETTLE_MS;

    const html = wrapInput(inputType, this.input);
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
        runScripts: inputType === "css" ? undefined : "dangerously",
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

    if (inputType === "css") {
      recordCssUrls(this.input);
    }

    await new Promise((resolve) => setTimeout(resolve, settleTimeMs));

    const title = dom.window.document.title || undefined;
    const data: LighterceptorResult = {
      inputType,
      title,
      capturedAt,
      requests,
    };

    const filePath =
      this.options.outputPath ??
      path.resolve(process.cwd(), "lighterceptor.requests.json");

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

    return { filePath, data };
  }
}

function wrapInput(inputType: InputType, input: string) {
  if (inputType === "html") {
    return input;
  }

  if (inputType === "css") {
    return `<style>${input}</style>`;
  }

  return `<script>${input}</script>`;
}

function detectInputType(input: string): InputType {
  const trimmed = input.trim();
  const htmlTagPattern =
    /<\s*(html|head|body|div|span|script|style|link|img)\b/i;
  const cssPattern = /@import\s+|url\(\s*['"]?[^'")]+['"]?\s*\)/i;

  if (htmlTagPattern.test(trimmed)) {
    return "html";
  }

  if (cssPattern.test(trimmed)) {
    return "css";
  }

  return "js";
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
