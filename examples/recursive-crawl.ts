import { Lighterceptor } from "../src/index";

// This example demonstrates recursive discovery. When recursion is enabled,
// the interceptor will fetch JS/CSS/HTML resources and walk their dependencies.
const html = `
  <!doctype html>
  <html>
    <head>
      <link rel="stylesheet" href="https://example.com/site.css" />
      <script src="https://example.com/app.js"></script>
    </head>
    <body>
      <iframe src="https://example.com/frame.html"></iframe>
    </body>
  </html>
`;

const resources = new Map<string, { body: string; contentType: string }>([
  [
    "https://example.com/site.css",
    {
      body: '@import url("./theme.css"); .hero{background:url("/hero.png");}',
      contentType: "text/css",
    },
  ],
  [
    "https://example.com/theme.css",
    {
      body: ".card{background-image:url(https://example.com/card.png);}",
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
      body: '<!doctype html><link rel="stylesheet" href="/frame.css"><img src="/frame.png">',
      contentType: "text/html",
    },
  ],
  [
    "https://example.com/frame.css",
    {
      body: ".frame{background:url(https://example.com/frame-bg.png)}",
      contentType: "text/css",
    },
  ],
]);

async function run() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) => {
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

  try {
    const interceptor = new Lighterceptor(html, { recursion: true });
    const result = await interceptor.run();
    console.log(
      "Requests:",
      result.requests.map((item) => item.url),
    );
  } finally {
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    }
  }
}

void run();
