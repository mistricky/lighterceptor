import { describe, expect, it } from "vitest";

import { Lighterceptor } from "../src/index";

describe("Lighterceptor run", () => {
  it("writes requests for html input", async () => {
    const lighterceptor = new Lighterceptor(
      `<img src="https://example.com/a.png">`,
    );

    const result = await lighterceptor.run();
    expect(result.requests.some((item) => item.url.includes("a.png"))).toBe(
      true,
    );
  });

  it("writes requests for js input", async () => {
    const lighterceptor = new Lighterceptor(
      `<script src="https://example.com/app.js"></script><script>fetch("https://example.com/api");</script>`,
    );

    const result = await lighterceptor.run();
    expect(result.requests.some((item) => item.url.includes("api"))).toBe(true);
    expect(result.requests.some((item) => item.url.includes("app.js"))).toBe(
      true,
    );
  });

  it("writes requests for css input", async () => {
    const lighterceptor = new Lighterceptor(
      `<style>.hero { background-image: url("https://example.com/bg.png"); }</style>`,
    );

    const result = await lighterceptor.run();
    expect(result.requests.some((item) => item.url.includes("bg.png"))).toBe(
      true,
    );
  });
});
