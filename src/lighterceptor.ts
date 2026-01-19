import { createJSDOMWithInterceptor } from "./dom";
import type { RequestSource } from "./types";

export type LighterceptorOptions = {
  settleTimeMs?: number;
  recursion?: boolean;
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

type ResourceKind = "html" | "css" | "js";

type ResourceContent = {
  text: string;
  contentType?: string;
};

type CssDependencies = {
  imports: string[];
  urls: string[];
};

type JsDependencies = {
  imports: string[];
  importScripts: string[];
  fetches: string[];
  xhrs: string[];
};

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
    const recursive = this.options.recursion ?? false;
    const pending: Array<{ url: string; kind?: ResourceKind }> = [];
    const processed = new Set<string>();
    const resourceCache = new Map<string, Promise<ResourceContent | null>>();

    const recordUrl = (
      url: string,
      source: RequestSource | "unknown",
      baseUrl?: string,
    ) => {
      const resolved = resolveUrl(baseUrl, url);
      if (!resolved) {
        return;
      }

      requests.push({
        url: resolved,
        source,
        timestamp: Date.now(),
      });
    };

    const enqueue = (url: string, kind?: ResourceKind) => {
      if (!recursive || isSkippableUrl(url)) {
        return;
      }
      if (processed.has(url)) {
        return;
      }
      processed.add(url);
      pending.push({ url, kind });
    };

    const recordCssUrls = (cssText: string, baseUrl?: string) => {
      const { imports, urls } = extractCssDependencies(cssText);

      for (const url of imports) {
        const resolved = resolveUrl(baseUrl, url);
        if (!resolved) {
          continue;
        }
        recordUrl(resolved, "css");
        enqueue(resolved, "css");
      }

      for (const url of urls) {
        const resolved = resolveUrl(baseUrl, url);
        if (!resolved) {
          continue;
        }
        recordUrl(resolved, "css");
      }
    };

    const analyzeJs = (jsText: string, baseUrl?: string) => {
      const { fetches, imports, importScripts, xhrs } =
        extractJsDependencies(jsText);

      for (const url of imports) {
        const resolved = resolveUrl(baseUrl, url);
        if (!resolved) {
          continue;
        }
        recordUrl(resolved, "resource");
        enqueue(resolved, inferResourceKindFromUrl(resolved) ?? "js");
      }

      for (const url of importScripts) {
        const resolved = resolveUrl(baseUrl, url);
        if (!resolved) {
          continue;
        }
        recordUrl(resolved, "resource");
        enqueue(resolved, "js");
      }

      for (const url of fetches) {
        const resolved = resolveUrl(baseUrl, url);
        if (!resolved) {
          continue;
        }
        recordUrl(resolved, "fetch");
        enqueue(resolved, inferResourceKindFromUrl(resolved));
      }

      for (const url of xhrs) {
        const resolved = resolveUrl(baseUrl, url);
        if (!resolved) {
          continue;
        }
        recordUrl(resolved, "xhr");
        enqueue(resolved, inferResourceKindFromUrl(resolved));
      }
    };

    const analyzeHtml = async (
      htmlText: string,
      baseUrl?: string,
      captureTitle = false,
    ) => {
      const dom = createJSDOMWithInterceptor({
        html: htmlText,
        domOptions: {
          pretendToBeVisual: true,
          runScripts: "dangerously",
          url: baseUrl,
          beforeParse(window) {
            window.fetch = () =>
              Promise.resolve({ ok: true }) as unknown as Promise<Response>;
            window.XMLHttpRequest.prototype.send = function send() {};
          },
        },
        interceptor: (url, options) => {
          const resolved = resolveUrl(options.referrer, url);
          if (!resolved) {
            return Buffer.from("");
          }

          const source = options.source ?? "unknown";
          recordUrl(resolved, source);

          if (recursive) {
            if (source === "fetch" || source === "xhr") {
              enqueue(resolved, inferResourceKindFromUrl(resolved));
            } else if (source === "resource") {
              const kind = inferKindFromElement(options.element);
              if (kind) {
                enqueue(resolved, kind);
              }
            }
          }

          return Buffer.from("");
        },
      });

      const { document } = dom.window;

      document.querySelectorAll("img").forEach((img) => {
        if (img instanceof dom.window.HTMLImageElement && img.src) {
          recordUrl(img.src, "img");
        }
      });

      document.querySelectorAll("img[srcset]").forEach((img) => {
        if (!(img instanceof dom.window.HTMLImageElement)) {
          return;
        }
        const srcset = img.getAttribute("srcset");
        if (!srcset) {
          return;
        }
        for (const url of parseSrcsetUrls(srcset)) {
          recordUrl(url, "img", baseUrl);
        }
      });

      document.querySelectorAll("source[src]").forEach((source) => {
        const src = source.getAttribute("src");
        if (src) {
          recordUrl(src, "resource", baseUrl);
        }
      });

      document.querySelectorAll("source[srcset]").forEach((source) => {
        const srcset = source.getAttribute("srcset");
        if (srcset) {
          for (const url of parseSrcsetUrls(srcset)) {
            recordUrl(url, "resource", baseUrl);
          }
        }
      });

      document.querySelectorAll("script[src]").forEach((script) => {
        if (script instanceof dom.window.HTMLScriptElement && script.src) {
          recordUrl(script.src, "resource");
          enqueue(script.src, "js");
        }
      });

      document.querySelectorAll("iframe[src]").forEach((iframe) => {
        if (iframe instanceof dom.window.HTMLIFrameElement && iframe.src) {
          recordUrl(iframe.src, "resource");
          enqueue(iframe.src, "html");
        }
      });

      document.querySelectorAll("video[src], audio[src]").forEach((media) => {
        const src = media.getAttribute("src");
        if (src) {
          recordUrl(src, "resource", baseUrl);
        }
      });

      document.querySelectorAll("video[poster]").forEach((video) => {
        const poster = video.getAttribute("poster");
        if (poster) {
          recordUrl(poster, "resource", baseUrl);
        }
      });

      document.querySelectorAll("track[src]").forEach((track) => {
        const src = track.getAttribute("src");
        if (src) {
          recordUrl(src, "resource", baseUrl);
        }
      });

      document.querySelectorAll("embed[src]").forEach((embed) => {
        const src = embed.getAttribute("src");
        if (src) {
          recordUrl(src, "resource", baseUrl);
        }
      });

      document.querySelectorAll("object[data]").forEach((object) => {
        const data = object.getAttribute("data");
        if (data) {
          recordUrl(data, "resource", baseUrl);
        }
      });

      document.querySelectorAll("[style]").forEach((element) => {
        const cssText = element.getAttribute("style");
        if (cssText) {
          recordCssUrls(cssText, baseUrl);
        }
      });

      document.querySelectorAll("style").forEach((style) => {
        if (style.textContent) {
          recordCssUrls(style.textContent, baseUrl);
        }
      });

      document.querySelectorAll("link[rel]").forEach((link) => {
        if (!(link instanceof dom.window.HTMLLinkElement)) {
          return;
        }
        const rel = link.getAttribute("rel") ?? "";
        if (shouldInterceptLinkRel(rel)) {
          const href = link.getAttribute("href") ?? link.href;
          if (href) {
            const resolvedHref = resolveUrl(baseUrl, href) ?? href;
            recordUrl(resolvedHref, "resource");
            if (rel.toLowerCase().includes("stylesheet")) {
              enqueue(resolvedHref, "css");
            } else if (rel.toLowerCase().includes("preload")) {
              const kind = inferResourceKindFromUrl(resolvedHref);
              if (kind) {
                enqueue(resolvedHref, kind);
              }
            }
          }
        }
        if (rel.toLowerCase().includes("preload")) {
          const imagesrcset = link.getAttribute("imagesrcset");
          if (imagesrcset) {
            for (const url of parseSrcsetUrls(imagesrcset)) {
              recordUrl(url, "resource", baseUrl);
            }
          }
        }
      });

      await new Promise((resolve) => setTimeout(resolve, settleTimeMs));

      if (captureTitle) {
        return dom.window.document.title || undefined;
      }

      return undefined;
    };

    const loadResource = async (url: string) => {
      const existing = resourceCache.get(url);
      if (existing) {
        return existing;
      }
      const loader = fetchResourceContent(url);
      resourceCache.set(url, loader);
      return loader;
    };

    const processPending = async () => {
      while (pending.length > 0) {
        const next = pending.shift();
        if (!next) {
          continue;
        }
        const result = await loadResource(next.url);
        if (!result) {
          continue;
        }

        const kind =
          next.kind ??
          detectResourceKind(next.url, result.contentType, result.text);
        if (!kind) {
          continue;
        }

        if (kind === "html") {
          await analyzeHtml(result.text, next.url);
          continue;
        }

        if (kind === "css") {
          recordCssUrls(result.text, next.url);
          continue;
        }

        analyzeJs(result.text, next.url);
      }
    };

    const inputKind = detectInputKind(this.input);

    let title: string | undefined;
    if (inputKind === "html") {
      title = await analyzeHtml(this.input, undefined, true);
    } else if (inputKind === "css") {
      recordCssUrls(this.input);
    } else {
      analyzeJs(this.input);
    }

    await processPending();

    return {
      title,
      capturedAt,
      requests,
    };
  }
}

