import { describe, expect, it } from "vitest";

import { createJSDOMWithInterceptor } from "../src/index";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("fetch and xhr interception", () => {
  it("intercepts fetch requests", async () => {
    const seen: string[] = [];

    const dom = createJSDOMWithInterceptor({
      html: `<body></body>`,
      domOptions: {
        beforeParse(window) {
          window.fetch = () =>
            Promise.resolve({ ok: true }) as unknown as Promise<Response>;
        },
      },
      interceptor: (url) => {
        seen.push(url);
        return Buffer.from("");
      },
    });

    await dom.window.fetch("https://example.com/api");
    await wait(0);

    expect(seen).toContain("https://example.com/api");
  });

  it("intercepts xhr requests", async () => {
    const seen: string[] = [];

    const dom = createJSDOMWithInterceptor({
      html: `<body></body>`,
      domOptions: {
        beforeParse(window) {
          window.XMLHttpRequest.prototype.send = function send() {};
        },
      },
      interceptor: (url) => {
        seen.push(url);
        return Buffer.from("");
      },
    });

    const xhr = new dom.window.XMLHttpRequest();
    xhr.open("GET", "https://example.com/data.json");
    xhr.send();

    await wait(0);

    expect(seen).toContain("https://example.com/data.json");
  });

  it("intercepts fetch from inline script", async () => {
    const seen: string[] = [];

    createJSDOMWithInterceptor({
      html: `<script>fetch("https://example.com/script-fetch");</script>`,
      domOptions: {
        runScripts: "dangerously",
        beforeParse(window) {
          window.fetch = () =>
            Promise.resolve({ ok: true }) as Promise<Response>;
        },
      },
      interceptor: (url) => {
        seen.push(url);
        return Buffer.from("");
      },
    });

    await wait(0);

    expect(seen).toContain("https://example.com/script-fetch");
  });

  it("intercepts xhr from inline script", async () => {
    const seen: string[] = [];

    createJSDOMWithInterceptor({
      html: `<script>var xhr = new XMLHttpRequest(); xhr.open("GET", "https://example.com/script-xhr"); xhr.send();</script>`,
      domOptions: {
        runScripts: "dangerously",
        beforeParse(window) {
          window.XMLHttpRequest.prototype.send = function send() {};
        },
      },
      interceptor: (url) => {
        seen.push(url);
        return Buffer.from("");
      },
    });

    await wait(0);

    expect(seen).toContain("https://example.com/script-xhr");
  });
});
