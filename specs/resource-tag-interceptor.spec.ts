import { describe, expect, it } from "vitest";

import { createJSDOMWithInterceptor } from "../src/index";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("resource tag interception", () => {
  it("intercepts stylesheet link requests", async () => {
    const seen: string[] = [];

    createJSDOMWithInterceptor({
      html: `<link rel="stylesheet" href="https://example.com/site.css">`,
      domOptions: {
        pretendToBeVisual: true,
      },
      interceptor: (url) => {
        seen.push(url);
        return Buffer.from("");
      },
    });

    await wait(50);

    expect(seen).toContain("https://example.com/site.css");
  });

  it("intercepts script src requests", async () => {
    const seen: string[] = [];

    createJSDOMWithInterceptor({
      html: `<script src="https://example.com/app.js"></script>`,
      domOptions: {
        pretendToBeVisual: true,
        runScripts: "dangerously",
      },
      interceptor: (url) => {
        seen.push(url);
        return Buffer.from("");
      },
    });

    await wait(50);

    expect(seen).toContain("https://example.com/app.js");
  });

  it("intercepts iframe src requests", async () => {
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

    const iframe = dom.window.document.createElement("iframe");
    iframe.src = "https://example.com/frame.html";
    dom.window.document.body.appendChild(iframe);

    await wait(50);

    expect(seen).toContain("https://example.com/frame.html");
  });

  it("intercepts iframe src from html markup", async () => {
    const seen: string[] = [];

    createJSDOMWithInterceptor({
      html: `<iframe src="https://example.com/frame-markup.html"></iframe>`,
      domOptions: {
        pretendToBeVisual: true,
      },
      interceptor: (url) => {
        seen.push(url);
        return Buffer.from("");
      },
    });

    await wait(50);

    expect(seen).toContain("https://example.com/frame-markup.html");
  });

  it("intercepts video and audio src requests", async () => {
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

    const video = dom.window.document.createElement("video");
    video.src = "https://example.com/video.mp4";
    dom.window.document.body.appendChild(video);

    const audio = dom.window.document.createElement("audio");
    audio.setAttribute("src", "https://example.com/audio.mp3");
    dom.window.document.body.appendChild(audio);

    await wait(50);

    expect(seen).toContain("https://example.com/video.mp4");
    expect(seen).toContain("https://example.com/audio.mp3");
  });

  it("intercepts source src for video and audio", async () => {
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

    const video = dom.window.document.createElement("video");
    const videoSource = dom.window.document.createElement("source");
    videoSource.src = "https://example.com/video-source.mp4";
    video.appendChild(videoSource);
    dom.window.document.body.appendChild(video);

    const audio = dom.window.document.createElement("audio");
    const audioSource = dom.window.document.createElement("source");
    audioSource.setAttribute("src", "https://example.com/audio-source.mp3");
    audio.appendChild(audioSource);
    dom.window.document.body.appendChild(audio);

    await wait(50);

    expect(seen).toContain("https://example.com/video-source.mp4");
    expect(seen).toContain("https://example.com/audio-source.mp3");
  });

  it("intercepts source srcset requests", async () => {
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

    const picture = dom.window.document.createElement("picture");
    const source = dom.window.document.createElement("source");
    source.srcset =
      "https://example.com/img-1x.png 1x, https://example.com/img-2x.png 2x";
    picture.appendChild(source);
    dom.window.document.body.appendChild(picture);

    await wait(50);

    expect(seen).toContain("https://example.com/img-1x.png");
    expect(seen).toContain("https://example.com/img-2x.png");
  });

  it("intercepts img srcset requests", async () => {
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
    img.srcset =
      "https://example.com/pic-1x.jpg 1x, https://example.com/pic-2x.jpg 2x";
    dom.window.document.body.appendChild(img);

    await wait(50);

    expect(seen).toContain("https://example.com/pic-1x.jpg");
    expect(seen).toContain("https://example.com/pic-2x.jpg");
  });

  it("intercepts img srcset from html markup", async () => {
    const seen: string[] = [];

    createJSDOMWithInterceptor({
      html: `<img srcset="https://example.com/markup-1x.jpg 1x, https://example.com/markup-2x.jpg 2x">`,
      domOptions: {
        pretendToBeVisual: true,
      },
      interceptor: (url) => {
        seen.push(url);
        return Buffer.from("");
      },
    });

    await wait(50);

    expect(seen).toContain("https://example.com/markup-1x.jpg");
    expect(seen).toContain("https://example.com/markup-2x.jpg");
  });

  it("intercepts track src and embed src requests", async () => {
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

    const track = dom.window.document.createElement("track");
    track.setAttribute("src", "https://example.com/captions.vtt");
    dom.window.document.body.appendChild(track);

    const embed = dom.window.document.createElement("embed");
    embed.setAttribute("src", "https://example.com/embedded.swf");
    dom.window.document.body.appendChild(embed);

    await wait(50);

    expect(seen).toContain("https://example.com/captions.vtt");
    expect(seen).toContain("https://example.com/embedded.swf");
  });

  it("intercepts object data and video poster requests", async () => {
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

    const object = dom.window.document.createElement("object");
    object.setAttribute("data", "https://example.com/object.svg");
    dom.window.document.body.appendChild(object);

    const video = dom.window.document.createElement("video");
    video.poster = "https://example.com/poster.jpg";
    dom.window.document.body.appendChild(video);

    await wait(50);

    expect(seen).toContain("https://example.com/object.svg");
    expect(seen).toContain("https://example.com/poster.jpg");
  });

  it("intercepts preload link href requests", async () => {
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

    const link = dom.window.document.createElement("link");
    link.setAttribute("rel", "preload");
    link.setAttribute("href", "https://example.com/preload.js");
    dom.window.document.head.appendChild(link);

    await wait(50);

    expect(seen).toContain("https://example.com/preload.js");
  });

  it("intercepts preload imagesrcset requests", async () => {
    const seen: string[] = [];

    createJSDOMWithInterceptor({
      html: `<link rel="preload" as="image" imagesrcset="https://example.com/preload-1x.png 1x, https://example.com/preload-2x.png 2x">`,
      domOptions: {
        pretendToBeVisual: true,
      },
      interceptor: (url) => {
        seen.push(url);
        return Buffer.from("");
      },
    });

    await wait(50);

    expect(seen).toContain("https://example.com/preload-1x.png");
    expect(seen).toContain("https://example.com/preload-2x.png");
  });

  it("intercepts icon and prefetch link href requests", async () => {
    const seen: string[] = [];

    createJSDOMWithInterceptor({
      html: `<link rel="icon" href="https://example.com/favicon.ico"><link rel="prefetch" href="https://example.com/prefetch.js">`,
      domOptions: {
        pretendToBeVisual: true,
      },
      interceptor: (url) => {
        seen.push(url);
        return Buffer.from("");
      },
    });

    await wait(50);

    expect(seen).toContain("https://example.com/favicon.ico");
    expect(seen).toContain("https://example.com/prefetch.js");
  });

  it("intercepts preload href when rel is set after", async () => {
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

    const link = dom.window.document.createElement("link");
    link.setAttribute("href", "https://example.com/preload.css");
    link.setAttribute("rel", "preload");
    dom.window.document.head.appendChild(link);

    await wait(50);

    expect(seen).toContain("https://example.com/preload.css");
  });
});