function resolveUrl(baseUrl: string | undefined, url: string) {
  if (!url) {
    return undefined;
  }
  if (baseUrl) {
    try {
      return new URL(url, baseUrl).toString();
    } catch {
      return url;
    }
  }

  try {
    return new URL(url).toString();
  } catch {
    return url;
  }
}

function isSkippableUrl(url: string) {
  const lowered = url.toLowerCase();
  return (
    lowered.startsWith("data:") ||
    lowered.startsWith("javascript:") ||
    lowered.startsWith("about:")
  );
}

async function fetchResourceContent(
  url: string,
): Promise<ResourceContent | null> {
  if (typeof fetch !== "function") {
    return null;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const text = await response.text();
    return {
      text,
      contentType: response.headers.get("content-type") ?? undefined,
    };
  } catch {
    return null;
  }
}

function inferResourceKindFromUrl(url: string) {
  const cleanUrl = url.split("?")[0].split("#")[0];
  const extension = cleanUrl.split(".").pop()?.toLowerCase();
  if (!extension) {
    return undefined;
  }
  if (extension === "html" || extension === "htm") {
    return "html";
  }
  if (extension === "css") {
    return "css";
  }
  if (extension === "js" || extension === "mjs" || extension === "cjs") {
    return "js";
  }
  return undefined;
}

