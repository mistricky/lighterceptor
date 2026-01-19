import { describe, expect, it } from "vitest";

import { createJSDOMWithInterceptor } from "../src/index.js";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("css url interception", () => {
  it("intercepts urls from inline style attributes", async () => {
    const seen: string[] = [];

    const dom = createJSDOMWithInterceptor({
      html: `<body></body>`,
      domOptions: {
        pretendToBeVisual: true,
      },
      interceptor: (url) => {
        seen.push(url);
        return Buffer.from("");
      },
    });

    const div = dom.window.document.createElement("div");
    div.setAttribute(
      "style",
      "background-image: url(https://example.com/bg.png);",
    );
    dom.window.document.body.appendChild(div);

    await wait(50);

    expect(seen).toContain("https://example.com/bg.png");
  });

  it("intercepts urls from style tag content", async () => {
    const seen: string[] = [];

    const dom = createJSDOMWithInterceptor({
      html: `<body></body>`,
      domOptions: {
        pretendToBeVisual: true,
      },
      interceptor: (url) => {
        seen.push(url);
        return Buffer.from("");
      },
    });

    const style = dom.window.document.createElement("style");
    style.textContent = ".hero{background:url('https://example.com/hero.png')}";
    dom.window.document.head.appendChild(style);

    await wait(50);

    expect(seen).toContain("https://example.com/hero.png");
  });

  it("intercepts urls from @import rules", async () => {
    const seen: string[] = [];

    const dom = createJSDOMWithInterceptor({
      html: `<body></body>`,
      domOptions: {
        pretendToBeVisual: true,
      },
      interceptor: (url) => {
        seen.push(url);
        return Buffer.from("");
      },
    });

    const style = dom.window.document.createElement("style");
    style.textContent = "@import url('https://example.com/reset.css');";
    dom.window.document.head.appendChild(style);

    await wait(50);

    expect(seen).toContain("https://example.com/reset.css");
  });
});
