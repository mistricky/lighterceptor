import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Lighterceptor } from "../src/index";

type MockEntry = {
  body: string;
  contentType: string;
};

const baseResources = new Map<string, MockEntry>([
  [
    "https://example.com/site.css",
    {
      body: '@import url("./theme.css"); .hero{background:url("/hero.png")}',
      contentType: "text/css",
    },
  ],
  [
    "https://example.com/theme.css",
    {
      body: ".theme{background:url(https://example.com/theme.png)}",
      contentType: "text/css",
    },
  ],
  [
    "https://example.com/app.js",
    {
      body: 'import "./feature.js"; fetch("https://example.com/api/data");',
      contentType: "application/javascript",
    },
  ],
  [
    "https://example.com/feature.js",
    {
      body: 'fetch("https://example.com/api/feature");',
      contentType: "application/javascript",
    },
  ],
  [
    "https://example.com/frame.html",
    {
      body: '<!doctype html><link rel="stylesheet" href="./frame.css"><img src="/frame.png">',
      contentType: "text/html",
    },
  ],
  [
    "https://example.com/frame.css",
    {
      body: '@import url("./nested.css"); .frame{background:url("./bg.png")}',
      contentType: "text/css",
    },
  ],
  [
    "https://example.com/nested.css",
    {
      body: ".nested{background:url(https://example.com/nested.png)}",
      contentType: "text/css",
    },
  ],
  [
    "https://example.com/api/data",
    {
      body: '{"ok":true}',
      contentType: "application/json",
    },
  ],
  [
    "https://example.com/api/feature",
    {
      body: '{"feature":true}',
      contentType: "application/json",
    },
  ],
]);

const createFetchStub = (resources: Map<string, MockEntry>) => {
  return async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const entry = resources.get(url);
    if (!entry) {
      return new Response("", { status: 404 });
    }
    return new Response(entry.body, {
      status: 200,
      headers: {
        "content-type": entry.contentType,
      },
    });
  };
};

describe("Lighterceptor recursion", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", createFetchStub(baseResources));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not follow dependencies when recursion is disabled", async () => {
    const html = `
      <link rel="stylesheet" href="https://example.com/site.css" />
      <script src="https://example.com/app.js"></script>
    `;
    const result = await new Lighterceptor(html).run();

    const urls = result.requests.map((item) => item.url);
    expect(urls).toContain("https://example.com/site.css");
    expect(urls).toContain("https://example.com/app.js");
    expect(urls).not.toContain("https://example.com/theme.css");
    expect(urls).not.toContain("https://example.com/feature.js");
  });

  it("follows css imports and js imports when recursion is enabled", async () => {
    const html = `
      <link rel="stylesheet" href="https://example.com/site.css" />
      <script src="https://example.com/app.js"></script>
    `;
    const result = await new Lighterceptor(html, { recursion: true }).run();

    const urls = result.requests.map((item) => item.url);
    expect(urls).toContain("https://example.com/site.css");
    expect(urls).toContain("https://example.com/theme.css");
    expect(urls).toContain("https://example.com/app.js");
    expect(urls).toContain("https://example.com/feature.js");
    expect(urls).toContain("https://example.com/api/data");
  });

  it("recurses into iframe html and nested stylesheets", async () => {
    const html = `<iframe src="https://example.com/frame.html"></iframe>`;
    const result = await new Lighterceptor(html, { recursion: true }).run();

    const urls = result.requests.map((item) => item.url);
    expect(urls).toContain("https://example.com/frame.html");
    expect(urls).toContain("https://example.com/frame.css");
    expect(urls).toContain("https://example.com/nested.css");
    expect(urls).toContain("https://example.com/bg.png");
    expect(urls).toContain("https://example.com/nested.png");
  });
});