function detectResourceKind(
  url: string,
  contentType: string | undefined,
  text: string,
) {
  const normalized = contentType?.toLowerCase() ?? "";
  if (normalized.includes("text/html")) {
    return "html";
  }
  if (normalized.includes("text/css")) {
    return "css";
  }
  if (normalized.includes("javascript")) {
    return "js";
  }

  const inferred = inferResourceKindFromUrl(url);
  if (inferred) {
    return inferred;
  }

  const trimmed = text.trimStart();
  if (trimmed.startsWith("<!doctype") || trimmed.startsWith("<html")) {
    return "html";
  }
  if (trimmed.startsWith("<")) {
    return "html";
  }
  if (trimmed.startsWith("@") || trimmed.includes("url(")) {
    return "css";
  }
  if (looksLikeJavaScript(trimmed)) {
    return "js";
  }
  return undefined;
}

function detectInputKind(input: string): ResourceKind {
  const trimmed = input.trimStart();
  if (trimmed.startsWith("<")) {
    return "html";
  }
  if (trimmed.startsWith("@") || trimmed.includes("url(")) {
    return "css";
  }
  return "js";
}

function looksLikeJavaScript(text: string) {
  return (
    /\b(import|export)\b/.test(text) ||
    /\b(const|let|var|function)\b/.test(text) ||
    /\bfetch\s*\(/.test(text) ||
    /\bXMLHttpRequest\b/.test(text) ||
    /\bimportScripts\s*\(/.test(text)
  );
}

function inferKindFromElement(element: unknown): ResourceKind | undefined {
  if (!element || typeof element !== "object") {
    return undefined;
  }

  const tagName =
    "tagName" in element && typeof element.tagName === "string"
      ? element.tagName.toLowerCase()
      : "";

  if (tagName === "script") {
    return "js";
  }
  if (tagName === "iframe") {
    return "html";
  }
  if (tagName === "link" && "getAttribute" in element) {
    const rel = String(
      (element as Element).getAttribute("rel") ?? "",
    ).toLowerCase();
    const asValue = String(
      (element as Element).getAttribute("as") ?? "",
    ).toLowerCase();

    if (rel.includes("stylesheet")) {
      return "css";
    }
    if (rel.includes("preload") || rel.includes("prefetch")) {
      if (asValue === "style") {
        return "css";
      }
      if (asValue === "script") {
        return "js";
      }
    }
  }

  return undefined;
}

function extractCssDependencies(cssText: string): CssDependencies {
  const imports: string[] = [];
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
      imports.push(url);
    }
  }

  return { imports, urls };
}

function extractJsDependencies(jsText: string): JsDependencies {
  const imports = new Set<string>();
  const importScripts = new Set<string>();
  const fetches = new Set<string>();
  const xhrs = new Set<string>();

  const importPattern = /\bimport\s+(?:[^'"]+from\s+)?['"]([^'"]+)['"]/g;
  const dynamicImportPattern = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
  const importScriptsPattern = /\bimportScripts\(\s*['"]([^'"]+)['"]\s*\)/g;
  const fetchPattern = /\bfetch\(\s*['"]([^'"]+)['"]/g;
  const xhrPattern = /\.open\(\s*['"][^'"]+['"]\s*,\s*['"]([^'"]+)['"]/g;

  let match: RegExpExecArray | null;

  while ((match = importPattern.exec(jsText)) !== null) {
    imports.add(match[1]);
  }

  while ((match = dynamicImportPattern.exec(jsText)) !== null) {
    imports.add(match[1]);
  }

  while ((match = importScriptsPattern.exec(jsText)) !== null) {
    importScripts.add(match[1]);
  }

  while ((match = fetchPattern.exec(jsText)) !== null) {
    fetches.add(match[1]);
  }

  while ((match = xhrPattern.exec(jsText)) !== null) {
    xhrs.add(match[1]);
  }

  return {
    imports: [...imports],
    importScripts: [...importScripts],
    fetches: [...fetches],
    xhrs: [...xhrs],
  };
}

function parseSrcsetUrls(value: string) {
  return value
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter((url) => url.length > 0);
}

function shouldInterceptLinkRel(rel: string) {
  const normalized = rel.toLowerCase();
  return (
    normalized.includes("preload") ||
    normalized.includes("prefetch") ||
    normalized.includes("stylesheet") ||
    normalized.includes("icon")
  );
}
