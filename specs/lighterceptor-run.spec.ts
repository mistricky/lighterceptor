import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { Lighterceptor } from "../src/index";

describe("Lighterceptor run", () => {
  it("writes requests for html input", async () => {
    const outputPath = path.join(os.tmpdir(), "lighterceptor-html.json");
    const lighterceptor = new Lighterceptor(
      `<img src="https://example.com/a.png">`,
      { outputPath },
    );

    const result = await lighterceptor.run();
    const raw = await readFile(result.filePath, "utf8");
    const data = JSON.parse(raw) as { requests: Array<{ url: string }> };

    expect(data.requests.some((item) => item.url.includes("a.png"))).toBe(true);

    await rm(outputPath, { force: true });
  });

  it("writes requests for js input", async () => {
    const outputPath = path.join(os.tmpdir(), "lighterceptor-js.json");
    const lighterceptor = new Lighterceptor(
      `fetch("https://example.com/api");`,
      { outputPath, inputType: "js" },
    );

    const result = await lighterceptor.run();
    const raw = await readFile(result.filePath, "utf8");
    const data = JSON.parse(raw) as { requests: Array<{ url: string }> };

    expect(data.requests.some((item) => item.url.includes("api"))).toBe(true);

    await rm(outputPath, { force: true });
  });

  it("writes requests for css input", async () => {
    const outputPath = path.join(os.tmpdir(), "lighterceptor-css.json");
    const lighterceptor = new Lighterceptor(
      `.hero { background-image: url("https://example.com/bg.png"); }`,
      { outputPath, inputType: "css" },
    );

    const result = await lighterceptor.run();
    const raw = await readFile(result.filePath, "utf8");
    const data = JSON.parse(raw) as { requests: Array<{ url: string }> };

    expect(data.requests.some((item) => item.url.includes("bg.png"))).toBe(
      true,
    );

    await rm(outputPath, { force: true });
  });
});
