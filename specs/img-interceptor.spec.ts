import { describe, expect, it } from "vitest";

import { createJSDOMWithInterceptor } from "../src/index";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("img src interception", () => {
  it("intercepts image resource requests", async () => {
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

    const img = dom.window.document.createElement("img");
    img.src = "https://example.com/a.png";
    dom.window.document.body.appendChild(img);

    await wait(100);

    expect(seen).toContain("https://example.com/a.png");
  });
});
